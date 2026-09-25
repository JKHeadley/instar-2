#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OUTAGE_TEXT = 'I am down and restarting. Messages may be delayed; I will resume when the agent restarts.';
const bridge = fileURLToPath(new URL('../src/assembly/telegram-bot-api-bridge.mjs', import.meta.url));

function writeDurable(path, value) {
  const temporary = join(dirname(path), `.host-watch-${randomUUID()}.pending`);
  const fd = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, path);
  const directory = openSync(dirname(path), 'r');
  try { fsyncSync(directory); } finally { closeSync(directory); }
}

export function watchOnce({ root, now = Date.now(), forceOutage = false, alive = pid => {
  try { process.kill(pid, 0); return true; } catch { return false; }
}, send = sendOutage, staleAfterMs = 30000 }) {
  if (!isAbsolute(root) || resolve(root) !== root) throw Error('host watch: absolute root required');
  const state = JSON.parse(readFileSync(join(root, 'preview-state.json'), 'utf8'));
  const latchPath = join(root, 'preview-stop.json');
  if (existsSync(latchPath) || state.stop || !Number.isSafeInteger(state.trial?.expiresAt) || now >= state.trial.expiresAt)
    return 'inactive';
  const path = join(root, 'host-watch.json');
  const episode = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { version: 1, open: false, id: null };
  if (episode.version !== 1 || typeof episode.open !== 'boolean') throw Error('host watch: corrupt episode');
  const cycle = state.cycle;
  const fresh = cycle && Number.isSafeInteger(cycle.at) && Number.isSafeInteger(cycle.pid)
    && cycle.at <= now && now - cycle.at <= staleAfterMs && alive(cycle.pid);
  if (!forceOutage && fresh) {
    if (episode.open) writeDurable(path, { version: 1, open: false, id: episode.id });
    return 'healthy';
  }
  if (!forceOutage && (!cycle || now - cycle.at <= staleAfterMs || alive(cycle.pid))) return 'waiting';
  if (episode.open) return 'already-notified';
  // A crash after this fsync and before the Bot API call may lose the notice,
  // but it can never create a duplicate send.
  writeDurable(path, { version: 1, open: true, id: randomUUID(), preparedAt: now });
  const latest = JSON.parse(readFileSync(join(root, 'preview-state.json'), 'utf8'));
  if (existsSync(latchPath) || latest.stop || now >= latest.trial.expiresAt) return 'inactive';
  send();
  return 'notified';
}

function sendOutage() {
  const credential = process.env.INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.INSTAR_PREVIEW_OPERATOR_CHAT_ID;
  if (typeof credential !== 'string' || !/^\d+:[A-Za-z0-9_-]{20,}$/.test(credential)
    || typeof chatId !== 'string' || !/^-?\d+$/.test(chatId)) throw Error('host watch: binding unavailable');
  const request = Buffer.from(JSON.stringify({ method: 'sendMessage', body: { chat_id: chatId, text: OUTAGE_TEXT },
    timeoutMs: 15000 })).toString('base64url');
  const child = spawnSync(process.execPath, [bridge, request], { input: credential, encoding: 'utf8',
    timeout: 17000, maxBuffer: 1024 * 1024, env: { PATH: '/usr/bin:/bin' }, stdio: ['pipe', 'pipe', 'ignore'] });
  if (child.status !== 0) return;
  try { const result = JSON.parse(child.stdout); if (result.kind !== 'response' || result.status !== 200) return;
    const body = JSON.parse(result.bytes); if (body.ok !== true) return;
  } catch { /* outcome remains unknown and is never resent */ }
}

export async function supervise(config) {
  if (!config || typeof config.root !== 'string' || !Array.isArray(config.agent)
    || config.agent.length < 1 || config.agent.some(value => typeof value !== 'string')
    || !isAbsolute(config.agent[0])) throw Error('host watch: invalid launch configuration');
  while (true) {
    const state = JSON.parse(readFileSync(join(config.root, 'preview-state.json'), 'utf8'));
    if (existsSync(join(config.root, 'preview-stop.json')) || state.stop || Date.now() >= state.trial.expiresAt) return 0;
    const child = spawn(config.agent[0], config.agent.slice(1), { cwd: config.cwd, env: process.env,
      stdio: ['ignore', 'inherit', 'inherit'] });
    const monitor = setInterval(() => {
      try { watchOnce({ root: config.root }); } catch { /* no diagnostic can expose a secret */ }
    }, 1000);
    const outcome = await new Promise(resolveExit => {
      child.once('error', () => resolveExit({ code: null, signal: 'launch-error' }));
      child.once('exit', (code, signal) => resolveExit({ code, signal }));
    });
    clearInterval(monitor);
    const current = JSON.parse(readFileSync(join(config.root, 'preview-state.json'), 'utf8'));
    if (existsSync(join(config.root, 'preview-stop.json')) || current.stop || Date.now() >= current.trial.expiresAt) return 0;
    if (outcome.code === 0 && outcome.signal === null) return 0;
    try { watchOnce({ root: config.root, forceOutage: true }); } catch { /* prepared episode blocks duplicate send */ }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 1000));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const configPath = process.argv[2];
    if (!configPath || !isAbsolute(configPath)) throw Error('host watch: configuration path required');
    process.exitCode = await supervise(JSON.parse(readFileSync(configPath, 'utf8')));
  } catch { process.stderr.write('host watch stopped; details suppressed\n'); process.exitCode = 1; }
}
