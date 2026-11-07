// @ts-nocheck -- process-level fixture. Real runner, file-backed Telegram, injected child clock crossing the activation end.
import { expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { offlineProfile, successiveWorld } from './successive-fixture.js';
import { openPreviewJournal } from './journal.js';
import { SUBSCRIPTION_PREVIEW_EXPIRY as END } from '../../src/assembly/production-provider.js';
const key = Buffer.alloc(32, 19);
const clock = path => 'data:text/javascript,' + encodeURIComponent(`import { readFileSync } from 'node:fs'; Date.now=()=>Number(readFileSync(${JSON.stringify(path)},'utf8'));`);
const setup = before => {
  const world = successiveWorld(), clockPath = join(world.directory, 'closing-clock');
  const setTime = now => writeFileSync(clockPath, String(now)); setTime(END - before);
  const harness = cutoverHarness(world, offlineProfile, { NODE_OPTIONS: `--import=${clock(clockPath)}` });
  const op = Number(world.configuration.operatorSenderId), chat = Number(world.configuration.chatId);
  const message = (u, text) => ({ update_id: u, message: { message_id: 100 + u, from: { id: op, is_bot: false, first_name: 'J' }, chat: { id: chat, type: 'private' }, date: Math.floor((END - before) / 1000), text } });
  return { world, harness, message, setTime };
};
const sends = h => { const f = join(h.directory, 'telegram.jsonl'); return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').map(l => { try { const d = JSON.parse(l); return d.text ?? d.body?.text ?? l.slice(0, 200); } catch { return l.slice(0, 200); } }) : []; };
const kept = h => sends(h).filter(s => !String(s).startsWith('{"kind":"poll"'));
const until = async (predicate, runner) => {
  const deadline = performance.now() + 30000;
  while (!predicate()) {
    if (runner.child.exitCode !== null || performance.now() >= deadline) throw Error(`closing condition not reached: ${runner.output.stderr}`);
    await new Promise(done => setTimeout(done, 25));
  }
};
it('crossing: durable closing message once, then expiry stops the real runner', async () => {
  const { harness, message, setTime } = setup(200000);
  harness.setUpdates([message(1, 'What is the marker? Juniper.')]);
  const runner = harness.startRunner(harness.liveRoot, 'live', 100000);
  const timeout = setTimeout(() => runner.child.kill('SIGTERM'), 45000);
  try {
    await until(() => kept(harness).some(s => String(s).startsWith('This agent will stop at')), runner);
    setTime(END);
    const child = await runner.exited;
    expect(child.status, runner.output.stderr).toBe(0);
    expect(runner.output.stderr).toContain('runner exiting: trial expired');
    expect(kept(harness).filter(s => String(s).startsWith('This agent will stop at'))).toHaveLength(1);
    const j = openPreviewJournal(join(harness.liveRoot, 'journal.encrypted'), key);
    expect(j.view.stop).toBe('trial expired'); j.close();
  } finally { clearTimeout(timeout); if (runner.child.exitCode === null) runner.child.kill('SIGTERM'); await runner.exited; }
}, 60000);
it('outside the window: no closing message', async () => {
  const { harness, message } = setup(6 * 60000);
  harness.setUpdates([message(1, 'What is the marker? Juniper.')]);
  const run = await harness.runLive(5); expect(run.status, run.stderr).toBe(0);
  expect(kept(harness).filter(s => String(s).startsWith('This agent will stop at'))).toHaveLength(0);
}, 120000);
it('a restart inside the window does not repeat it', async () => {
  const { harness, message } = setup(200000);
  harness.setUpdates([message(1, 'first')]);
  await harness.runLive(5); await harness.runLive(5);
  expect(kept(harness).filter(s => String(s).startsWith('This agent will stop at'))).toHaveLength(1);
}, 120000);
it('nobody has written yet: no closing message and expiry still stops it', async () => {
  const { harness, setTime } = setup(200000);
  harness.setUpdates([]);
  const runner = harness.startRunner(harness.liveRoot, 'live', 100000);
  const timeout = setTimeout(() => runner.child.kill('SIGTERM'), 45000);
  try {
    await until(() => existsSync(join(harness.directory, 'telegram.jsonl')), runner);
    setTime(END);
    const child = await runner.exited;
    expect(child.status, runner.output.stderr).toBe(0);
    expect(runner.output.stderr).toContain('runner exiting: trial expired');
    expect(kept(harness)).toHaveLength(0);
  } finally { clearTimeout(timeout); if (runner.child.exitCode === null) runner.child.kill('SIGTERM'); await runner.exited; }
}, 60000);
it('the journal refuses a second closing receipt and a closing notice outside its window', async () => {
  const { harness, message } = setup(200000);
  harness.setUpdates([message(1, 'first')]); await harness.runLive(5);
  const j = openPreviewJournal(join(harness.liveRoot, 'journal.encrypted'), key), turn = j.view.order[0];
  expect(() => j.append({ kind: 'held-notice-sent', id: turn.id, closing: END, message: 999, at: END - 1000 })).toThrow('closing notice receipt order');
  j.close();
  const early = setup(30 * 60000); early.harness.setUpdates([early.message(1, 'first')]); await early.harness.runLive(5);
  const k = openPreviewJournal(join(early.harness.liveRoot, 'journal.encrypted'), key), lead = k.view.order[0];
  const text = 'This agent will stop at now because my activation ends then. x';
  const provenance = k.signOutbound('infrastructure', { target: `closing-notice:${END}:${lead.id}`, chat: k.view.genesis.chat, body: text });
  expect(() => k.append({ kind: 'held-notice-intent', id: lead.id, closing: { end: END, zone: 'UTC' }, text, chat: k.view.genesis.chat, update: lead.update, grant: k.view.genesis.grant, provenance, at: END - 30 * 60000 })).toThrow('closing notice refused');
  k.close();
}, 180000);
it('minimal path sends while an ordinary model answer is still in flight', async () => {
  const { harness, message, setTime } = setup(360000);
  harness.setUpdates([message(1, 'What is the marker? Juniper.')]);
  const runner = harness.startRunner(harness.liveRoot, 'live', 100000, [], { INSTAR_PREVIEW_CUTOVER_MODEL_DELAY_MS: '20000' });
  const timeout = setTimeout(() => runner.child.kill('SIGTERM'), 45000);
  try {
    await until(() => existsSync(join(harness.directory, 'model.jsonl')), runner);
    setTime(END - 300000);
    await until(() => kept(harness).some(s => String(s).startsWith('This agent will stop at')), runner);
    setTime(END);
    const child = await runner.exited;
    expect(child.status, runner.output.stderr).toBe(0);
    expect(runner.output.stderr).toContain('runner exiting: trial expired');
    expect(kept(harness).filter(s => String(s).startsWith('This agent will stop at'))).toHaveLength(1);
  } finally { clearTimeout(timeout); if (runner.child.exitCode === null) runner.child.kill('SIGTERM'); await runner.exited; }
}, 60000);
