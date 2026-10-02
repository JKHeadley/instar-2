// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
/** Rules 31, 63, 113 and the purpose's replicated(1) default, on REAL journal-agent processes: two runners
 * ("studio" and "laptop") for ONE conversation, one real authority process, real HTTP between all three.
 * Only the Telegram port and the model route are the file-backed fixtures every runner process test uses.
 * D1(a): a reply waits until the other machine acknowledged its record; it is never sent on local durability. */
import { expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { readRuns } from './self-state.js';
import { offlineProfile, successiveWorld } from './successive-fixture.js';
import { message, pause, started, twoMachines, until } from './two-machine-world.js';

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
  await until('the standby takes over with the history', () => laptop.output.stderr.includes('owner: epoch 2; history adopted'), 60000);
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
  await until('the first machine serves again', () => returned.output.stderr.includes('owner: epoch 3; history adopted'), 60000);
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
  await until('the standby takes over', () => laptop.output.stderr.includes('owner: epoch 2; history adopted'), 60000);
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
