/** Row 01's send slice: the host's ports on the worker's real outbound boundary and real effect policy, inside the real
 * ordinary lane's job. Only the Telegram transport and the model are stand-ins. Each case can fail on the behaviour it names. */
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createJournalWorker, openPreviewJournal } from '../preview/journal-test-worker.js';
import { commitmentStoreReport, createBoundCommitmentHost, CHECK_IN_PASS_MS, type CommitmentHostPorts } from '../preview/commitment-host.js';
import { commitmentSendTarget, COMMITMENT_STORE_GENERATION } from '../preview/commitment-record.js';
import type { CommitmentNoticeContract, CommitmentNoticeProducer } from '../preview/commitment-notice-contract.js';
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

const ALERTS = TOPIC + 1;
function notice(w: ReturnType<typeof world>, episode = 'episode:1', kind: 'concrete-result' | 'human-required-action' = 'human-required-action') {
  const contract: CommitmentNoticeContract = { episode, originTopic: TOPIC, text: 'Infrastructure: the bounded repair failed; operator action is required.',
    evidence: { reference: 'finding:1', kind, observedAt: w.clock.now, expiresAt: w.clock.now + 60_000 },
    issue: { kind: 'internal', selfHeal: { eligible: true, attempt: 'repair:1', failedAt: w.clock.now, outcome: 'failed' } } };
  const state = { contract: contract as CommitmentNoticeContract | undefined, alerts: ALERTS as number | undefined };
  const producer: CommitmentNoticeProducer = { read: id => state.contract?.episode === id ? state.contract : undefined,
    alerts: () => state.alerts === undefined ? undefined : { topic: state.alerts } };
  const doorway = () => w.worker.commitmentDoorway(topic => admitCommitmentSend({ operations: OPERATIONS, effectPolicy: w.state.policy }, topic, w.clock.now), producer);
  return { contract, state, doorway, send: (topic = ALERTS, text = contract.text) => doorway().send(topic, text, { logicalSendId: episode }) };
}
const openRoutes = async (w: ReturnType<typeof world>) => {
  await openTopic(w); w.worker.intake([update(2, ALERTS)] as never); await w.worker.drain();
};

it('a due date and exact generic grant stay pull-visible with no send or spent attempt, including restart', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w); const c = await dueCheckIn(w);
    for (let i = 0; i < 3; i++) {
      w.clock.now += CHECK_IN_PASS_MS; w.host.tick(); await w.host.settle();
      expect(w.host.report().checkIns).toMatchObject({ ran: true, due: 1, sent: 0 });
      expect(w.host.tracker().get(c.id)).toMatchObject({ status: 'pending' });
      expect(w.host.tracker().get(c.id)?.checkInReminderAttempts ?? 0).toBe(0);
      w.reopen();
    }
    expect(commitmentSends(w)).toEqual([]);
    expect(await w.worker.commitmentDoorway(() => ({ admitted: true, grant: 'g' })).send(TOPIC, 'due', { logicalSendId: 'due:1' }))
      .toMatchObject({ reason: 'no-delivery-contract', definite: true });
    expect(w.journal.view.commitmentStore?.sends).toEqual([]);
  } finally { w.close(); }
});

it('the carried beacon observes at its tuned cadence but never pushes observational status under a generic grant', async () => {
  const w = world({ policy: policyFor() }, { options: { beacon: { userOutputEnabled: true } } });
  try {
    await openTopic(w); const c = speakingBeacon(w);
    w.clock.now += 61_000; w.host.tick(); await w.host.settle();
    const first = w.journal.view.commitmentStore?.hot[c.id] as { lastHeartbeatAt?: string };
    expect(first.lastHeartbeatAt).toBe(new Date(w.clock.now).toISOString());
    w.clock.now += 61_000; w.host.tick(); await w.host.settle();
    expect((w.journal.view.commitmentStore?.hot[c.id] as { lastHeartbeatAt?: string }).lastHeartbeatAt).toBe(new Date(w.clock.now).toISOString());
    expect(commitmentSends(w)).toEqual([]); expect(w.host.tracker().get(c.id)?.status).toBe('pending');
  } finally { w.close(); }
});

it.each(['concrete-result', 'human-required-action'] as const)('fresh %s evidence sends one infrastructure notice to alerts with durable cause and receipt', async kind => {
  const w = world({ policy: policyFor(ALERTS) });
  try {
    await openRoutes(w); const n = notice(w, 'episode:1', kind);
    expect(await n.send()).toMatchObject({ delivered: true });
    const [sent] = commitmentSends(w);
    expect(sent).toMatchObject({ thread: ALERTS, disposition: kind === 'concrete-result' ? 'result' : 'action-needed', provenance: { speaker: 'infrastructure' } });
    expect(w.journal.verifyOutbound(sent!.provenance, { target: sent!.target, chat: genesis.chat, thread: ALERTS, body: sent!.text })).toBe(true);
    expect(w.journal.view.commitmentStore?.sends[0]).toMatchObject({ contract: n.contract, sent: expect.any(Number) });
    w.journal.compact(); w.reopen();
    expect(w.journal.view.commitmentStore?.sends[0]?.contract).toEqual(n.contract);
    expect(await n.send()).toMatchObject({ outcome: 'already-delivered-recently' });
    expect(commitmentSends(w)).toHaveLength(1);
  } finally { w.close(); }
});

it.each(['original-topic', 'changed-alerts', 'no-alerts', 'no-contract', 'stale', 'future', 'no-evidence', 'unfailed-heal', 'ineligible-heal', 'missing-heal', 'text-substitution'])(
  '%s refuses an infrastructure notice before intent or transport', async fault => {
    const w = world({ policy: policyFor(ALERTS) });
    try {
      await openRoutes(w); const n = notice(w);
      if (fault === 'original-topic') n.contract.originTopic = ALERTS;
      if (fault === 'changed-alerts') n.state.alerts = TOPIC;
      if (fault === 'no-alerts') n.state.alerts = undefined;
      if (fault === 'no-contract') n.state.contract = undefined;
      if (fault === 'stale') n.contract.evidence.expiresAt = w.clock.now;
      if (fault === 'future') n.contract.evidence.observedAt = w.clock.now + 1;
      if (fault === 'no-evidence') n.contract.evidence.reference = '';
      if (n.contract.issue.kind === 'internal') {
        if (fault === 'unfailed-heal') n.contract.issue.selfHeal.outcome = 'succeeded' as never;
        if (fault === 'ineligible-heal') n.contract.issue.selfHeal.eligible = false as never;
        if (fault === 'missing-heal') n.contract.issue.selfHeal.attempt = '';
      }
      expect(await n.send(ALERTS, fault === 'text-substitution' ? 'different' : n.contract.text)).toMatchObject({ delivered: false, definite: true });
      expect(commitmentSends(w)).toEqual([]); expect(w.journal.view.commitmentStore?.sends ?? []).toEqual([]);
    } finally { w.close(); }
  });

it('the original conversation cannot be a notice destination even if both the grant and alerts setting name it', async () => {
  const w = world({ policy: policyFor() });
  try {
    await openTopic(w); const n = notice(w); n.state.alerts = TOPIC;
    expect(await n.send(TOPIC)).toMatchObject({ reason: 'notice-ineligible' });
    expect(commitmentSends(w)).toEqual([]);
  } finally { w.close(); }
});

it.each(['no-grant', 'wrong-grant', 'expired-grant', 'secret', 'stop', 'cap'])(
  'separate eligibility never bypasses %s', async floor => {
    const w = world({ policy: policyFor(ALERTS) });
    try {
      await openRoutes(w); const n = notice(w);
      if (floor === 'no-grant') w.state.policy = DEFAULT_EFFECT_POLICY;
      if (floor === 'wrong-grant') w.state.policy = policyFor(TOPIC);
      if (floor === 'expired-grant') w.state.policy = policyFor(ALERTS, { expiresAt: w.clock.now });
      if (floor === 'secret') n.contract.text = 'SECRET';
      if (floor === 'stop') w.state.stopped = true;
      if (floor === 'cap') w.journal.view.limits.maxReplies = w.journal.view.replies;
      expect(await n.send()).toMatchObject({ delivered: false, definite: true });
      expect(commitmentSends(w)).toEqual([]);
    } finally { w.close(); }
  });

it.each<Transport>([{ kind: 'unknown', reason: 'lost answer' }, 'throw'])(
  'ambiguous notice is retained under its causal episode and never duplicated on restart: %s', async outcome => {
    const w = world({ policy: policyFor(ALERTS) });
    try {
      await openRoutes(w); const n = notice(w); w.state.transport.push(outcome);
      expect(await n.send()).toMatchObject({ delivered: false, originHold: { logicalReplaySafe: false } });
      w.reopen();
      expect(await n.send()).toMatchObject({ delivered: false, originHold: { logicalReplaySafe: false } });
      expect(await n.doorway().resolveDelivery(n.contract.episode)).toBeUndefined();
      expect(commitmentSends(w)).toHaveLength(1);
      expect(commitmentStoreReport(w.journal.view)?.sends.unsettled).toEqual([n.contract.episode]);
    } finally { w.close(); }
  });

it('a definite refusal may retry, but a withdrawn producer finding or grant refuses the retry', async () => {
  const w = world({ policy: policyFor(ALERTS) });
  try {
    await openRoutes(w); const n = notice(w); w.state.transport.push({ kind: 'refused', reason: 'not sent' });
    expect(await n.send()).toMatchObject({ delivered: false, definite: true });
    n.state.contract = undefined;
    expect(await n.send()).toMatchObject({ reason: 'no-delivery-contract' });
    n.state.contract = n.contract; w.state.policy = DEFAULT_EFFECT_POLICY;
    expect(await n.send()).toMatchObject({ reason: 'no-send-grant' });
    w.state.policy = policyFor(ALERTS);
    expect(await n.send()).toMatchObject({ delivered: true });
    expect(commitmentSends(w)).toHaveLength(2);
  } finally { w.close(); }
});

it('the outbound classification does not label the legacy heartbeat as a result', async () => {
  const { OUTBOUND_DISPOSITIONS } = await import('../preview/journal.js');
  expect(OUTBOUND_DISPOSITIONS.commitment).toBe('status');
});

it('legacy unsettled and delivered intents replay without acquiring a new send contract or sending again', async () => {
  for (const delivered of [false, true]) {
    const w = world({ policy: policyFor(ALERTS) });
    try {
      await openRoutes(w); const n = notice(w), target = commitmentSendTarget(0);
      w.journal.append({ kind: 'commitment-send-intent', forward, ordinal: 0, logicalSendId: n.contract.episode, text: n.contract.text,
        chat: genesis.chat, thread: ALERTS, grant: genesis.grant, effectGrant: 'old-grant',
        provenance: w.journal.signOutbound('infrastructure', { target, chat: genesis.chat, thread: ALERTS, body: n.contract.text }), at: w.clock.now });
      if (delivered) w.journal.append({ kind: 'commitment-send-sent', forward, ordinal: 0, message: 900, at: w.clock.now });
      w.journal.compact(); w.reopen();
      const outcome = await n.send();
      expect(outcome).toMatchObject(delivered ? { outcome: 'already-delivered-recently' } : { originHold: { logicalReplaySafe: false } });
      expect(commitmentSends(w)).toEqual([]);
      expect(() => w.journal.append({ kind: 'commitment-send-intent', forward, ordinal: 1, logicalSendId: n.contract.episode,
        text: n.contract.text, chat: genesis.chat, thread: ALERTS, grant: genesis.grant, effectGrant: 'g',
        provenance: w.journal.signOutbound('infrastructure', { target: commitmentSendTarget(1), chat: genesis.chat, thread: ALERTS, body: n.contract.text }), at: w.clock.now })).toThrow();
    } finally { w.close(); }
  }
});

it('an accepted transport without a durable receipt remains unknown', async () => {
  const { createCommitmentDoorway } = await import('../preview/commitment-send.js');
  const w = world({ policy: policyFor(ALERTS) });
  try {
    await openRoutes(w); const n = notice(w);
    const doorway = createCommitmentDoorway({ journal: { get view() { return w.journal.view; }, signOutbound: (...args) => w.journal.signOutbound(...args),
      append(row) { if (row.kind === 'commitment-send-sent') throw Error('disk failed'); w.journal.append(row); } },
      admit: () => ({ admitted: true, grant: 'g' }), now: () => w.clock.now, stopped: () => false, checkOutbound() {},
      noticeProducer: { read: () => n.contract, alerts: () => ({ topic: ALERTS }) }, push: async () => ({ kind: 'accepted', message: 900 }) });
    expect(await doorway.send(ALERTS, n.contract.text, { logicalSendId: n.contract.episode })).toMatchObject({ delivered: false, originHold: { logicalReplaySafe: false } });
    w.reopen(); expect(await n.send()).toMatchObject({ delivered: false, originHold: { logicalReplaySafe: false } });
    expect(commitmentSends(w)).toEqual([]);
  } finally { w.close(); }
});

it('a producer withdrawal between durable intent and dispatch is rechecked before transport', async () => {
  const w = world({ policy: policyFor(ALERTS) });
  try {
    await openRoutes(w); const n = notice(w);
    let reads = 0;
    const doorway = w.worker.commitmentDoorway(() => ({ admitted: true, grant: 'g' }), {
      read: () => ++reads === 1 ? n.contract : undefined, alerts: () => ({ topic: ALERTS }) });
    expect(await doorway.send(ALERTS, n.contract.text, { logicalSendId: n.contract.episode })).toMatchObject({ delivered: false, definite: true });
    expect(w.journal.view.commitmentStore?.sends).toHaveLength(1);
    expect(commitmentSends(w)).toEqual([]);
    expect(w.journal.view.sendOutcomes).toMatchObject([{ target: commitmentSendTarget(0), outcome: 'refused' }]);
  } finally { w.close(); }
});
