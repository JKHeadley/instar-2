/** Row 01's eight behaviour classes through the owner journal, with the real worker for the mirror. Each case can
 * fail on the behaviour it names; the copied 1.x suites in ./1x prove the module logic beneath it. */
import { readFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createJournalWorker, openPreviewJournal } from '../preview/journal-test-worker.js';
import { durableProjection } from '../preview/journal.js';
import { commitmentStoreReport, createCommitmentHost, mirrorKey, type CommitmentHostPorts } from '../preview/commitment-host.js';
import { sentinelReport } from '../preview/live-sentinels.js';

const key = new Uint8Array(32).fill(41);
const START = Date.UTC(2026, 8, 26, 17);
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:commitments',
  configurationDigest: 'sha256:commitments', expires: Date.UTC(2026, 11, 20), maxCalls: 40, maxReplies: 20, maxTurns: 20,
  maxBytes: 16000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, date: Math.floor(START / 1000) + id, text } });

function world(options: CommitmentHostPorts['options'] = {}, extra: Partial<CommitmentHostPorts> = {}, model?: () => unknown) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'commitment-host-'))); roots.push(root);
  const path = join(root, 'journal.encrypted');
  const clock = { now: START };
  const config = new Map<string, unknown>(), files = new Set<string>(), sends: { topic: number; text: string; id: string }[] = [];
  const ports = (): CommitmentHostPorts => ({
    now: () => clock.now, minutesOfDay: ms => new Date(ms).getUTCHours() * 60 + new Date(ms).getUTCMinutes(),
    formatWhen: ms => new Date(ms).toISOString(), fileExists: file => files.has(file),
    config: { get: (name, fallback) => config.has(name) ? config.get(name) : fallback, set: (name, value) => { config.set(name, value); } },
    log() {}, options, ...extra,
  });
  let journal = openPreviewJournal(path, key, genesis);
  const sent: string[] = [];
  const workerPorts = { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: { id: string; question: string }) => model?.() ?? `answer: ${input.question}`,
    send: async (input: { text: string }) => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} };
  let worker = createJournalWorker(journal, workerPorts as never);
  let host = createCommitmentHost(journal, ports());
  return { path, clock, config, files, sends, sent, get journal() { return journal; }, get worker() { return worker; }, get host() { return host; },
    /** A new process over the same journal. */
    reopen() { host.stop(); journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, workerPorts as never); host = createCommitmentHost(journal, ports()); },
    close() { host.stop(); journal.close(); } };
}
const sent = (w: { sends: { topic: number; text: string; id: string }[] }): NonNullable<CommitmentHostPorts['send']> => async (topic, text, identity) => {
  w.sends.push({ topic, text, id: identity.logicalSendId }); return { delivered: true, outcome: 'delivered' }; };

it('lifecycle: a commitment survives restart and compaction, through the journal alone', () => {
  const w = world();
  try {
    w.host.tick();
    const c = w.host.tracker().record({ type: 'one-time-action', userRequest: 'keep it', agentResponse: 'kept', externalKey: 'ek-1', owner: 'agent', blockedOn: 'user-authorization', actionClass: 'merge' });
    expect(w.host.tracker().record({ type: 'one-time-action', userRequest: 'again', agentResponse: 'again', externalKey: 'ek-1' }).id).toBe(c.id);
    expect(() => w.host.tracker().transitionState(c.id, { blockedOn: 'user-authorization', actionClass: ' ' })).toThrow(/actionClass/);
    expect(() => w.host.tracker().record({ type: 'one-time-action', userRequest: 'x', agentResponse: 'x', blockedOn: 'user-authorization' })).toThrow(/actionClass/);
    w.reopen();
    expect(w.host.tracker().get(c.id)).toMatchObject({ externalKey: 'ek-1', blockedOn: 'user-authorization', actionClass: 'merge' });
    w.journal.compact(); w.reopen();
    expect(w.host.tracker().get(c.id)?.actionClass).toBe('merge');
    expect(w.host.tracker().withdraw(c.id, 'operator changed course')).toBe(true);
    w.reopen();
    expect(w.host.tracker().get(c.id)).toMatchObject({ status: 'withdrawn', resolution: 'operator changed course' });
    expect(durableProjection(w.journal.view).commitmentStore?.order).toEqual([c.id]);
  } finally { w.close(); }
});

it('lifecycle: a journal refusal leaves nothing applied and surfaces as a persistence failure', () => {
  const w = world();
  try {
    w.host.tick();
    const huge = 'x'.repeat(70_000);
    expect(() => w.host.tracker().record({ type: 'one-time-action', userRequest: huge, agentResponse: huge })).toThrow(/persistence failed/);
    expect(w.host.tracker().getAll()).toEqual([]);
    w.reopen();
    expect(w.host.tracker().getAll()).toEqual([]);
  } finally { w.close(); }
});

it('directive: a timer never closes a behavioural rule or a setting watch; supersession and completion do', () => {
  const w = world({ tracker: { autoExpiry: { enabled: true, dryRun: false, maxAgeDays: 1 }, operatorWait: { enabled: true, dryRun: false, maxAgeDays: 1 } } });
  try {
    w.host.tick();
    const t = w.host.tracker();
    const past = new Date(START - 60_000).toISOString();
    const rule = t.record({ type: 'behavioral', userRequest: 'always X', agentResponse: 'ok', behavioralRule: 'always X', expiresAt: past, owner: 'user' });
    const watch = t.record({ type: 'config-change', userRequest: 'keep A on', agentResponse: 'ok', configPath: 'a', configExpectedValue: true, expiresAt: past });
    const item = t.record({ type: 'one-time-action', userRequest: 'stale', agentResponse: 'ok', expiresAt: past });
    w.clock.now = START + 30 * 86_400_000;
    t.verify(); t.sweepAutoExpiry();
    expect(t.expire(rule.id, 'clock')).toBeNull();
    expect(t.get(rule.id)?.status).not.toBe('expired');
    expect(t.get(watch.id)?.status).not.toBe('expired');
    expect(t.getActive().map(row => row.id)).toEqual([rule.id, watch.id]);
    // The neighbour on the other side of the boundary does expire, honestly.
    expect(t.get(item.id)).toMatchObject({ status: 'expired', resolution: 'Expired' });
    expect(t.withdraw(rule.id, 'superseded by the operator')).toBe(true);
    expect(t.get(rule.id)?.status).toBe('withdrawn');
  } finally { w.close(); }
});

it('legacy rows: no import fabricates a delivery', () => {
  const w = world();
  try {
    w.journal.append({ kind: 'commitment-store', forward: { generation: 7, additive: true }, at: START,
      rows: [{ id: 'CMT-009', status: 'violated', type: 'one-time-action', userRequest: 'x', agentResponse: 'y', createdAt: new Date(START).toISOString(),
        verificationCount: 0, violationCount: 9, correctionCount: 0, correctionHistory: [], escalated: false, version: 3 }] });
    w.reopen(); w.host.tick();
    expect(w.host.tracker().get('CMT-009')).toMatchObject({ status: 'violated', owner: 'agent', blockedOn: 'none' });
    expect(w.host.tracker().get('CMT-009')?.deliveryMessageId).toBeUndefined();
  } finally { w.close(); }
});

it('config watch: drift is corrected on the sweep, three in an hour escalates once, and a topic path is no watch', () => {
  const w = world();
  try {
    w.host.tick();
    const t = w.host.tracker();
    w.config.set('updates.autoApply', false);
    const c = t.record({ type: 'config-change', userRequest: 'off', agentResponse: 'ok', configPath: 'updates.autoApply', configExpectedValue: false });
    expect(t.get(c.id)?.status).toBe('verified');
    for (let i = 0; i < 4; i++) { w.config.set('updates.autoApply', true); w.clock.now += 61_000; w.host.tick(); expect(w.config.get('updates.autoApply')).toBe(false); }
    expect(t.get(c.id)).toMatchObject({ escalated: true, correctionCount: 4 });
    // A conflicting newer watch supersedes the older one rather than flapping forever.
    const newer = t.record({ type: 'config-change', userRequest: 'on', agentResponse: 'ok', configPath: 'updates.autoApply', configExpectedValue: true });
    expect(t.get(c.id)).toMatchObject({ status: 'withdrawn', supersededBy: newer.id });
    expect(t.record({ type: 'config-change', userRequest: 'pin', agentResponse: 'ok', configPath: 'topic.model', configExpectedValue: 'x' })).toMatchObject({ type: 'one-time-action', verificationMethod: 'manual' });
  } finally { w.close(); }
});

it('behavioural: the rule reaches the journal, repairs when lost, and existing is not compliance', () => {
  const w = world();
  try {
    w.host.tick();
    const t = w.host.tracker();
    const c = t.record({ type: 'behavioral', userRequest: 'plain words', agentResponse: 'ok', behavioralRule: 'Use plain words' });
    expect(w.journal.view.commitmentStore?.rules).toContain('Use plain words');
    w.journal.append({ kind: 'commitment-store', forward: { generation: 7, additive: true }, at: w.clock.now, rules: null });
    w.host.tick();
    expect(t.verifyOne(c.id)).toBeNull();
    expect(w.journal.view.commitmentStore?.rules).toContain('Use plain words');
    expect(t.get(c.id)?.status).toBe('pending');
    expect(t.getHealth().message).toContain('not automatically verifiable');
  } finally { w.close(); }
});

it('one-time file check verifies, and a missing file does not', () => {
  const w = world();
  try {
    w.host.tick();
    const t = w.host.tracker();
    const c = t.record({ type: 'one-time-action', userRequest: 'write report', agentResponse: 'ok', verificationMethod: 'file-exists', verificationPath: '/agent/report.md' });
    expect(t.verifyOne(c.id)?.passed).toBe(false);
    w.files.add('/agent/report.md');
    expect(t.verifyOne(c.id)?.passed).toBe(true);
  } finally { w.close(); }
});

it('Threadline: thread lookup, arrival distinct from heartbeat, monotonic redrive, terminal excluded, all across restart', () => {
  const w = world();
  try {
    w.host.tick();
    const c = w.host.tracker().record({ type: 'one-time-action', verificationMethod: 'threadline-reply', relatedThreadId: 'thread-1', relatedAgent: 'peer', userRequest: 'q', agentResponse: 'a', topicId: 5, beaconEnabled: false });
    w.reopen(); w.host.tick();
    const t = w.host.tracker();
    expect(t.findByThreadId('thread-1')?.id).toBe(c.id);
    const before = t.get(c.id)!.heartbeatCount;
    expect(t.markReplyArrived(c.id, new Date(w.clock.now).toISOString())?.lastReplyAt).toBeTruthy();
    expect(t.get(c.id)?.heartbeatCount).toBe(before);
    expect(t.verifyOne(c.id)).toEqual({ passed: false, detail: 'Awaiting threadline reply' });
    expect(t.get(c.id)?.status).toBe('pending');
    expect(t.get(c.id)?.redriveCount).toBe(0);
    expect(t.deliver(c.id, 'reply-1')?.deliveryMessageId).toBe('reply-1');
    expect(t.findByThreadId('thread-1')).toBeNull();
  } finally { w.close(); }
});

it('probes: bounded, only on an external wait; a fresh one re-arms the once-per-episode surface; a superseder closes only on success', async () => {
  const attention: string[] = [];
  const w = world({ beacon: { userOutputEnabled: true, agentOwnedFollowthrough: () => ({ enabled: true, dryRun: false }) } }, { raiseAttention: id => { attention.push(id); } });
  try {
    w.host.tick();
    const t = w.host.tracker();
    const c = t.record({ type: 'one-time-action', userRequest: 'wait', agentResponse: 'a', owner: 'agent', blockedOn: 'external' });
    expect(t.recordProbe(c.id, { checked: ' ', readinessSignal: 'x' })).toBeNull();
    expect(t.recordProbe(c.id, { checked: 'x'.repeat(900), readinessSignal: 'not yet' })?.lastProbe?.checked).toHaveLength(500);
    w.clock.now += 25 * 3_600_000;
    await w.host.beacon().sweepExternalBlocks(); await w.host.beacon().sweepExternalBlocks();
    expect(attention).toEqual([c.id]);
    expect(t.get(c.id)?.status).toBe('pending');
    t.recordProbe(c.id, { checked: 'status page', readinessSignal: 'still down' });
    expect(t.get(c.id)?.externalBlockDeadLetteredAt).toBeUndefined();
    w.clock.now += 14 * 86_400_000 + 1;
    t.recordProbe(c.id, { checked: 'status page', readinessSignal: 'still down' });
    await w.host.beacon().sweepExternalBlocks();
    expect(attention).toEqual([c.id, c.id]); // the ceiling is not reset by a probe
    const later = t.record({ type: 'one-time-action', userRequest: 'b', agentResponse: 'b' });
    const old = t.record({ type: 'one-time-action', userRequest: 'a', agentResponse: 'a', supersededBy: later.id });
    expect(t.reconcileGraveyard().closed).toEqual([]);
    t.deliver(later.id);
    expect(t.reconcileGraveyard({ dryRun: true }).wouldClose).toEqual([old.id]);
    expect(t.reconcileGraveyard().closed).toEqual([old.id]);
  } finally { w.close(); }
});

it('blocker episodes survive restart with their bounded transitions and clear', () => {
  const w = world({ tracker: {} });
  try {
    w.host.tick();
    const t = w.host.tracker();
    const c = t.record({ type: 'one-time-action', userRequest: 'x', agentResponse: 'y', owner: 'agent' });
    t.transitionState(c.id, { blockedOn: 'external' });
    t.transitionState(c.id, { blockedOn: 'none' });
    expect(t.get(c.id)?.blockedOn).toBe('none');
    w.reopen();
    expect(w.host.tracker().get(c.id)?.blockedOn).toBe('none');
  } finally { w.close(); }
});

it('check-in: fires once when due; a restart between start and settlement never repeats it', async () => {
  let receipt: boolean | undefined;
  const holder: { w?: ReturnType<typeof world> } = {};
  const w = world({}, { send: (...args) => sent(holder.w!)(...args), resolveDelivery: async () => receipt });
  holder.w = w;
  try {
    w.host.tick();
    const due = new Date(START + 3_600_000).toISOString();
    const c = w.host.tracker().record({ type: 'one-time-action', userRequest: 'the benchmark', agentResponse: 'ok', topicId: 7, checkInAt: due });
    expect((await w.host.runCheckIns()).due).toBe(0);
    w.clock.now = START + 3_600_000;
    expect((await w.host.runCheckIns()).sent).toBe(1);
    expect(w.sends).toMatchObject([{ topic: 7, id: `${c.id}:check-in` }]);
    expect(w.sends[0]!.text).toContain('the benchmark');
    expect(w.sends[0]!.text).toContain('not a status update');
    await w.host.runCheckIns();
    expect(w.sends).toHaveLength(1);
    // Crash window: start recorded, result not.
    const second = w.host.tracker().record({ type: 'one-time-action', userRequest: 'other', agentResponse: 'ok', topicId: 7, checkInAt: due });
    await w.host.tracker().mutate(second.id, row => ({ ...row, checkInReminderAttempts: 1, checkInReminderSendStartedAt: due }));
    w.reopen(); w.host.tick();
    await w.host.runCheckIns();
    expect(w.sends).toHaveLength(1);
    expect(w.host.report().checkInsUnsettled).toEqual([`${second.id}:check-in`]);
    receipt = true;
    await w.host.runCheckIns();
    expect(w.sends).toHaveLength(1);
    expect(w.host.tracker().get(second.id)?.checkInReminderSentAt).toBeTruthy();
  } finally { w.close(); }
});

it('check-in: no send grant is a retained definite refusal, bounded to five attempts, never a stamp', async () => {
  const w = world();
  try {
    w.host.tick();
    const c = w.host.tracker().record({ type: 'one-time-action', userRequest: 'x', agentResponse: 'y', topicId: 7, checkInAt: new Date(START).toISOString() });
    for (let i = 0; i < 7; i++) await w.host.runCheckIns();
    expect(w.host.tracker().get(c.id)).toMatchObject({ checkInReminderAttempts: 5 });
    expect(w.host.tracker().get(c.id)?.checkInReminderSentAt).toBeUndefined();
    expect(w.host.tracker().get(c.id)?.checkInReminderFailedAt).toBeTruthy();
    expect(w.host.report().checkInsFailed).toEqual([c.id]);
  } finally { w.close(); }
});

it('cadence: the declared horizon sets the tuned numbers; reply words alone never do (Rule 10)', () => {
  const w = world();
  try {
    w.host.tick();
    const t = w.host.tracker();
    expect(t.record({ type: 'one-time-action', userRequest: 'x', agentResponse: 'back in 20 minutes', topicId: 1 }).beaconEnabled).toBeUndefined();
    const c = t.record({ type: 'one-time-action', userRequest: 'x', agentResponse: 'anything', topicId: 1, horizon: { kind: 'duration', ms: 20 * 60_000 } });
    expect(c).toMatchObject({ beaconEnabled: true, cadenceMs: 10 * 60_000 });
    expect(Date.parse(c.hardDeadlineAt!) - START).toBe(3_600_000);
  } finally { w.close(); }
});

it('cadence: newest 20 keep beacons, overflow stays open and suppressed; silence stays non-terminal', async () => {
  const w = world();
  try {
    const t = w.host.tracker();
    const ids: string[] = [];
    for (let i = 0; i < 22; i++) { w.clock.now = START + i; ids.push(t.record({ type: 'one-time-action', userRequest: `r${i}`, agentResponse: 'a', topicId: 3, beaconEnabled: true, cadenceMs: 60_000 }).id); }
    w.host.tick();
    await new Promise(resolve => setImmediate(resolve));
    expect(w.host.beacon().getScheduledIds()).toHaveLength(20);
    expect(t.get(ids[0]!)).toMatchObject({ status: 'pending', beaconSuppressed: true, beaconSuppressionReason: 'boot-cap-exceeded' });
    expect(t.get(ids[21]!)?.beaconSuppressed).toBeFalsy();
    // Default output-off: the anchor advances durably, nothing is sent, and it stays open.
    await w.host.beacon().fire(ids[21]!);
    expect(t.get(ids[21]!)).toMatchObject({ status: 'pending' });
    expect(t.get(ids[21]!)?.lastHeartbeatAt).toBeTruthy();
    expect(w.sends).toEqual([]);
  } finally { w.close(); }
});

it('revival: attempt persisted before the spawn; the floor, the global cap and three attempts hold across restart; give-up stays open and visible', async () => {
  const requests: string[] = [];
  const epochs = new Map<string, string>();
  let revive: () => Promise<{ sessionName: string | null; refusalReason?: 'quota' }> = async () => ({ sessionName: 'revived' });
  const attention: string[] = [];
  const w = world({ beacon: { userOutputEnabled: false, escalation: { enabled: true, dryRun: false }, getSessionEpoch: () => null } },
    { requestRevive: async request => { requests.push(request.escalationAttemptId); return revive(); }, raiseAttention: id => { attention.push(id); } });
  try {
    w.host.tick();
    const c = w.host.tracker().record({ type: 'one-time-action', userRequest: 'r', agentResponse: 'a', topicId: 3, beaconEnabled: true, cadenceMs: 60_000, sessionEpoch: 'old' });
    await w.host.beacon().fire(c.id);
    expect(requests).toHaveLength(1);
    expect(w.host.tracker().get(c.id)).toMatchObject({ escalationAttempts: 1, escalationInFlight: true, revivalMode: 'status-only-until-revalidated' });
    // Still settling, then past settle + grace without a confirmed session: not confirmed.
    w.clock.now += 29_000; await w.host.beacon().fire(c.id);
    expect(w.host.tracker().get(c.id)?.escalationInFlight).toBe(true);
    w.clock.now += 12_000; await w.host.beacon().fire(c.id);
    expect(w.host.tracker().get(c.id)?.escalationInFlight).toBe(false);
    // Floor: a restart does not reset it, and the attempt is not repeated early.
    w.reopen(); w.host.tick();
    await w.host.beacon().fire(c.id);
    expect(requests).toHaveLength(1);
    w.clock.now += 120_000; await w.host.beacon().fire(c.id);
    expect(requests).toHaveLength(2);
    w.clock.now += 41_000; await w.host.beacon().fire(c.id);
    w.clock.now += 240_000; await w.host.beacon().fire(c.id);
    expect(requests).toHaveLength(3);
    w.clock.now += 41_000; await w.host.beacon().fire(c.id);
    w.clock.now += 480_000; await w.host.beacon().fire(c.id);
    expect(requests).toHaveLength(3);
    expect(w.host.tracker().get(c.id)).toMatchObject({ status: 'violated', resolution: 'session-lost-unrecovered', currentRung: '3' });
    expect(w.host.tracker().getActive().map(row => row.id)).toContain(c.id);
    expect(epochs.size).toBe(0);
    revive = async () => ({ sessionName: null, refusalReason: 'quota' });
  } finally { w.close(); }
});

it('revival: a refused spawn counts the attempt and becomes one bounded honest status with output on', async () => {
  const holder: { w?: ReturnType<typeof world> } = {};
  const w = world({ beacon: { userOutputEnabled: true, escalation: { enabled: true, dryRun: false }, getSessionEpoch: () => null } },
    { requestRevive: async () => ({ sessionName: null, refusalReason: 'quota' }), send: (...args) => sent(holder.w!)(...args) });
  holder.w = w;
  try {
    w.host.tick();
    const c = w.host.tracker().record({ type: 'one-time-action', userRequest: 'r', agentResponse: 'finish the report', topicId: 3, beaconEnabled: true, cadenceMs: 60_000, sessionEpoch: 'old' });
    await w.host.beacon().fire(c.id);
    expect(w.host.tracker().get(c.id)).toMatchObject({ escalationAttempts: 1, escalationInFlight: false, refusalReason: 'quota', rung2NotificationCount: 1, currentRung: '2', atRisk: true });
    expect(w.sends).toHaveLength(1);
    expect(w.sends[0]!.text).toContain('at capacity');
  } finally { w.close(); }
});

it('delivery: output off sends nothing at all; a stand-down neither counts nor repeats; a frozen aggregate survives restart byte for byte', async () => {
  const off = world();
  try {
    off.host.tick();
    const c = off.host.tracker().record({ type: 'one-time-action', userRequest: 'r', agentResponse: 'a', topicId: 3, beaconEnabled: true, cadenceMs: 60_000 });
    await off.host.beacon().fire(c.id);
    expect(off.sends).toEqual([]);
  } finally { off.close(); }

  const outcomes: Awaited<ReturnType<NonNullable<CommitmentHostPorts['send']>>>[] = [
    { delivered: false, outcome: 'not-delivered', reason: 'send-failed' }, { delivered: true, outcome: 'delivered' }];
  const texts: { text: string; id: string }[] = [];
  const w = world({ beacon: { userOutputEnabled: true } }, { send: async (_topic, text, identity) => { texts.push({ text, id: identity.logicalSendId }); return outcomes.shift()!; } });
  try {
    w.host.tick();
    const t = w.host.tracker();
    // A near hard deadline is the honest reason an otherwise silent tick speaks.
    const near = new Date(START + 100_000).toISOString();
    const a = t.record({ type: 'one-time-action', userRequest: 'alpha', agentResponse: 'alpha work', topicId: 3, beaconEnabled: true, cadenceMs: 60_000, hardDeadlineAt: near });
    const b = t.record({ type: 'one-time-action', userRequest: 'beta', agentResponse: 'beta work', topicId: 3, beaconEnabled: true, cadenceMs: 120_000, hardDeadlineAt: near });
    await w.host.beacon().fire(a.id);
    expect(texts).toHaveLength(1);
    const frozen = texts[0]!;
    // Transient: the prefix freezes; a newer qualification waits behind it. Restart keeps both.
    await w.host.beacon().fire(b.id);
    expect(texts).toHaveLength(1);
    w.reopen(); w.host.tick();
    w.clock.now += 60_000;
    await w.host.beacon().flushTopicAggregate(3);
    expect(texts).toHaveLength(2);
    expect(texts[1]).toEqual(frozen);
    expect(w.host.tracker().get(a.id)?.status).toBe('pending');
    expect(w.journal.view.commitmentStore?.aggregates['3']).toMatchObject({ pending: [{ commitmentId: b.id }] });
  } finally { w.close(); }
});

it('stale items: review is durable, dry-run by default; an external wait, a future deadline and another machine\'s row are protected', () => {
  const w = world({ tracker: { originMachineId: 'here', operatorWait: { enabled: false } } });
  try {
    w.host.tick();
    const t = w.host.tracker();
    const stale = t.record({ type: 'one-time-action', userRequest: 'stale', agentResponse: 'a', owner: 'agent' });
    const waiting = t.record({ type: 'one-time-action', userRequest: 'waiting', agentResponse: 'a', owner: 'agent', blockedOn: 'external' });
    const dated = t.record({ type: 'one-time-action', userRequest: 'dated', agentResponse: 'a', owner: 'agent', hardDeadlineAt: new Date(START + 60 * 86_400_000).toISOString() });
    w.clock.now = START + 30 * 86_400_000;
    const report = t.sweepAutoExpiry();
    expect(report).toMatchObject({ dryRun: true, eligible: 1, expired: 0 });
    expect(report.dispositions.map(item => item.id)).toEqual([stale.id]);
    expect(t.get(stale.id)?.status).toBe('pending');
    expect(t.get(waiting.id)?.status).toBe('pending');
    expect(t.get(dated.id)?.status).toBe('pending');
    expect(w.host.report().lastSweep).toMatchObject({ eligible: 1, items: [{ id: stale.id, applied: false, class: 'no-activity' }] });
    w.reopen();
    expect(w.host.report().lastSweep).toMatchObject({ eligible: 1 });
  } finally { w.close(); }
});

it('mirror: an admitted reply promise is tracked one way; the journal closure closes the mirror, never the reverse', async () => {
  const fixture = JSON.parse(readFileSync(new URL('../preview/fixtures/rule10-a5a-revision-2026-10-14.json', import.meta.url), 'utf8')) as { revisedDelivered: string };
  const quote = fixture.revisedDelivered;
  const w = world({}, {}, () => JSON.stringify({ reply: quote, promises: [{ quote }] }));
  try {
    w.worker.intake([update(715676157, 'Please answer the request.')]);
    await w.worker.drain();
    w.host.tick(); w.host.tick();
    const mirrored = w.host.tracker().getAll().filter(row => row.externalKey === mirrorKey(0));
    expect(mirrored).toHaveLength(1);
    expect(mirrored[0]).toMatchObject({ owner: 'agent', blockedOn: 'none', status: 'pending', verificationMethod: 'manual' });
    w.host.tracker().withdraw(mirrored[0]!.id, 'mirror row closed');
    expect(w.journal.view.closed.has(0)).toBe(false);
    w.reopen(); w.host.tick();
    // A closed mirror of a still-open note is not re-recorded on every tick.
    expect(w.host.tracker().getAll().filter(row => row.externalKey === mirrorKey(0))).toHaveLength(1);
  } finally { w.close(); }
});

it('another owner\'s rows win: a host that stood by rebuilds from the journal', () => {
  const w = world();
  try {
    w.host.tick();
    w.journal.append({ kind: 'commitment-store', forward: { generation: 7, additive: true }, at: START,
      rows: [{ id: 'CMT-777', status: 'pending', type: 'one-time-action', userRequest: 'from the peer', agentResponse: 'a', createdAt: new Date(START).toISOString(),
        verificationCount: 0, violationCount: 0, correctionCount: 0, correctionHistory: [], escalated: false, version: 0 }] });
    expect(w.host.tracker().get('CMT-777')).toBeNull();
    w.host.tick();
    expect(w.host.tracker().get('CMT-777')?.userRequest).toBe('from the peer');
    expect(w.host.tracker().record({ type: 'one-time-action', userRequest: 'x', agentResponse: 'y' }).id).toBe('CMT-778');
  } finally { w.close(); }
});

it('a stop holds everything: no sweep, no beacon step and no mirror on the tick', () => {
  const w = world({ tracker: { autoExpiry: { enabled: true, dryRun: false, maxAgeDays: 1 } } });
  try {
    w.host.tick();
    const c = w.host.tracker().record({ type: 'one-time-action', userRequest: 'x', agentResponse: 'y', owner: 'agent' });
    w.clock.now = START + 10 * 86_400_000;
    const frames = w.journal.view.commitmentStore!.frames;
    w.clock.now = genesis.expires + 1;
    expect(w.host.tick()).toEqual({ ran: 0, failures: [] });
    expect(w.journal.view.commitmentStore!.frames).toBe(frames);
    expect(w.host.tracker().get(c.id)?.status).toBe('pending');
  } finally { w.close(); }
});

it('status reads only the journal, so a second machine reports the same rows', () => {
  const w = world();
  try {
    w.host.tick();
    w.host.tracker().record({ type: 'one-time-action', userRequest: 'x', agentResponse: 'y', owner: 'agent', blockedOn: 'external' });
    expect(commitmentStoreReport(w.journal.view)).toMatchObject({ tracked: 1, open: 1, waiting: 1 });
    expect(sentinelReport(w.journal.view).commitments).toMatchObject({ tracked: 1 });
  } finally { w.close(); }
});

it('a failing step is counted for status and does not stop the next one', () => {
  const w = world({}, { config: { get: () => { throw Error('setting store unavailable'); }, set() {} } });
  try {
    w.host.tick();
    w.host.tracker().record({ type: 'one-time-action', userRequest: 'x', agentResponse: 'y', owner: 'agent', externalKey: 'kept' });
    const c = w.host.tracker().getAll()[0]!;
    w.clock.now += 16_000;
    const original = w.host.tracker().verify;
    w.host.tracker().verify = () => { throw Error('sweep failed'); };
    expect(w.host.tick().failures).toEqual(['sweep failed']);
    w.host.tracker().verify = original;
    expect(w.host.report().tickFailures).toBe(1);
    expect(w.host.tracker().get(c.id)?.status).toBe('pending');
  } finally { w.close(); }
});
