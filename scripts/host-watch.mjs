#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const previewAgent = fileURLToPath(new URL('../tests/preview/agent.mjs', import.meta.url));
const journalAgent = fileURLToPath(new URL('../tests/preview/journal-agent.mjs', import.meta.url));

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

/** The last recorded launch of the journal runner and how it ended (Rule 68): the exit disposition it wrote,
 * or `unrecorded` when the process ended before writing one (a crash). Poll rows and torn lines are skipped. */
export function lastJournalRun(root) {
  let text = '';
  try { text = readFileSync(join(root, 'runs.jsonl'), 'utf8'); } catch { return null; }
  let last = null;
  for (const line of text.split('\n')) {
    let row; try { row = JSON.parse(line); } catch { continue; }
    if (!row || row.v !== 1 || !Number.isSafeInteger(row.launch) || row.poll !== undefined) continue;
    if (row.exit === undefined) last = { launch: row.launch, revival: 'unrecorded' };
    else if (last?.launch === row.launch) last = { launch: row.launch, revival: ['queued', 'inhibited', 'none'].includes(row.revival)
      ? row.revival : 'unrecorded', ...(Number.isSafeInteger(row.nextWorkAt) ? { nextWorkAt: row.nextWorkAt } : {}) };
  }
  return last;
}

async function waitUnlessStopped(root, milliseconds) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end && !existsSync(join(root, 'preview-stop.json')))
    await new Promise(resolveDelay => setTimeout(resolveDelay, Math.min(100, end - Date.now())));
}

/** Journal-runner mode (Rules 15, 55, 68, 88; P-14). This separate process is the consumer of the journal
 * runner's `revival: queued` disposition and restarts it after a failed exit:
 * - a clean exit that leaves queued work is relaunched at once; a crash, refusal or unrecorded end is
 *   relaunched with capped exponential backoff and at most `maxRestarts` consecutive times (Rule 55);
 * - `inhibited` (stop, expiry, allowance, signal pause) and `none` end supervision, and the stop latch is
 *   honoured before every launch and during every wait;
 * - when self-heal is exhausted (`incidentAfter` consecutive failed restarts) it records ONE durable incident
 *   episode with the failed-attempt evidence, visible on the pull surface (`status`). It never sends: an
 *   internal-issue notice must travel as Part Eight's admitted `infrastructure-notice` effect through Part
 *   Ten's confined notice driver, under the alerts grant, and neither exists in this build. The outward
 *   notice therefore stays inhibited, naming both missing owners (Rules 53, 88, 95; Eight §9; Fourteen §14),
 *   instead of a host script sending around them. Without a recorded alerts grant it is 'unbound'. An earlier
 *   episode is preserved as recorded: an uncertain earlier delivery is never repeated.
 * The runner itself re-derives all authority, allowances and UNKNOWN fences from its journal on each launch. */
export const JOURNAL_INCIDENT_LIMITS = Object.freeze({ incidentAfter: 3 });
export const INCIDENT_NOTICE_SEAMS = Object.freeze([
  'part-eight infrastructure-notice payload (seam-response-effects-payloads.md)',
  'part-ten confined notice driver (seam-response-assembly-followup.md)']);
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
export async function superviseJournal(config, io = {}) {
  const index = Array.isArray(config?.agent) ? config.agent.indexOf(journalAgent) : -1;
  const rootAt = index < 0 ? -1 : config.agent.indexOf('--root');
  if (typeof config?.root !== 'string' || !isAbsolute(config.root) || resolve(config.root) !== config.root || index < 0
    || config.agent[index + 1] !== 'run' || rootAt < 0 || config.agent[rootAt + 1] !== config.root
    || config.agent.some(value => typeof value !== 'string') || !isAbsolute(config.agent[0]))
    throw Error('host watch: invalid journal launch configuration');
  if (config.alerts !== undefined && (typeof config.alerts?.grant !== 'string' || !config.alerts.grant.trim()))
    throw Error('host watch: invalid journal configuration');
  const maxRestarts = config.maxRestarts ?? 10, base = config.backoffMs ?? 1000, maximum = config.maxBackoffMs ?? 300000;
  if (![maxRestarts, base, maximum].every(Number.isSafeInteger) || maxRestarts < 1 || maxRestarts > 100 || base < 1 || maximum < base)
    throw Error('host watch: invalid journal restart bounds');
  const launch = io.launch ?? io.spawnRunner ?? spawnJournal;
  const now = io.now ?? Date.now, wait = io.wait ?? waitUnlessStopped;
  const limits = { ...JOURNAL_INCIDENT_LIMITS, ...(config.limits ?? {}) };
  const path = join(config.root, 'host-watch.json');
  const read = () => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { version: 1, mode: 'journal', open: false };
  let failures = 0;
  while (!journalStopped(config.root)) {
    const started = now(), outcome = await launch(config);
    const at = now(), episode = read();
    if (episode.version !== 1 || episode.mode !== 'journal') throw Error('host watch: corrupt journal episode');
    const clean = outcome.code === 0 && outcome.signal === null;
    if (journalStopped(config.root) || clean) { if (episode.open) writeDurable(path, { ...episode, open: false, closedAt: at }); }
    else {
      const failedAttempts = (episode.open ? episode.failedAttempts : 0) + 1;
      let next = { ...episode, open: true, id: episode.open ? episode.id : randomUUID(), openedAt: episode.open ? episode.openedAt : at,
        phase: episode.open ? episode.phase : 'recovering', failedAttempts,
        failures: [...(episode.open ? episode.failures : []), { at, code: outcome.code, signal: outcome.signal,
          runReason: lastRun(config.root)?.reason ?? null }].slice(-10) };
      if (next.phase === 'recovering' && failedAttempts >= limits.incidentAfter)
        next = config.alerts ? { ...next, phase: 'inhibited', incidentAt: at, alertsGrant: config.alerts.grant, inhibitedBy: [...INCIDENT_NOTICE_SEAMS] }
          : { ...next, phase: 'unbound', incidentAt: at };
      writeDurable(path, next);
    }
    if (journalStopped(config.root)) return 0;
    const last = lastJournalRun(config.root);
    if (last?.revival === 'inhibited' || last?.revival === 'none') return 0;
    // A clean exit that ran a while and left queued work is healthy; anything else counts toward the cap.
    const healthy = last?.revival === 'queued' && clean && at - started >= 60000;
    failures = healthy ? 0 : failures + 1;
    if (failures > maxRestarts) return 0;
    await wait(config.root, healthy ? base : Math.min(maximum, base * 2 ** Math.min(failures - 1, 16)));
  }
  return 0;
}

function spawnJournal(config) {
  const child = spawn(config.agent[0], config.agent.slice(1), { cwd: config.cwd, env: process.env, stdio: ['ignore', 'inherit', 'inherit'] });
  return new Promise(resolveExit => {
    child.once('error', () => resolveExit({ code: null, signal: 'launch-error' }));
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const configPath = process.argv[2];
    if (!configPath || !isAbsolute(configPath)) throw Error('host watch: configuration path required');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    process.exitCode = config?.journal === true || config?.mode === 'journal' ? await superviseJournal(config) : await supervise(config);
  } catch { process.stderr.write('host watch stopped; details suppressed\n'); process.exitCode = 0; }
}
