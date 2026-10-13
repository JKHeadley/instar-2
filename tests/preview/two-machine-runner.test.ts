// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
/** Rules 31, 63, 113 and the purpose's replicated(1) default, on REAL journal-agent processes: two runners
 * ("studio" and "laptop") for ONE conversation, one real authority process, real HTTP between all three.
 * Only the Telegram port and the model route are the file-backed fixtures every runner process test uses.
 * D1(a): a reply waits until the other machine acknowledged its record; it is never sent on local durability. */
import { expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { REPLY_ACKNOWLEDGEMENT } from './journal.js';
import { readRuns } from './self-state.js';
import { offlineProfile, successiveWorld } from './successive-fixture.js';
import { message, pause, started, twoMachines, until } from './two-machine-world.js';

// Rule 87: slow answers can send one acknowledgement per inbound message. It is a
// separate durable send, not another answer. Check its anchor and uniqueness instead
// of assuming the host finishes every turn before the eight-second timer fires.
function answers(t) {
  const sends = t.sends();
  const acknowledgements = sends.filter(send => send.text === REPLY_ACKNOWLEDGEMENT);
  expect(acknowledgements.every(send => [101, 102].includes(send.replyTo))).toBe(true);
  expect(new Set(acknowledgements.map(send => send.replyTo)).size).toBe(acknowledgements.length);
  return sends.filter(send => send.text !== REPLY_ACKNOWLEDGEMENT);
}

it('counts fast and acknowledged answers while rejecting duplicate or unanchored acknowledgements', () => {
  const reply = { kind: 'send', role: 'studio', text: 'Juniper is the marker.' };
  const acknowledgement = { kind: 'send', role: 'studio', text: REPLY_ACKNOWLEDGEMENT, replyTo: 101 };
  expect(answers({ sends: () => [reply] })).toEqual([reply]);
  expect(answers({ sends: () => [acknowledgement, reply] })).toEqual([reply]);
  expect(() => answers({ sends: () => [acknowledgement, acknowledgement, reply] })).toThrow();
  expect(() => answers({ sends: () => [{ ...acknowledgement, replyTo: 999 }, reply] })).toThrow();
});

it('two runners, one conversation: one reply; the peer goes away and the reply is held; it returns and the reply goes out exactly once', async () => {
  const t = await twoMachines();
  const studio = t.start('studio', ['--journal-lineage', 'seed']);
  await until('the seeded machine serves', () => studio.output.stderr.includes('owner: epoch 1; history seeded'));
  const laptop = t.start('laptop');
  await until('the second machine stands by', () => laptop.output.stderr.includes('standby: held by studio'));

  // Both up: exactly one reply, from the owner, after the standby acknowledged the record; the standby never polls.
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.')]);
  await until('the first reply', () => answers(t).length === 1);
  expect(answers(t)[0].role).toBe('studio');
  await until('the shared cursor passes the answered update', async () => (await t.view()).cursor === 2);
  expect((await t.view())).toMatchObject({ epoch: 1, holder: { machine: 'studio' }, unresolved: [] });
  expect((await t.view()).claims).toBe(t.sends().length);
  expect(t.polls('laptop')).toHaveLength(0);
  const copy = JSON.parse(readFileSync(join(t.rootOf('laptop'), 'replica', 'copy-state.json'), 'utf8'));
  expect(copy).toMatchObject({ epoch: 1, machine: 'studio' });
  const before = await t.status('studio');
  const sendsBefore = t.sends();
  expect(before).toMatchObject({ replies: 1 + before.heldNotices.length, sharedHistory: { lineage: { epoch: 1, seeded: true }, replication: { peerCurrent: true } } });

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
  expect(answers(t)).toHaveLength(1);
  expect(t.sends()).toEqual(sendsBefore);
  expect(held).toMatchObject({ turns: 2, replies: 1 + held.heldNotices.length, calls: before.calls, sharedHistory: { replication: { peerCurrent: false } } });
  // Telegram still holds the unanswered update: the shared cursor did not pass it on one machine's durability.
  expect((await t.view()).cursor).toBe(2);
  expect(studio.child.exitCode).toBe(null);

  // The peer returns: the held reply goes out, once.
  const back = t.start('laptop');
  await until('the held reply', () => answers(t).length === 2, 60000);
  expect(answers(t)[1].role).toBe('studio');
  await until('the shared cursor passes the second update', async () => (await t.view()).cursor === 3);
  await pause(4000);
  expect(answers(t)).toHaveLength(2);
  expect((await t.view())).toMatchObject({ epoch: 1, unresolved: [], claims: t.sends().length });
  expect(t.polls('laptop')).toHaveLength(0);
  expect(studio.output.stderr).toContain('the other machine acknowledged the journal; replies are sent');
  expect((await t.status('studio'))).toMatchObject({ replies: t.sends().length, unknownSends: 0 });
  await t.stop(back); await t.stop(studio);
}, 180000);

it('the owner machine is lost: the other machine takes over WITH the history, holds its reply until the peer is back, and nothing is sent twice', async () => {
  const t = await twoMachines();
  const studio = t.start('studio', ['--journal-lineage', 'seed']);
  await until('the seeded machine serves', () => studio.output.stderr.includes('owner: epoch 1'));
  const laptop = t.start('laptop');
  await until('the second machine stands by', () => laptop.output.stderr.includes('standby: held by studio'));
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.')]);
  await until('the first reply', () => answers(t).length === 1);
  await until('the shared cursor passes it', async () => (await t.view()).cursor === 2);
  // The cursor passes an update once its intake record is replicated; the send's receipt is written after Telegram
  // accepts it and reaches the standby on a later pump. Lost before that, the survivor holds the intent without its
  // receipt and honestly reports it UNKNOWN (Rule 42), never re-sent. This case loses the owner after the whole
  // first exchange, receipt included, is in the copy the standby acknowledged.
  await until('the owner recorded the receipt', async () => (await t.status('studio'))?.sendOutcomes?.accepted === t.sends().length);
  await until('the standby holds the whole journal', () => {
    const held = JSON.parse(readFileSync(join(t.rootOf('laptop'), 'replica', 'copy-state.json'), 'utf8'));
    return held.size === statSync(join(t.rootOf('studio'), 'journal.encrypted')).size;
  });

  // The owner machine is gone without a word (SIGKILL by exact PID). After one term the standby takes the lease
  // and continues from the copy it acknowledged: the first exchange is in ITS journal now.
  await t.stop(studio, 'SIGKILL');
  await until('the standby takes over with the history', () => laptop.output.stderr.includes('owner: epoch 2; history adopted'), 60000);
  await until('the adopted journal is readable', async () => (await t.status('laptop'))?.turns === 1);
  expect(await t.status('laptop')).toMatchObject({ turns: 1, replies: t.sends().length, unknownSends: 0,
    sharedHistory: { lineage: { epoch: 2, adopted: { machine: 'studio', epoch: 1 } } } });

  const sendsBefore = t.sends();
  // Its peer is gone, so it reads the next message and holds the reply (D1(a)): no reply on local durability.
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.'), message(t.world, 2, 'And again: what is the marker? Juniper.')]);
  await until('the survivor reads the message', async () => (await t.status('laptop')).turns === 2);
  await pause(5000);
  expect(answers(t)).toHaveLength(1);
  expect(t.sends()).toEqual(sendsBefore);
  expect((await t.view())).toMatchObject({ epoch: 2, holder: { machine: 'laptop' }, cursor: 2 });

  // The lost machine comes back as the standby (it never polls) and acknowledges: exactly one second reply, from the survivor.
  const returned = t.start('studio');
  await until('the held reply', () => answers(t).length === 2, 60000);
  expect(answers(t)[1].role).toBe('laptop');
  expect(returned.output.stderr).toContain('standby: held by laptop');
  expect(t.polls('studio').filter(call => call.offset > 2)).toHaveLength(0);
  await until('the shared cursor passes the second update', async () => (await t.view()).cursor === 3);

  // A clean hand-back: the survivor stops, the first machine takes over from the survivor's copy; its own older
  // journal is set aside (kept), both exchanges are in its history, and nothing is sent again.
  expect((await t.stop(laptop)).status).toBe(0);
  await until('the first machine serves again', () => returned.output.stderr.includes('owner: epoch 3; history adopted'), 60000);
  await until('its journal holds both exchanges', async () => (await t.status('studio'))?.turns === 2);
  const final = await t.status('studio');
  expect(final).toMatchObject({ turns: 2, replies: t.sends().length, unknownSends: 0 });
  expect(final.sharedHistory.setAside).toHaveLength(1);
  expect(existsSync(join(t.rootOf('studio'), final.sharedHistory.setAside[0]))).toBe(true);
  await pause(3000);
  expect(answers(t)).toHaveLength(2);
  expect((await t.view())).toMatchObject({ epoch: 3, holder: { machine: 'studio' }, unresolved: [], claims: t.sends().length });
  // The survivor was paused by a signal: a deliberate pause is not relaunched by its supervisor.
  expect(readRuns(join(t.rootOf('laptop'), 'runs.jsonl')).launches.at(-1)).toMatchObject({ reason: 'paused by signal SIGTERM', revival: 'inhibited' });
  await t.stop(returned);
}, 240000);

it.each([0, 1500])('an owner that stalls past its term and comes back is stale: it sends nothing, retires, and is wanted back as the standby (%i ms transport return)', async sendDelayMs => {
  const t = await twoMachines();
  const studio = t.harness.startRunner(t.rootOf('studio'), 'studio', 100000, ['--machine-posture', 'multi-machine', '--conversation-authority', t.url,
    '--replica-listen', `127.0.0.1:${t.ports.studio}`, '--replica-peer', `http://127.0.0.1:${t.ports.laptop}`, '--owner-machine', 'studio',
    '--journal-lineage', 'seed'], { ...t.envOf('studio'), INSTAR_PREVIEW_CUTOVER_SEND_DELAY_MS: String(sendDelayMs) });
  started.push(studio.child);
  await until('the seeded machine serves', () => studio.output.stderr.includes('owner: epoch 1'));
  const laptop = t.start('laptop');
  await until('the second machine stands by', () => laptop.output.stderr.includes('standby: held by studio'));
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.')]);
  await until('the first reply', () => answers(t).length === 1);
  await until('the shared cursor passes it', async () => (await t.view()).cursor === 2);

  const sendsBefore = t.sends();
  // This scenario stalls AFTER a completed exchange. The shared cursor proves replicated
  // intake, not a replicated send receipt. Even after Telegram accepted the first reply,
  // a slow transport return can leave only its intent in the standby's copy. Taking over
  // there correctly reports an UNKNOWN send and can emit an extra recovery notice.
  // Wait for the same receipt/copy boundary as the owner-loss scenario above, not a delay.
  await until('the owner recorded the receipts before stalling', async () =>
    (await t.status('studio'))?.sendOutcomes?.accepted === sendsBefore.length);
  await until('the standby holds the completed exchange before stalling', () => {
    const copy = JSON.parse(readFileSync(join(t.rootOf('laptop'), 'replica', 'copy-state.json'), 'utf8'));
    return copy.machine === 'studio' && copy.epoch === 1
      && copy.size === statSync(join(t.rootOf('studio'), 'journal.encrypted')).size;
  });
  // The owner stalls (SIGSTOP by exact PID) for longer than its term; the standby takes over with the history.
  studio.child.kill('SIGSTOP');
  await until('the standby takes over', () => laptop.output.stderr.includes('owner: epoch 2; history adopted'), 60000);
  expect(await t.status('laptop')).toMatchObject({ turns: 1, unknownSends: 0,
    sendOutcomes: { accepted: sendsBefore.length } });
  t.harness.setUpdates([message(t.world, 1, 'What is the marker? Juniper.'), message(t.world, 2, 'And again: what is the marker? Juniper.')]);
  await until('the new owner reads the message', async () => (await t.status('laptop'))?.turns === 2);
  const stalePolls = t.polls('studio').length;

  // The stale owner wakes: its lease is gone, so it neither polls nor sends again; it retires with a recorded reason.
  studio.child.kill('SIGCONT');
  const ended = await studio.exited;
  // Rule 2: a non-zero exit here reached two gates with no evidence of its cause, because the child's
  // captured stderr and run log were discarded with the harness (docs/defects/full-suite-load-timeouts.md,
  // "the two-machine stale-owner exit code"). They are already in hand, so the failure carries them.
  if (ended.status !== 0) process.stderr.write(`the stale owner exited ${JSON.stringify(ended)} instead of retiring cleanly.`
    + `\nits stderr:\n${studio.output.stderr}\nits runs.jsonl:\n${readFileSync(join(t.rootOf('studio'), 'runs.jsonl'), 'utf8')}\n`);
  expect(ended).toMatchObject({ status: 0 });
  expect(t.polls('studio').length).toBeLessThanOrEqual(stalePolls + 1);
  expect(readRuns(join(t.rootOf('studio'), 'runs.jsonl')).launches.at(-1)).toMatchObject({ reason: 'conversation ownership lost',
    retired: 'conversation ownership lost', revival: 'queued' });
  expect(answers(t)).toHaveLength(1);

  expect(t.sends()).toEqual(sendsBefore);

  // Relaunched (as its supervisor would), it is the standby and the peer copy: the held reply goes out once, from the new owner.
  const back = t.start('studio');
  await until('the held reply', () => answers(t).length === 2, 60000);
  expect(answers(t)[1].role).toBe('laptop');
  expect(back.output.stderr).toContain('standby: held by laptop');
  await pause(3000);
  expect(answers(t)).toHaveLength(2);
  expect((await t.view())).toMatchObject({ epoch: 2, holder: { machine: 'laptop' }, claims: t.sends().length });
  await until('nothing is left unresolved', async () => (await t.view()).unresolved.length === 0);
  await t.stop(back); await t.stop(laptop);
}, 240000);
