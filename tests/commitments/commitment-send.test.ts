/** Row 01's send slice: the host's ports on the worker's real outbound boundary and real effect policy, inside the real
 * ordinary lane's job. Only the Telegram transport and the model are stand-ins. Each case can fail on the behaviour it names. */
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createJournalWorker, openPreviewJournal } from '../preview/journal-test-worker.js';
import { commitmentStoreReport, createBoundCommitmentHost, CHECK_IN_PASS_MS, type CommitmentHostPorts } from '../preview/commitment-host.js';
import { commitmentSendTarget, COMMITMENT_STORE_GENERATION } from '../preview/commitment-record.js';
import { createOrdinaryLane, sentinelCycle } from '../preview/live-sentinels.js';
import { LIVE_JUDGMENTS } from '../preview/model-call-boundary.js';
// @ts-expect-error The effect doorway remains JavaScript.
import { admitCommitmentSend, anyCommitmentSendGrant, decodeEffectPolicy, DEFAULT_EFFECT_POLICY, UNAVAILABLE_EFFECT_POLICY } from '../preview/effect-doorway.mjs';

const key = new Uint8Array(32).fill(43), TOPIC = 77;
const START = Date.UTC(2026, 8, 26, 17);
const OPERATIONS = ['provider-call', 'telegram:ordinary-reply', 'slack:ordinary-reply'];
const forward = { generation: COMMITMENT_STORE_GENERATION, additive: true as const };
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '-1001234', operator: '7654321', forum: true as const, grant: 'grant:commitment-send',
  configurationDigest: 'sha256:commitment-send', expires: Date.UTC(2026, 11, 20), maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 262144, cursor: 0 };
const update = (id: number, thread: number) => ({ update_id: id,
  message: { message_id: id, chat: { id: -1001234, type: 'supergroup', is_forum: true }, from: { id: 7654321 }, date: Math.floor(START / 1000), text: 'hello', message_thread_id: thread } });
/** The operator's recorded policy: Telegram sends cost nothing, and this topic's commitment sends are granted. */
const policyFor = (topic = TOPIC, over: Record<string, unknown> = {}) => decodeEffectPolicy({ type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: [],
  registered: [{ effect: 'telegram:ordinary-reply', consequence: 'attention', reversibility: 'irreversible', reach: 'operator', costUsd: 0, source: 'P-08' }],
  grants: [{ id: 'commitment-send-grant', effect: 'telegram:ordinary-reply', target: `commitment-send:${String(topic)}`, approves: ['scope'],
    source: 'operator message', custodian: 'operator', recovery: 'unknown-never-retry', ...over }] });

type Transport = { kind: 'accepted'; message: number } | { kind: 'refused'; reason: string } | { kind: 'unknown'; reason: string } | 'throw';
function world(start: { policy?: unknown } = {}, hostPorts: Partial<CommitmentHostPorts> = {}, statusModel?: () => Promise<unknown>) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'commitment-send-'))); roots.push(root);
  const path = join(root, 'journal.encrypted');
  const clock = { now: START };
  const state = { policy: start.policy ?? DEFAULT_EFFECT_POLICY, transport: [] as Transport[], stopped: false, gate: null as Promise<void> | null };
  const sends: { text: string; chat: string; thread?: number; target: string; provenance: unknown; disposition?: string }[] = [];
  const config = () => ({ operations: OPERATIONS, effectPolicy: state.policy });
  let journal = openPreviewJournal(path, key, genesis);
  const workerPorts = { now: () => clock.now, stopped: () => state.stopped, timeZone: 'America/Los_Angeles', model: async () => 'answer',
    groupDisclosure: async () => true, checkOutbound: (text: string) => { if (text.includes('SECRET')) throw Error('refused'); },
    send: async (input: { text: string; chat: string; thread?: number; target: string; provenance: unknown; disposition?: string }) => {
      sends.push({ text: input.text, chat: input.chat, ...(input.thread === undefined ? {} : { thread: input.thread }), target: input.target, provenance: input.provenance, ...(input.disposition ? { disposition: input.disposition } : {}) });
      if (state.gate) await state.gate;
      const next = state.transport.shift() ?? { kind: 'accepted' as const, message: 500 + sends.length };
      if (next === 'throw') throw Error('socket reset after write');
      return next;
    }, ...(statusModel ? { commitmentStatus: statusModel } : {}) };
  let worker = createJournalWorker(journal, workerPorts as never);
  const host = () => createBoundCommitmentHost(journal, { now: () => clock.now, minutesOfDay: () => 720, formatWhen: ms => new Date(ms).toISOString(), fileExists: () => false,
    config: { get: (_k, fallback) => fallback, set() {} }, log() {}, ...hostPorts }, worker as never,
  { admit: topic => admitCommitmentSend(config(), topic, clock.now), any: () => anyCommitmentSendGrant(config(), clock.now) });
  let bound = host();
  return { clock, state, sends, get journal() { return journal; }, get worker() { return worker; }, get host() { return bound; },
    /** A new process over the same journal, as after a crash at this exact point. */
    reopen() { bound.stop(); journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, workerPorts as never); bound = host(); },
    close() { bound.stop(); journal.close(); } };
}
const openTopic = async (w: ReturnType<typeof world>, thread = TOPIC) => { w.worker.intake([update(1, thread)] as never); await w.worker.drain(); };
const dueCheckIn = async (w: ReturnType<typeof world>, topicId = TOPIC) => {
  w.host.tick();
  await w.host.settle();
  return w.host.tracker().record({ type: 'one-time-action', userRequest: 'the benchmark', agentResponse: 'ok', topicId, checkInAt: new Date(w.clock.now).toISOString() });
};
const commitmentSends = (w: ReturnType<typeof world>) => w.sends.filter(send => send.target.startsWith('commitment-send:'));
const speakingBeacon = (w: ReturnType<typeof world>) => {
  w.host.tick();
  return w.host.tracker().record({ type: 'one-time-action', userRequest: 'the migration', agentResponse: 'on it', topicId: TOPIC, beaconEnabled: true, cadenceMs: 60_000,
    hardDeadlineAt: new Date(w.clock.now + 100_000).toISOString() });
};

it('no grant: a due check-in refuses before transport and spends no attempt, over every way of having no grant', async () => {
  const unavailable = { type: UNAVAILABLE_EFFECT_POLICY, reason: 'it cannot be read (ENOENT)' };
  for (const policy of [DEFAULT_EFFECT_POLICY, unavailable, policyFor(TOPIC + 1), policyFor(TOPIC, { target: undefined }), policyFor(TOPIC, { expiresAt: START })]) {
    const w = world({ policy });
    try {
      await openTopic(w);
      const c = await dueCheckIn(w);
      await w.host.runCheckIns();
      // The doorway itself refuses too, in case the grant is withdrawn between the pass's check and the send.
      expect(await w.worker.commitmentDoorway(topic => admitCommitmentSend({ operations: OPERATIONS, effectPolicy: policy }, topic, w.clock.now)).send(TOPIC, 'text', { logicalSendId: 'x:0' }))
        .toMatchObject({ delivered: false, reason: 'no-send-grant', definite: true });
      expect(commitmentSends(w)).toEqual([]);
      expect(w.journal.view.commitmentStore?.sends ?? []).toEqual([]);
      expect(w.host.tracker().get(c.id)?.status).toBe('pending');
      expect(w.host.tracker().get(c.id)?.checkInReminderAttempts ?? 0).toBe(0);
    } finally { w.close(); }
  }
});

it('no grant: the beacon speaks nothing; a topic this journal never heard from is refused even when granted', async () => {
  const off = world();
  try {
    await openTopic(off);
    const c = speakingBeacon(off);
    await off.host.beacon().fire(c.id);
    expect(commitmentSends(off)).toEqual([]);
    expect(off.host.tracker().get(c.id)?.status).toBe('pending');
    // Output is off, rather than on and refused: nothing stood down, nothing recorded as refused. A later grant needs no restart.
    expect((off.journal.view.commitmentStore?.hot[c.id] as { standDownAt?: string } | undefined)?.standDownAt).toBeUndefined();
    expect(commitmentStoreReport(off.journal.view)?.sends.refusedBeforeIntent).toBe(0);
    off.state.policy = policyFor();
    await off.host.beacon().fire(c.id);
    expect(commitmentSends(off)).toHaveLength(1);
  } finally { off.close(); }
  const w = world({ policy: policyFor() });
  try {
    expect(await w.worker.commitmentDoorway(() => ({ admitted: true, grant: 'g' })).send(TOPIC, 'text', { logicalSendId: 'x:0' })).toMatchObject({ delivered: false, reason: 'unknown-topic', permanent: true });
    expect(w.sends).toEqual([]);
  } finally { w.close(); }
});

it('withdrawn grant: a later send refuses before transport, the row waits unspent, and a restored grant resumes it', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w);
    const first = await dueCheckIn(w);
    await w.host.runCheckIns();
    expect(commitmentSends(w)).toHaveLength(1);
    expect(w.host.tracker().get(first.id)?.checkInReminderSentAt).toBeDefined();
    w.state.policy = { type: UNAVAILABLE_EFFECT_POLICY, reason: 'it does not decode' };
    const second = await dueCheckIn(w);
    expect((await w.host.runCheckIns()).heldNoGrant).toBe(1);
    expect(commitmentSends(w)).toHaveLength(1);
    expect(w.host.tracker().get(second.id)?.checkInReminderAttempts ?? 0).toBe(0);
    w.state.policy = policyFor();
    await w.host.runCheckIns();
    expect(commitmentSends(w)).toHaveLength(2);
    expect(w.host.tracker().get(second.id)?.checkInReminderSentAt).toBeDefined();
  } finally { w.close(); }
});

it('a grant for another topic: the beacon is refused before any intent, stands down with the refusal recorded, and resumes once granted', async () => {
  const w = world({ policy: policyFor(TOPIC + 1) });
  try {
    await openTopic(w);
    const c = speakingBeacon(w);
    await w.host.beacon().fire(c.id);
    expect(commitmentSends(w)).toEqual([]);
    expect(w.journal.view.commitmentStore?.sends).toEqual([]);
    expect(commitmentStoreReport(w.journal.view)?.sends).toMatchObject({ refusedBeforeIntent: 1, lastRefusal: { logicalSendId: `${c.id}:0`, reason: 'no-send-grant' } });
    expect(w.journal.view.commitmentStore?.hot[c.id]).toMatchObject({ standDownAt: expect.any(String) });
    await w.host.beacon().fire(c.id);
    w.host.beacon().recheckStandDowns();
    expect((w.journal.view.commitmentStore?.hot[c.id] as { standDownAt?: string }).standDownAt).toBeDefined();
    w.state.policy = policyFor();
    w.host.beacon().recheckStandDowns();
    expect((w.journal.view.commitmentStore?.hot[c.id] as { standDownAt?: string }).standDownAt).toBeUndefined();
    await w.host.beacon().fire(c.id);
    expect(commitmentSends(w)).toHaveLength(1);
  } finally { w.close(); }
});

it('authorized check-in: signed intent bound to chat, topic and grant, then the exact receipt, and the row stamps only then', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w);
    const before = w.journal.view.replies;
    const c = await dueCheckIn(w);
    expect((await w.host.runCheckIns()).sent).toBe(1);
    const [send] = commitmentSends(w);
    expect(send).toMatchObject({ chat: genesis.chat, thread: TOPIC, target: commitmentSendTarget(0), disposition: 'result' });
    expect(send!.text).toContain('the benchmark');
    expect(w.journal.verifyOutbound(send!.provenance, { target: send!.target, chat: genesis.chat, thread: TOPIC, body: send!.text })).toBe(true);
    expect(w.journal.verifyOutbound(send!.provenance, { target: send!.target, chat: genesis.chat, thread: TOPIC + 1, body: send!.text })).toBe(false);
    expect(w.journal.view.commitmentStore?.sends).toMatchObject([{ logicalSendId: `${c.id}:check-in`, effectGrant: 'commitment-send-grant', thread: TOPIC, sent: 502 }]);
    expect(w.journal.view.replies).toBe(before + 1);
    expect(w.host.tracker().get(c.id)).toMatchObject({ status: 'pending', checkInReminderAttempts: 1 });
    expect(w.host.tracker().get(c.id)?.checkInReminderSentAt).toBeDefined();
    expect(commitmentStoreReport(w.journal.view)?.sends).toMatchObject({ attempts: 1, delivered: 1, refused: 0, unsettled: [] });
    await w.host.runCheckIns();
    expect(commitmentSends(w)).toHaveLength(1);
  } finally { w.close(); }
});

it('authorized beacon: a heartbeat sends through the boundary, advances its logical id on the receipt, and closes nothing', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w);
    const c = speakingBeacon(w);
    await w.host.beacon().fire(c.id);
    expect(commitmentSends(w)).toHaveLength(1);
    expect(w.journal.view.commitmentStore?.sends[0]).toMatchObject({ logicalSendId: `${c.id}:0`, sent: 502 });
    expect(w.journal.view.commitmentStore?.hot[c.id]).toMatchObject({ sendSeq: 1 });
    expect(w.host.tracker().get(c.id)).toMatchObject({ status: 'pending', heartbeatCount: 1 });
  } finally { w.close(); }
});

it('secret-bearing text never gets an intent or reaches the transport', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w);
    expect(await w.worker.commitmentDoorway(() => ({ admitted: true, grant: 'g' })).send(TOPIC, 'SECRET', { logicalSendId: 'x:0' })).toMatchObject({ reason: 'outbound-refused', permanent: true });
    expect(w.journal.view.commitmentStore?.sends ?? []).toEqual([]);
    expect(commitmentSends(w)).toEqual([]);
  } finally { w.close(); }
});

it.each<[string, Transport]>([['an unknown outcome', { kind: 'unknown', reason: 'timed out after write' }], ['a thrown transport', 'throw']])(
  'ambiguous check-in, %s: stays unknown, never repeated, closes nothing, and reads as held', async (_name, result) => {
    const w = world({ policy: policyFor() });
    try {
      await openTopic(w);
      w.state.transport.push(result);
      const c = await dueCheckIn(w);
      expect((await w.host.runCheckIns()).unknown).toBe(1);
      const row = () => w.host.tracker().get(c.id)!;
      expect(row().checkInReminderSendStartedAt).toBeDefined();
      expect(row().checkInReminderSentAt).toBeUndefined();
      expect(row().status).toBe('pending');
      for (let pass = 0; pass < 7; pass++) { w.clock.now += CHECK_IN_PASS_MS; await w.host.runCheckIns(); }
      w.reopen(); w.host.tick();
      await w.host.runCheckIns();
      expect(commitmentSends(w)).toHaveLength(1);
      expect(row()).toMatchObject({ status: 'pending', checkInReminderAttempts: 1 });
      expect(row().checkInReminderFailedAt).toBeUndefined();
      expect(commitmentStoreReport(w.journal.view)?.sends).toMatchObject({ delivered: 0, unsettled: [`${c.id}:check-in`] });
    } finally { w.close(); }
  });

it('ambiguous beacon send: held under its operation with its logical id unspent; later fires send nothing, and only a receipt releases it', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w);
    w.state.transport.push({ kind: 'unknown', reason: 'timed out after write' });
    const c = speakingBeacon(w);
    await w.host.beacon().fire(c.id);
    expect(w.journal.view.commitmentStore?.hot[c.id]).toMatchObject({ originHold: { operationId: commitmentSendTarget(0), outcome: 'unknown', logicalReplaySafe: false } });
    for (let n = 0; n < 3; n++) { w.clock.now += 10_000; await w.host.beacon().fire(c.id); }
    expect(commitmentSends(w)).toHaveLength(1);
    expect(w.host.tracker().get(c.id)?.status).toBe('pending');
    expect(w.host.tracker().get(c.id)?.heartbeatCount ?? 0).toBe(0);
    // The exact receipt, when it exists, settles the hold.
    w.journal.append({ kind: 'commitment-send-sent', forward, ordinal: 0, message: 900, at: w.clock.now });
    w.clock.now += 60_000; await w.host.beacon().flushTopicAggregate(TOPIC);
    expect(w.journal.view.commitmentStore?.hot[c.id]).toMatchObject({ sendSeq: 1, heartbeatCount: 1 });
    expect(commitmentSends(w)).toHaveLength(1);
    expect((w.journal.view.commitmentStore?.hot[c.id] as { originHold?: unknown }).originHold).toBeUndefined();
  } finally { w.close(); }
});

it('a definite refusal sent nothing: it may try again under the same logical id, a new attempt with its own receipt', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w);
    w.state.transport.push({ kind: 'refused', reason: 'chat not found' });
    const c = await dueCheckIn(w);
    expect((await w.host.runCheckIns()).failed).toBe(1);
    expect(w.host.tracker().get(c.id)?.checkInReminderSendStartedAt).toBeUndefined();
    await w.host.runCheckIns();
    expect(commitmentSends(w).map(send => send.target)).toEqual([commitmentSendTarget(0), commitmentSendTarget(1)]);
    expect(w.host.tracker().get(c.id)?.checkInReminderSentAt).toBeDefined();
    expect(commitmentStoreReport(w.journal.view)?.sends).toMatchObject({ attempts: 2, delivered: 1, refused: 1, unsettled: [] });
    expect(sendOutcomeReason(w)).toBe('chat not found');
  } finally { w.close(); }
});
const sendOutcomeReason = (w: ReturnType<typeof world>) => w.journal.view.sendOutcomes.find(item => item.target === commitmentSendTarget(0))?.reason;

it('restart: a crash after the intent and before any outcome never sends again; the row stays open and unknown', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w);
    const c = await dueCheckIn(w);
    // The process dies inside the transport: the intent is durable, nothing after it was written.
    w.state.transport.push('throw');
    const pass = w.host.runCheckIns();
    await pass;
    expect(w.journal.view.commitmentStore?.sends).toHaveLength(1);
    w.reopen(); w.host.tick();
    await w.host.runCheckIns();
    await w.worker.commitmentDoorway(() => ({ admitted: true, grant: 'commitment-send-grant' })).send(TOPIC, 'different text', { logicalSendId: `${c.id}:check-in` });
    expect(commitmentSends(w)).toHaveLength(1);
    expect(w.host.tracker().get(c.id)?.status).toBe('pending');
  } finally { w.close(); }
});

it('restart: a crash after the receipt and before the row stamp settles delivered from the receipt, with no second send', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w);
    const c = await dueCheckIn(w);
    const doorway = w.worker.commitmentDoorway(() => ({ admitted: true, grant: 'commitment-send-grant' }));
    await w.host.tracker().mutate(c.id, row => ({ ...row, checkInReminderAttempts: 1, checkInReminderSendStartedAt: new Date(w.clock.now).toISOString() }));
    expect(await doorway.send(TOPIC, 'text', { logicalSendId: `${c.id}:check-in` })).toMatchObject({ delivered: true });
    w.reopen(); w.host.tick();
    const report = await w.host.runCheckIns();
    expect(report.sent).toBe(1);
    expect(commitmentSends(w)).toHaveLength(1);
    expect(w.host.tracker().get(c.id)?.checkInReminderSentAt).toBeDefined();
  } finally { w.close(); }
});

it('restart: a crash after the start and before any intent proves nothing reached the transport, so it may send', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w);
    const c = await dueCheckIn(w);
    await w.host.tracker().mutate(c.id, row => ({ ...row, checkInReminderAttempts: 1, checkInReminderSendStartedAt: new Date(w.clock.now).toISOString() }));
    w.reopen(); w.host.tick();
    await w.host.runCheckIns();
    expect(commitmentSends(w)).toHaveLength(1);
    expect(w.host.tracker().get(c.id)).toMatchObject({ checkInReminderAttempts: 2 });
  } finally { w.close(); }
});

it('restart: a delivered beacon send whose bookkeeping was lost answers already-delivered without the transport', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w);
    const doorway = () => w.worker.commitmentDoorway(() => ({ admitted: true, grant: 'commitment-send-grant' }));
    await doorway().send(TOPIC, 'text', { logicalSendId: 'CMT-1:0' });
    w.reopen();
    expect(await doorway().send(TOPIC, 'text', { logicalSendId: 'CMT-1:0' })).toEqual({ delivered: false, outcome: 'already-delivered-recently' });
    expect(commitmentSends(w)).toHaveLength(1);
    expect(await doorway().resolveDelivery('CMT-1:0')).toBe(true);
    expect(await doorway().resolveOrigin(commitmentSendTarget(0))).toBe(true);
  } finally { w.close(); }
});

it('the journal itself refuses a second attempt, a foreign chat, a past-cap intent and a forged receipt, and replays what it holds', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w);
    const doorway = w.worker.commitmentDoorway(() => ({ admitted: true, grant: 'commitment-send-grant' }));
    w.state.transport.push({ kind: 'unknown', reason: 'timed out' });
    await doorway.send(TOPIC, 'text', { logicalSendId: 'CMT-1:0' });
    const intent = (over: Record<string, unknown>) => { const ordinal = 1, chat = genesis.chat, text = 'again';
      return { kind: 'commitment-send-intent' as const, forward, ordinal, logicalSendId: 'CMT-2:0', text, chat, thread: TOPIC, grant: genesis.grant, effectGrant: 'g',
        provenance: w.journal.signOutbound('infrastructure', { target: commitmentSendTarget(ordinal), chat, thread: TOPIC, body: text }), at: w.clock.now, ...over }; };
    expect(() => w.journal.append(intent({ logicalSendId: 'CMT-1:0' }) as never)).toThrow(/commitment send intent refused/);
    expect(() => w.journal.append(intent({ chat: '-999' }) as never)).toThrow();
    expect(() => w.journal.append(intent({ text: 'tampered' }) as never)).toThrow();
    expect(() => w.journal.append({ kind: 'commitment-send-sent', forward, ordinal: 7, message: 1, at: w.clock.now })).toThrow(/receipt refused/);
    w.reopen();
    expect(w.journal.view.commitmentStore?.sends).toHaveLength(1);
    w.journal.compact(); w.reopen();
    expect(w.journal.view.commitmentStore?.sends).toMatchObject([{ logicalSendId: 'CMT-1:0' }]);
    expect(w.journal.view.sendOutcomes).toMatchObject([{ target: commitmentSendTarget(0), outcome: 'unknown' }]);
    // A reply cap refuses before transport, as a definite non-delivery.
    const capped = world({ policy: policyFor() });
    try {
      await openTopic(capped);
      while (capped.journal.view.replies < capped.journal.view.limits.maxReplies)
        await capped.worker.commitmentDoorway(() => ({ admitted: true, grant: 'g' })).send(TOPIC, 'text', { logicalSendId: `fill:${String(capped.journal.view.replies)}` });
      const count = commitmentSends(capped).length;
      expect(await capped.worker.commitmentDoorway(() => ({ admitted: true, grant: 'g' })).send(TOPIC, 'text', { logicalSendId: 'over:0' })).toMatchObject({ reason: 'reply-cap', definite: true });
      expect(commitmentSends(capped)).toHaveLength(count);
    } finally { capped.close(); }
  } finally { w.close(); }
});

const cycle = async (w: ReturnType<typeof world>, steps: (() => Promise<unknown>)[], whileOpen?: (open: () => boolean) => Promise<void>) => {
  const lane = createOrdinaryLane({ elapsed: () => w.clock.now, peerCurrent: () => true, after: () => {} });
  const admitted = sentinelCycle(lane, { tick: () => { w.host.tick(); steps.push(() => w.host.settle()); }, requested: steps, drain: async () => { await w.worker.drain(); }, after: async () => {} });
  expect(admitted).toBe(true);
  let open = true;
  const ended = lane.settle().then(() => { open = false; });
  await whileOpen?.(() => open);
  await ended;
  expect(lane.error()).toBeNull();
};

it('real runner cycle: the admitted tick drives a due check-in to the transport and its receipt, and with no grant to nothing', async () => {
  const w = world();
  try {
    await openTopic(w);
    const steps: (() => Promise<unknown>)[] = [];
    await cycle(w, steps);
    const c = w.host.tracker().record({ type: 'one-time-action', userRequest: 'the benchmark', agentResponse: 'ok', topicId: TOPIC, checkInAt: new Date(w.clock.now + 1000).toISOString() });
    w.clock.now += CHECK_IN_PASS_MS + 1;
    await cycle(w, steps);
    expect(commitmentSends(w)).toEqual([]);
    expect(w.host.tracker().get(c.id)?.checkInReminderAttempts ?? 0).toBe(0);
    w.state.policy = policyFor();
    w.host.tick();
    w.clock.now += CHECK_IN_PASS_MS + 1;
    await cycle(w, steps);
    expect(commitmentSends(w)).toHaveLength(1);
    expect(w.journal.view.commitmentStore?.sends[0]?.sent).toBe(502);
    expect(w.host.tracker().get(c.id)?.checkInReminderSentAt).toBeDefined();
    // A stop holds it: no tick work, no send.
    const late = w.host.tracker().record({ type: 'one-time-action', userRequest: 'later', agentResponse: 'ok', topicId: TOPIC, checkInAt: new Date(w.clock.now).toISOString() });
    w.journal.append({ kind: 'stop', reason: 'operator', at: w.clock.now });
    w.clock.now += CHECK_IN_PASS_MS + 1;
    w.host.tick(); await w.host.settle();
    expect(commitmentSends(w)).toHaveLength(1);
    expect(w.host.tracker().get(late.id)?.status).toBe('pending');
  } finally { w.close(); }
});

it('real runner cycle: an admitted tick fires a due beacon timer, and the job does not end until its send has settled', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w);
    const steps: (() => Promise<unknown>)[] = [];
    await cycle(w, steps);
    const c = w.host.tracker().record({ type: 'one-time-action', userRequest: 'the migration', agentResponse: 'on it', topicId: TOPIC, beaconEnabled: true, cadenceMs: 60_000,
      hardDeadlineAt: new Date(w.clock.now + 161_000).toISOString() });
    w.clock.now += 61_000;
    let release = () => {};
    w.state.gate = new Promise<void>(resolve => { release = resolve; });
    await cycle(w, steps, async open => {
      while (commitmentSends(w).length === 0) await new Promise(resolve => setImmediate(resolve));
      // The transport has the message and has not answered: the admitted job is still open.
      for (let turn = 0; turn < 20; turn++) await new Promise(resolve => setImmediate(resolve));
      expect(open()).toBe(true);
      release();
    });
    expect(commitmentSends(w)).toHaveLength(1);
    expect(w.journal.view.commitmentStore?.sends[0]).toMatchObject({ logicalSendId: `${c.id}:0`, sent: 502 });
  } finally { w.close(); }
});

it('settle covers a heartbeat from the moment the tick fires it, before it has reached the send', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w);
    w.host.tick();
    w.host.tracker().record({ type: 'one-time-action', userRequest: 'the migration', agentResponse: 'on it', topicId: TOPIC, beaconEnabled: true, cadenceMs: 60_000,
      hardDeadlineAt: new Date(w.clock.now + 161_000).toISOString() });
    w.clock.now += 61_000;
    w.host.tick();
    await w.host.settle();
    expect(commitmentSends(w)).toHaveLength(1);
  } finally { w.close(); }
});

it('the launcher binds the status line at its model boundary (source check; commitment-send-launcher.test.ts drives the send in the real process)', () => {
  const source = readFileSync(join(process.cwd(), 'tests/preview/journal-agent.mjs'), 'utf8');
  expect(source).toContain('createBoundCommitmentHost(journal,');
  expect(source).toContain('admit: topic => admitCommitmentSend(admissionConfig(), topic, wallNow())');
  expect(source).toContain('sentinelSteps.push(() => commitmentHost.settle())');
  expect(source).toContain("/^commitment-status:\\d+$/u.test(id) ? 'commitment-status-line'");
  expect(source).toContain('commitmentStatus: async ({ id, question, context: packet })');
  expect(LIVE_JUDGMENTS['commitment-status-line']).toMatchObject({ route: 'preview-subscription', default: 'fixed-line', authority: 'signal' });
});

it('status line: a reserved call through the model port, then the signed send; a failed or capped call falls back to the fixed line', async () => {
  const seen: { id: string; question: string; context: string }[] = [];
  const answers: (() => unknown)[] = [() => ({ state: 'complete', value: 'The schema migration is on table 4 of 9.\nignored', usage: { inputTokens: 10, outputTokens: 5, charge: null } }),
    () => { throw Error('model unknown'); }];
  const frames = ['frame one: table 4 of 9', 'frame two: table 5 of 9', 'frame three: table 6 of 9'];
  const w = world({ policy: policyFor() }, { getSessionForTopic: () => 'work', isSessionAlive: () => true, captureSessionOutput: () => frames.shift() ?? null },
    ((input: { id: string; question: string; context: string }) => { seen.push(input); return Promise.resolve().then(answers.shift()!); }) as never);
  try {
    await openTopic(w);
    w.host.tick();
    const c = w.host.tracker().record({ type: 'one-time-action', userRequest: 'the migration', agentResponse: 'I will migrate the schema', topicId: TOPIC, beaconEnabled: true, cadenceMs: 60_000 });
    const calls = w.journal.view.calls;
    await w.host.beacon().fire(c.id);
    expect(seen[0]).toMatchObject({ id: 'commitment-status:0' });
    expect(JSON.parse(seen[0]!.context)).toMatchObject({ promise: 'I will migrate the schema' });
    expect(seen[0]!.context).toContain('table 4 of 9');
    expect(w.journal.view.calls).toBe(calls + 1);
    expect(commitmentSends(w)[0]!.text).toContain('The schema migration is on table 4 of 9.');
    expect(commitmentSends(w)[0]!.text).not.toContain('ignored');
    expect(w.journal.view.commitmentStore?.statusOpen).toEqual([]);
    // The runner's diagnostics record the call's outcome under its id; the journal accepts only an open one.
    const outcome = { elapsedMs: 1, promptBytes: 1, exitCode: 0, outputTokens: 1, localLimit: null, type: 'result', subtype: 'success', stopReason: 'end_turn', isError: false, result: true };
    // A failed call: fixed line, the call settled unknown and nothing invented.
    w.clock.now += 61_000;
    await w.host.beacon().fire(c.id);
    expect(seen).toHaveLength(2);
    expect(commitmentSends(w)[1]!.text).toContain('status fetch failed');
    expect(w.journal.view.commitmentStore?.statusOpen).toEqual([]);
    expect(() => w.journal.append({ kind: 'call-outcome', id: 'commitment-status:0', role: 'model', outcome, at: w.clock.now } as never)).toThrow();
    // At the call cap the reservation refuses before the model, and the fixed line still needs its grant.
    while (w.journal.view.calls < w.journal.view.limits.maxCalls) w.journal.append({ kind: 'commitment-status-reserve', forward, ordinal: w.journal.view.commitmentStore!.statusCalls, at: w.clock.now });
    w.clock.now += 61_000;
    await w.host.beacon().fire(c.id);
    expect(seen).toHaveLength(2);
    expect(commitmentSends(w)[2]!.text).toContain('status fetch failed');
  } finally { w.close(); }
});
