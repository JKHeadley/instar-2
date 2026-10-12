// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
/** Rules 31, 63, 113 and the purpose's replicated(1) default, on REAL journal-agent processes: two runners
 * ("studio" and "laptop") for ONE conversation, one real authority process, real HTTP between all three.
 * Only the Telegram port and the model route are the file-backed fixtures every runner process test uses.
 * This file: the floors (a turn in progress, the stop, a machine without history, half-declared flags).
 * D1(a): a reply waits until the other machine acknowledged its record; it is never sent on local durability. */
import { expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { readRuns } from './self-state.js';
import { offlineProfile, successiveWorld } from './successive-fixture.js';
import { message, pause, started, twoMachines, until } from './two-machine-world.js';

it('the peer is lost in the middle of a turn: the next model call and the send both wait, and the turn finishes once when the peer is back', async () => {
  const t = await twoMachines();
  const modelCalls = () => { try { return readFileSync(join(t.world.directory, 'model.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)); } catch { return []; } };
  // A slow model on the owner, so the test can take the peer away while the answer is being produced.
  const studio = t.harness.startRunner(t.rootOf('studio'), 'studio', 100000, ['--machine-posture', 'multi-machine', '--conversation-authority', t.url,
    '--replica-listen', `127.0.0.1:${t.ports.studio}`, '--replica-peer', `http://127.0.0.1:${t.ports.laptop}`, '--owner-machine', 'studio',
    '--journal-lineage', 'seed'], { ...t.envOf('studio'), INSTAR_PREVIEW_CUTOVER_MODEL_DELAY_MS: '4000' });
  started.push(studio.child);
  await until('the seeded machine serves', () => studio.output.stderr.includes('owner: epoch 1'));
  const laptop = t.start('laptop');
  await until('the second machine stands by', () => laptop.output.stderr.includes('standby: held by studio'));
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.')]);
  await until('the answer call is running', () => modelCalls().length === 1);
  expect((await t.stop(laptop)).status).toBe(0);
  // The answer returns; its review needs another call, and that call's record is not on the other machine: it waits.
  await pause(9000);
  expect(modelCalls()).toHaveLength(1);
  expect(t.sends()).toHaveLength(0);
  expect((await t.view()).claims).toBe(0);
  expect(studio.child.exitCode).toBe(null);
  const back = t.start('laptop');
  await until('the turn finishes', () => t.sends().length === 1, 90000);
  expect(t.sends()[0].role).toBe('studio');
  expect(modelCalls().length).toBeGreaterThan(1);
  expect(modelCalls().every(call => call.role === 'studio')).toBe(true);
  await pause(6000);
  expect(t.sends()).toHaveLength(1);
  await until('nothing is left unresolved', async () => { const view = await t.view(); return view.claims === 1 && view.unresolved.length === 0; });
  await t.stop(back); await t.stop(studio);
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
  await until('the other machine holds the conversation', () => laptop.output.stderr.includes('owner: epoch 2; history adopted'), 60000);
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
}, 120000);

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
