#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const previewAgent = fileURLToPath(new URL('../tests/preview/agent.mjs', import.meta.url));

function writeDurable(path, value) {
  const temporary = join(dirname(path), `.host-watch-${randomUUID()}.pending`);
  const fd = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, path);
  const directory = openSync(dirname(path), 'r');
  try { fsyncSync(directory); } finally { closeSync(directory); }
}

function readState(root) { return JSON.parse(readFileSync(join(root, 'preview-state.json'), 'utf8')); }
function active(root, state, now) {
  return !existsSync(join(root, 'preview-stop.json')) && !state.stop
    && Number.isSafeInteger(state.trial?.expiresAt) && now < state.trial.expiresAt
    && state.consecutiveErrors < state.trial.errorLimit && state.totalErrors < state.trial.totalErrorLimit;
}
function latchBreaker(root, now) {
  const path = join(root, 'preview-stop.json');
  if (!existsSync(path)) writeDurable(path, { latchedAt: now, reason: 'breaker' });
}
function noteFailedLaunch(root, now, refusal) {
  const state = readState(root);
  if (!active(root, state, now)) return state;
  const next = { ...state, consecutiveErrors: state.consecutiveErrors + 1, totalErrors: state.totalErrors + 1 };
  writeDurable(join(root, 'preview-state.json'), next);
  if (refusal || next.consecutiveErrors >= state.trial.errorLimit || next.totalErrors >= state.trial.totalErrorLimit)
    latchBreaker(root, now);
  return readState(root);
}

export function watchOnce({ root, now = Date.now(), failedAttempt = 0, failedOutcome = null, forceOutage = false, config,
  alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } },
  send = sendOutage, staleAfterMs = 30000 }) {
  if (!isAbsolute(root) || resolve(root) !== root) throw Error('host watch: absolute root required');
  const state = readState(root);
  if (!active(root, state, now)) return 'inactive';
  const path = join(root, 'host-watch.json');
  const episode = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { version: 1, open: false };
  if (episode.version !== 1 || typeof episode.open !== 'boolean') throw Error('host watch: corrupt episode');
  const cycle = state.cycle;
  const fresh = cycle && Number.isSafeInteger(cycle.at) && Number.isSafeInteger(cycle.pid)
    && cycle.at <= now && now - cycle.at <= staleAfterMs && alive(cycle.pid);
  if (!forceOutage && fresh) {
    if (episode.open) writeDurable(path, { ...episode, open: false, closedAt: now });
    return 'healthy';
  }
  if (!forceOutage) return 'waiting';
  if (!state.trial.hostNotice || !Number.isSafeInteger(failedAttempt) || failedAttempt < 1)
    return 'unbound';
  if (!failedOutcome || !(failedOutcome.code === null || Number.isSafeInteger(failedOutcome.code))
    || !(failedOutcome.signal === null || typeof failedOutcome.signal === 'string'))
    throw Error('host watch: failed restart evidence unavailable');
  const failure = { at: now, code: failedOutcome.code, signal: failedOutcome.signal };
  const authority = state.trial.hostNotice;
  if (episode.open && (episode.trial !== state.trial.id || episode.configurationDigest !== state.trial.configurationDigest
    || episode.botId !== authority.botId || episode.chatId !== authority.chatId || episode.message !== authority.message))
    throw Error('host watch: episode authority changed');
  if (episode.open && episode.phase !== 'recovering') return 'already-notified';
  if (failedAttempt === 1) {
    writeDurable(path, { version: 1, open: true, phase: 'recovering', id: randomUUID(),
      trial: state.trial.id, configurationDigest: state.trial.configurationDigest,
      botId: authority.botId, chatId: authority.chatId, message: authority.message,
      failedAttempt, firstFailure: failure, preparedAt: null });
    return 'recovering';
  }
  if (!episode.open || episode.phase !== 'recovering' || episode.failedAttempt + 1 !== failedAttempt
    || !Number.isSafeInteger(episode.firstFailure?.at))
    throw Error('host watch: failed self-heal attempt unavailable');
  const prepared = { ...episode,
    phase: 'prepared', trial: state.trial.id, configurationDigest: state.trial.configurationDigest,
    botId: authority.botId, chatId: authority.chatId, message: authority.message,
    failedAttempt, recoveryFailure: failure, preparedAt: now };
  // The episode is durable before the child can prepare or dispatch its exact effect.
  writeDurable(path, prepared);
  if (!active(root, readState(root), now)) return 'inactive';
  send({ config, episode: prepared });
  return 'notified';
}

function sendOutage({ config, episode }) {
  if (!config || typeof config.root !== 'string') throw Error('host watch: launch binding unavailable');
  const index = config.agent.indexOf(previewAgent);
  if (config.agent[0] !== process.execPath || index < 0 || config.agent[index + 1] !== 'run')
    throw Error('host watch: preview launcher binding unavailable');
  const args = [...config.agent.slice(1)];
  args[index] = 'host-notice';
  const child = spawnSync(process.execPath, args, { cwd: config.cwd, env: process.env,
    encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'ignore', 'ignore'] });
  if (child.status !== 0) throw Error('host watch: prepared notice outcome unknown');
}

function backoff(config, count) {
  const option = name => { const i = config.agent.indexOf(`--${name}`); return i < 0 ? null : Number(config.agent[i + 1]); };
  const base = option('backoff-ms') ?? 250, maximum = option('max-backoff-ms') ?? 5000;
  if (!Number.isSafeInteger(base) || base < 1 || !Number.isSafeInteger(maximum) || maximum < base || maximum > 300000)
    throw Error('host watch: invalid backoff');
  return Math.min(maximum, base * (2 ** Math.min(count - 1, 8)));
}
async function waitBackoff(root, milliseconds) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) {
    if (!active(root, readState(root), Date.now())) return;
    await new Promise(resolveDelay => setTimeout(resolveDelay, Math.min(100, end - Date.now())));
  }
}

export async function supervise(config) {
  if (!config || typeof config.root !== 'string' || !isAbsolute(config.root)
    || !Array.isArray(config.agent) || config.agent.length < 1
    || config.agent.some(value => typeof value !== 'string') || !isAbsolute(config.agent[0]))
    throw Error('host watch: invalid launch configuration');
  while (true) {
    const before = readState(config.root), instant = Date.now();
    if (!active(config.root, before, instant)) {
      if (!before.stop && (before.consecutiveErrors >= before.trial.errorLimit
        || before.totalErrors >= before.trial.totalErrorLimit)) latchBreaker(config.root, instant);
      return 0;
    }
    const child = spawn(config.agent[0], config.agent.slice(1), { cwd: config.cwd, env: process.env,
      stdio: ['ignore', 'inherit', 'inherit'] });
    const monitor = setInterval(() => {
      try { watchOnce({ root: config.root }); } catch { /* secret-safe host diagnostics only */ }
    }, 1000);
    const outcome = await new Promise(resolveExit => {
      child.once('error', () => resolveExit({ code: null, signal: 'launch-error' }));
      child.once('exit', (code, signal) => resolveExit({ code, signal }));
    });
    clearInterval(monitor);
    const now = Date.now(), current = readState(config.root);
    if (!active(config.root, current, now)) return 0;
    if (outcome.code === 0 && outcome.signal === null) return 0;
    const refusal = outcome.code === 1 || outcome.signal === 'launch-error';
    const accounted = noteFailedLaunch(config.root, now, refusal);
    if (refusal || !active(config.root, accounted, Date.now())) return 0;
    const episodePath = join(config.root, 'host-watch.json');
    const episode = existsSync(episodePath) ? JSON.parse(readFileSync(episodePath, 'utf8')) : null;
    const failedAttempt = episode?.open ? episode.failedAttempt + 1 : 1;
    try { watchOnce({ root: config.root, now: Date.now(), forceOutage: true,
      failedAttempt, failedOutcome: outcome, config }); }
    catch { /* a prepared episode cannot be sent twice */ }
    await waitBackoff(config.root, backoff(config, accounted.consecutiveErrors));
  }
}

/** Journal-runner mode (Rules 15, 53, 88; P-14). This separate process restarts the journal
 * runner after a failed exit with bounded backoff. Only after self-heal is exhausted
 * (`noticeAfter` consecutive failed restarts) does it prepare ONE incident notice for the single
 * granted alerts destination, carrying the failed-attempt evidence. The episode is durable before
 * the send, is never re-sent (also across supervisor restarts), and closes on a clean exit. With no
 * recorded alerts grant the incident stays local and visible ('unbound'). */
export const JOURNAL_INCIDENT_LIMITS = Object.freeze({ noticeAfter: 3, perHour: 2 });
const journalAgent = fileURLToPath(new URL('../tests/preview/journal-agent.mjs', import.meta.url));
function lastRun(root) {
  const path = join(root, 'runs.jsonl');
  if (!existsSync(path)) return null;
  const rows = readFileSync(path, 'utf8').split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  return rows.filter(row => typeof row.reason === 'string').at(-1) ?? null;
}
function journalStopped(root) {
  const reason = lastRun(root)?.reason;
  return existsSync(join(root, 'preview-stop.json')) || reason === 'operator stop latched' || reason === 'trial expired';
}
export function journalIncidentText(episode) {
  const since = new Date(episode.openedAt).toISOString().slice(0, 16).replace('T', ' ');
  return `PREVIEW — Incident ${episode.id.slice(0, 8)}: my conversation service stopped and has not recovered after ${episode.noticeAttempts ?? episode.failedAttempts} automatic restarts (since ${since} UTC). Your new messages wait at Telegram and will be read when it is back. Someone needs to check the host machine.`;
}
function journalBinding(config) {
  const index = config.agent.indexOf(journalAgent);
  if (config.agent[0] !== process.execPath || index < 0 || config.agent[index + 1] !== 'run')
    throw Error('host watch: journal launcher binding unavailable');
  return index;
}
function sendJournalIncident({ config, path }) {
  const index = journalBinding(config), args = [...config.agent.slice(1)];
  args[index] = 'incident-notice';
  args.push('--episode', path, '--alerts-grant', config.alerts.grant,
    ...(config.alerts.thread === undefined ? [] : ['--alerts-thread', String(config.alerts.thread)]));
  const child = spawnSync(process.execPath, args, { cwd: config.cwd, env: process.env,
    encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'ignore', 'ignore'] });
  if (child.status !== 0) throw Error('host watch: prepared incident outcome unknown');
}
function spawnJournalRunner(config) {
  return new Promise(resolveExit => {
    const child = spawn(config.agent[0], config.agent.slice(1), { cwd: config.cwd, env: process.env, stdio: ['ignore', 'inherit', 'inherit'] });
    child.once('error', () => resolveExit({ code: null, signal: 'launch-error' }));
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });
}
export async function superviseJournal(config, io = {}) {
  if (!config || typeof config.root !== 'string' || !isAbsolute(config.root) || resolve(config.root) !== config.root
    || !Array.isArray(config.agent) || config.agent.some(value => typeof value !== 'string')
    || config.alerts !== undefined && (typeof config.alerts?.grant !== 'string' || !config.alerts.grant.trim()
      || config.alerts.thread !== undefined && !(Number.isSafeInteger(config.alerts.thread) && config.alerts.thread > 0)))
    throw Error('host watch: invalid journal configuration');
  const run = io.spawnRunner ?? spawnJournalRunner, notify = io.notify ?? sendJournalIncident;
  const now = io.now ?? Date.now, wait = io.wait ?? (ms => new Promise(done => setTimeout(done, ms)));
  const limits = { ...JOURNAL_INCIDENT_LIMITS, ...(config.limits ?? {}) };
  const path = join(config.root, 'host-watch.json');
  const read = () => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { version: 1, mode: 'journal', open: false, notices: [] };
  let clean = 0;
  while (!journalStopped(config.root)) {
    const outcome = await run(config);
    const at = now(), episode = read();
    if (episode.version !== 1 || episode.mode !== 'journal') throw Error('host watch: corrupt journal episode');
    if (journalStopped(config.root) || outcome.code === 0 && outcome.signal === null) {
      if (episode.open) writeDurable(path, { ...episode, open: false, closedAt: at });
      if (journalStopped(config.root)) return 0;
      // A clean cycle end is ordinary; bound only a runner that exits immediately every time.
      clean += 1; await wait(Math.min(5000, 250 * clean)); continue;
    }
    clean = 0;
    const failedAttempts = (episode.open ? episode.failedAttempts : 0) + 1;
    let next = { ...episode, open: true, id: episode.open ? episode.id : randomUUID(), openedAt: episode.open ? episode.openedAt : at,
      phase: episode.open ? episode.phase : 'recovering', failedAttempts,
      failures: [...(episode.open ? episode.failures : []), { at, code: outcome.code, signal: outcome.signal,
        runReason: lastRun(config.root)?.reason ?? null }].slice(-10), notices: episode.notices ?? [] };
    writeDurable(path, next);
    if (next.phase === 'recovering' && failedAttempts >= limits.noticeAfter) {
      if (!config.alerts) writeDurable(path, next = { ...next, phase: 'unbound' });
      else if (next.notices.filter(time => time > at - 3_600_000).length < limits.perHour) {
        next = { ...next, phase: 'prepared', preparedAt: at, noticeAttempts: failedAttempts, notices: [...next.notices, at] };
        next = { ...next, text: journalIncidentText(next) };
        // The episode, its evidence and exact text are durable before the child can dispatch.
        writeDurable(path, next);
        try { notify({ config, path, episode: next }); } catch { /* a prepared incident is never sent twice */ }
      }
    }
    await wait(Math.min(300000, 1000 * 2 ** Math.min(failedAttempts - 1, 8)));
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const configPath = process.argv[2];
    if (!configPath || !isAbsolute(configPath)) throw Error('host watch: configuration path required');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    process.exitCode = config.mode === 'journal' ? await superviseJournal(config) : await supervise(config);
  } catch { process.stderr.write('host watch stopped; details suppressed\n'); process.exitCode = 0; }
}
