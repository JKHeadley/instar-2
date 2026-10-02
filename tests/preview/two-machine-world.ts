// @ts-nocheck -- process-level fixture shared by the two-machine runner tests; physical ports are replaced by the test loader.
/** Rules 31, 63, 113 and the purpose's replicated(1) default, on REAL journal-agent processes: two runners
 * ("studio" and "laptop") for ONE conversation, one real authority process, real HTTP between all three.
 * Only the Telegram port and the model route are the file-backed fixtures every runner process test uses.
 * D1(a): a reply waits until the other machine acknowledged its record; it is never sent on local durability. */
import { afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { connectConversationAuthority } from './conversation-authority.js';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { offlineProfile, successiveWorld } from './successive-fixture.js';

export const SECRET = 'two-machine-test-secret-0123456789';
export const pause = ms => new Promise(done => setTimeout(done, ms));
const freePort = () => new Promise(done => { const probe = createServer(); probe.listen(0, '127.0.0.1', () => {
  const { port } = probe.address(); probe.close(() => done(port)); }); });
export const until = async (what, test, ms = 60000) => {
  for (const end = Date.now() + ms; Date.now() < end;) { if (await test()) return; await pause(100); }
  throw Error(`never happened: ${what}`);
};
export const message = (world, id, text) => ({ update_id: id, message: { message_id: 100 + id,
  from: { id: Number(world.configuration.operatorSenderId), is_bot: false, first_name: 'Justin' },
  chat: { id: Number(world.configuration.chatId), type: 'private' }, date: Math.floor(Date.now() / 1000), text } });

/** Everything this file starts, by exact PID, stopped after each test. */
export const started = [];
afterEach(async () => {
  for (const child of started.splice(0)) if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL'); await new Promise(done => child.once('close', done));
  }
});

export async function twoMachines() {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  const { botId, chatId } = world.configuration, conversation = `telegram/bot-${botId}/chat-${chatId}`;
  harness.setUpdates([]);
  const authorityProcess = spawn(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/conversation-authority-server.mjs', '--path', join(world.directory, 'authority', 'log.jsonl'), '--bot-id', botId,
    '--chat-id', chatId, '--host', '127.0.0.1', '--port', '0', '--term-ms', '6000'],
  { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_AUTHORITY_SECRET: SECRET }, stdio: ['ignore', 'pipe', 'pipe'] });
  started.push(authorityProcess);
  const listening = await new Promise((done, fail) => { let text = '';
    authorityProcess.stdout.setEncoding('utf8').on('data', chunk => { text += chunk; if (text.includes('\n')) done(JSON.parse(text)); });
    authorityProcess.once('close', () => fail(Error('authority ended'))); });
  const url = `http://127.0.0.1:${listening.listening}`;
  const authority = connectConversationAuthority({ url, token: SECRET, conversation, timeoutMs: 5000 });
  const ports = { studio: await freePort(), laptop: await freePort() };
  const rootOf = name => join(world.directory, `machine-${name}`);
  const envOf = name => ({ INSTAR_SECRET_PREVIEW_AUTHORITY_SECRET: SECRET, INSTAR_CONVERSATION_OWNERS: join(world.directory, `owners-${name}`) });
  const start = (name, extra = [], cycles = 100000) => {
    const other = name === 'studio' ? 'laptop' : 'studio';
    const runner = harness.startRunner(rootOf(name), name, cycles, ['--machine-posture', 'multi-machine', '--conversation-authority', url,
      '--replica-listen', `127.0.0.1:${ports[name]}`, '--replica-peer', `http://127.0.0.1:${ports[other]}`, '--owner-machine', name, ...extra], envOf(name));
    started.push(runner.child);
    return runner;
  };
  const stop = async (runner, signal = 'SIGTERM') => { runner.child.kill(signal); return runner.exited; };
  const status = async name => { const { stdout } = await harness.statusOn(rootOf(name), envOf(name)); return stdout.trim() ? JSON.parse(stdout) : null; };
  const view = async () => (await authority.request({ op: 'read' })).view;
  const calls = () => { try { return harness.calls(); } catch { return []; } };
  const sends = () => calls().filter(call => call.kind === 'send');
  const polls = name => calls().filter(call => call.kind === 'poll' && call.role === name);
  return { world, harness, start, stop, status, view, sends, polls, rootOf, url, ports, envOf };
}
