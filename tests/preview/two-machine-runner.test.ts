// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
/** Rules 31, 63, 113 and the purpose's replicated(1) default, on REAL journal-agent processes: two runners
 * ("studio" and "laptop") for ONE conversation, one real authority process, real HTTP between all three.
 * Only the Telegram port and the model route are the file-backed fixtures every runner process test uses.
 * D1(a): a reply waits until the other machine acknowledged its record; it is never sent on local durability. */
import { afterEach, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { connectConversationAuthority } from './conversation-authority.js';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { readRuns } from './self-state.js';
import { offlineProfile, successiveWorld } from './successive-fixture.js';

const SECRET = 'two-machine-test-secret-0123456789';
const pause = ms => new Promise(done => setTimeout(done, ms));
const freePort = () => new Promise(done => { const probe = createServer(); probe.listen(0, '127.0.0.1', () => {
  const { port } = probe.address(); probe.close(() => done(port)); }); });
const until = async (what, test, ms = 30000) => {
  for (const end = Date.now() + ms; Date.now() < end;) { if (await test()) return; await pause(100); }
  throw Error(`never happened: ${what}`);
};
const message = (world, id, text) => ({ update_id: id, message: { message_id: 100 + id,
  from: { id: Number(world.configuration.operatorSenderId), is_bot: false, first_name: 'Justin' },
  chat: { id: Number(world.configuration.chatId), type: 'private' }, date: Math.floor(Date.now() / 1000), text } });

/** Everything this file starts, by exact PID, stopped after each test. */
const started = [];
afterEach(async () => {
  for (const child of started.splice(0)) if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL'); await new Promise(done => child.once('close', done));
  }
});

async function twoMachines() {
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

it('two runners, one conversation: one reply; the peer goes away and the reply is held; it returns and the reply goes out exactly once', async () => {
  const t = await twoMachines();
  const studio = t.start('studio', ['--journal-lineage', 'seed']);
  await until('the seeded machine serves', () => studio.output.stderr.includes('owner: epoch 1; history seeded'));
  const laptop = t.start('laptop');
  await until('the second machine stands by', () => laptop.output.stderr.includes('standby: held by studio'));

  // Both up: exactly one reply, from the owner, after the standby acknowledged the record; the standby never polls.
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.')]);
  await until('the first reply', () => t.sends().length === 1);
  expect(t.sends()[0].role).toBe('studio');
  await until('the shared cursor passes the answered update', async () => (await t.view()).cursor === 2);
  expect((await t.view())).toMatchObject({ epoch: 1, holder: { machine: 'studio' }, unresolved: [] });
  expect((await t.view()).claims).toBe(1);
  expect(t.polls('laptop')).toHaveLength(0);
  const copy = JSON.parse(readFileSync(join(t.rootOf('laptop'), 'replica', 'copy-state.json'), 'utf8'));
  expect(copy).toMatchObject({ epoch: 1, machine: 'studio' });
  const before = await t.status('studio');
  expect(before).toMatchObject({ replies: 1, sharedHistory: { lineage: { epoch: 1, seeded: true }, replication: { peerCurrent: true } } });

  // The peer goes away (its exact PID). The owner still reads the next message, but spends and sends nothing.
  expect((await t.stop(laptop)).status).toBe(0);
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.'), message(t.world, 2, 'And again: what is the marker? Juniper.')]);
  await until('the owner says why it waits', () => studio.output.stderr.includes('replies wait for the other machine to acknowledge the journal'));
  await until('the second message is durable in the owner journal', async () => (await t.status('studio')).turns === 2);
  const pollsBefore = t.polls('studio').length;
  await pause(6000);
  const held = await t.status('studio');
  // Rule 55: Telegram returns the unsettled update at once on every poll; the owner paces itself instead of spinning.
  expect(t.polls('studio').length - pollsBefore).toBeLessThanOrEqual(6);
  expect(t.sends()).toHaveLength(1);
  expect(held).toMatchObject({ turns: 2, replies: 1, calls: before.calls, sharedHistory: { replication: { peerCurrent: false } } });
  // Telegram still holds the unanswered update: the shared cursor did not pass it on one machine's durability.
  expect((await t.view()).cursor).toBe(2);
  expect(studio.child.exitCode).toBe(null);

  // The peer returns: the held reply goes out, once.
  const back = t.start('laptop');
  await until('the held reply', () => t.sends().length === 2, 60000);
  expect(t.sends()[1].role).toBe('studio');
  await until('the shared cursor passes the second update', async () => (await t.view()).cursor === 3);
  await pause(4000);
  expect(t.sends()).toHaveLength(2);
  expect((await t.view())).toMatchObject({ epoch: 1, unresolved: [], claims: 2 });
  expect(t.polls('laptop')).toHaveLength(0);
  expect(studio.output.stderr).toContain('the other machine acknowledged the journal; replies are sent');
  expect((await t.status('studio'))).toMatchObject({ replies: 2, unknownSends: 0 });
  await t.stop(back); await t.stop(studio);
}, 180000);

it('the owner machine is lost: the other machine takes over WITH the history, holds its reply until the peer is back, and nothing is sent twice', async () => {
  const t = await twoMachines();
  const studio = t.start('studio', ['--journal-lineage', 'seed']);
  await until('the seeded machine serves', () => studio.output.stderr.includes('owner: epoch 1'));
  const laptop = t.start('laptop');
  await until('the second machine stands by', () => laptop.output.stderr.includes('standby: held by studio'));
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.')]);
  await until('the first reply', () => t.sends().length === 1);
  await until('the shared cursor passes it', async () => (await t.view()).cursor === 2);

  // The owner machine is gone without a word (SIGKILL by exact PID). After one term the standby takes the lease
  // and continues from the copy it acknowledged: the first exchange is in ITS journal now.
  await t.stop(studio, 'SIGKILL');
  await until('the standby takes over with the history', () => laptop.output.stderr.includes('owner: epoch 2; history adopted'), 30000);
  await until('the adopted journal is readable', async () => (await t.status('laptop'))?.turns === 1);
  expect(await t.status('laptop')).toMatchObject({ turns: 1, replies: 1,
    sharedHistory: { lineage: { epoch: 2, adopted: { machine: 'studio', epoch: 1 } } } });

  // Its peer is gone, so it reads the next message and holds the reply (D1(a)): no reply on local durability.
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.'), message(t.world, 2, 'And again: what is the marker? Juniper.')]);
  await until('the survivor reads the message', async () => (await t.status('laptop')).turns === 2);
  await pause(5000);
  expect(t.sends()).toHaveLength(1);
  expect((await t.view())).toMatchObject({ epoch: 2, holder: { machine: 'laptop' }, cursor: 2 });

  // The lost machine comes back as the standby (it never polls) and acknowledges: exactly one second reply, from the survivor.
  const returned = t.start('studio');
  await until('the held reply', () => t.sends().length === 2, 60000);
  expect(t.sends()[1].role).toBe('laptop');
  expect(returned.output.stderr).toContain('standby: held by laptop');
  expect(t.polls('studio').filter(call => call.offset > 2)).toHaveLength(0);
  await until('the shared cursor passes the second update', async () => (await t.view()).cursor === 3);

  // A clean hand-back: the survivor stops, the first machine takes over from the survivor's copy; its own older
  // journal is set aside (kept), both exchanges are in its history, and nothing is sent again.
  expect((await t.stop(laptop)).status).toBe(0);
  await until('the first machine serves again', () => returned.output.stderr.includes('owner: epoch 3; history adopted'), 30000);
  await until('its journal holds both exchanges', async () => (await t.status('studio'))?.turns === 2);
  const final = await t.status('studio');
  expect(final).toMatchObject({ turns: 2, replies: 2, unknownSends: 0 });
  expect(final.sharedHistory.setAside).toHaveLength(1);
  expect(existsSync(join(t.rootOf('studio'), final.sharedHistory.setAside[0]))).toBe(true);
  await pause(3000);
  expect(t.sends()).toHaveLength(2);
  expect((await t.view())).toMatchObject({ epoch: 3, holder: { machine: 'studio' }, unresolved: [], claims: 2 });
  // The survivor was paused by a signal: a deliberate pause is not relaunched by its supervisor.
  expect(readRuns(join(t.rootOf('laptop'), 'runs.jsonl')).launches.at(-1)).toMatchObject({ reason: 'paused by signal SIGTERM', revival: 'inhibited' });
  await t.stop(returned);
}, 240000);

it('an owner that stalls past its term and comes back is stale: it sends nothing, retires, and is wanted back as the standby', async () => {
  const t = await twoMachines();
  const studio = t.start('studio', ['--journal-lineage', 'seed']);
  await until('the seeded machine serves', () => studio.output.stderr.includes('owner: epoch 1'));
  const laptop = t.start('laptop');
  await until('the second machine stands by', () => laptop.output.stderr.includes('standby: held by studio'));
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.')]);
  await until('the first reply', () => t.sends().length === 1);
  await until('the shared cursor passes it', async () => (await t.view()).cursor === 2);

  // The owner stalls (SIGSTOP by exact PID) for longer than its term; the standby takes over with the history.
  studio.child.kill('SIGSTOP');
  await until('the standby takes over', () => laptop.output.stderr.includes('owner: epoch 2; history adopted'), 30000);
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.'), message(t.world, 2, 'And again: what is the marker? Juniper.')]);
  await until('the new owner reads the message', async () => (await t.status('laptop'))?.turns === 2);
  const stalePolls = t.polls('studio').length;

  // The stale owner wakes: its lease is gone, so it neither polls nor sends again; it retires with a recorded reason.
  studio.child.kill('SIGCONT');
  expect(await studio.exited).toMatchObject({ status: 0 });
  expect(t.polls('studio').length).toBeLessThanOrEqual(stalePolls + 1);
  expect(readRuns(join(t.rootOf('studio'), 'runs.jsonl')).launches.at(-1)).toMatchObject({ reason: 'conversation ownership lost',
    retired: 'conversation ownership lost', revival: 'queued' });
  expect(t.sends()).toHaveLength(1);

  // Relaunched (as its supervisor would), it is the standby and the peer copy: the held reply goes out once, from the new owner.
  const back = t.start('studio');
  await until('the held reply', () => t.sends().length === 2, 60000);
  expect(t.sends()[1].role).toBe('laptop');
  expect(back.output.stderr).toContain('standby: held by laptop');
  await pause(3000);
  expect(t.sends()).toHaveLength(2);
  expect((await t.view())).toMatchObject({ epoch: 2, holder: { machine: 'laptop' }, claims: 2 });
  await until('nothing is left unresolved', async () => (await t.view()).unresolved.length === 0);
  await t.stop(back); await t.stop(laptop);
}, 240000);

it('the stop floor on two machines: a stop latched on one machine leaves the other unable to spend or send, and the stopped one never returns as a peer', async () => {
  const t = await twoMachines();
  const studio = t.start('studio', ['--journal-lineage', 'seed']);
  await until('the seeded machine serves', () => studio.output.stderr.includes('owner: epoch 1'));
  const laptop = t.start('laptop');
  await until('the second machine stands by', () => laptop.output.stderr.includes('standby: held by studio'));
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.')]);
  await until('the first reply', () => t.sends().length === 1);
  await until('the shared cursor passes it', async () => (await t.view()).cursor === 2);

  // The operator's stop on the owner machine (the existing stop command, on that root).
  expect((await t.harness.commandOn(t.rootOf('studio'), 'stop')).status).toBe(0);
  const ended = await studio.exited;
  expect(ended).toMatchObject({ status: 0 });
  expect(readRuns(join(t.rootOf('studio'), 'runs.jsonl')).launches.at(-1)).toMatchObject({ reason: 'operator stop latched', revival: 'inhibited' });
  // The other machine takes the conversation over, reads the next message, and can neither spend nor send: its peer is stopped.
  await until('the other machine holds the conversation', () => laptop.output.stderr.includes('owner: epoch 2; history adopted'), 30000);
  const calls = (await t.status('laptop')).calls;
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.'), message(t.world, 2, 'And again: what is the marker? Juniper.')]);
  await until('it reads the message', async () => (await t.status('laptop')).turns === 2);
  // A relaunch of the stopped machine (a supervisor, a person) does not make it a peer again: it ends at once, polling nothing.
  const relaunched = t.start('studio');
  expect(await relaunched.exited).toMatchObject({ status: 0 });
  expect(relaunched.output.stderr).not.toContain('standby');
  expect(readRuns(join(t.rootOf('studio'), 'runs.jsonl')).launches.at(-1)).toMatchObject({ reason: 'operator stop latched', revival: 'inhibited' });
  await pause(5000);
  expect(t.sends()).toHaveLength(1);
  expect(await t.status('laptop')).toMatchObject({ turns: 2, replies: 1, calls, sharedHistory: { replication: { peerCurrent: false } } });
  expect((await t.view()).claims).toBe(1);
  await t.stop(laptop);
}, 180000);

it('a machine with no enrolled history never takes the conversation, never polls and never starts a new journal', async () => {
  const t = await twoMachines();
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.')]);
  const laptop = t.start('laptop', [], 2);
  expect(await laptop.exited).toMatchObject({ status: 0 });
  expect(laptop.output.stderr).toContain('standby: this machine holds no enrolled copy of the conversation history');
  expect(await t.view()).toMatchObject({ epoch: 0, holder: null, cursor: 0, claims: 0 });
  expect(existsSync(join(t.rootOf('laptop'), 'journal.encrypted'))).toBe(false);
  expect(t.sends()).toHaveLength(0);
  expect(t.polls('laptop')).toHaveLength(0);
  expect(readRuns(join(t.rootOf('laptop'), 'runs.jsonl')).launches.at(-1)).toMatchObject({ revival: 'queued',
    reason: expect.stringContaining('standby: this machine holds no enrolled copy') });
}, 60000);

it('the flags refuse a half-declared posture: an authority needs the multi-machine posture, and seeding needs an authority', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([]);
  const single = await harness.runLive(1, ['--conversation-authority', 'http://127.0.0.1:9']);
  expect(single.status).toBe(1);
  const seedOnly = await harness.runLive(1, ['--journal-lineage', 'seed']);
  expect(seedOnly.status).toBe(1);
  expect(existsSync(join(harness.directory, 'telegram.jsonl'))).toBe(false);
  // The plain single-machine launch on the same root still serves.
  harness.setUpdates([message(world, 1, 'What is the marker? Juniper.')]);
  const served = await harness.runLive(2);
  expect(served.status, served.stderr).toBe(0);
  expect(harness.calls().filter(call => call.kind === 'send')).toHaveLength(1);
  expect(JSON.parse((await harness.statusOf()).stdout).sharedHistory).toBeUndefined();
}, 90000);
