import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, limitedAnswerText, openPreviewJournal, openRequests } from './journal-test-worker.js';
import { statusReply } from './status-command.js';
import { createLiveSentinels, createOrdinaryLane, sentinelCycle, sentinelReport, sentinelStatusLines, type LiveSentinelPorts } from './live-sentinels.js';
import { SENTINEL_FAMILIES, type SentinelFamily } from './sentinel-record.js';
import { defaultSentinelConfig } from '../../src/awareness/sentinel.js';
import { defaultPresenceConfig } from '../../src/sentinels/presence.js';
import { defaultPromiseConfig } from '../../src/sentinels/promise.js';
import { createJournalShipper, localReplicaClient, openReplicaStore } from './journal-replication.js';

// Recorded live shapes (Rule 106 / observer #106): the four held turns of 2026-09-27, update ids and texts verbatim.
const recorded = JSON.parse(readFileSync(new URL('./fixtures/held-reply-live-2026-09-27.json', import.meta.url), 'utf8')) as {
  held: { update: number; text: string; cause: string; workerShape: string }[] };
const key = new Uint8Array(32).fill(41);
const START = Date.UTC(2026, 8, 26, 17); // Saturday 10:00 in Los Angeles.
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:sentinels',
  configurationDigest: 'sha256:sentinels', expires: Date.UTC(2026, 9, 20), maxCalls: 40, maxReplies: 20, maxTurns: 20,
  maxBytes: 16000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, date: Math.floor(START / 1000) + id, text } });
const summaryAnswer = JSON.stringify({ summary: 'The operator asked a few ordinary questions.', people: [], memory: [], commitments: [], questions: [] });

function harness(options: { families?: SentinelFamily[]; model?: (input: { id: string; question: string }) => unknown } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-sentinels-'))); roots.push(root);
  const path = join(root, 'journal.encrypted');
  const clock = { now: START, stopped: false };
  const sent: string[] = [], effects: string[] = [];
  let journal = openPreviewJournal(path, key, genesis);
  const workerPorts = { now: () => clock.now, stopped: () => clock.stopped, timeZone: 'America/Los_Angeles',
    model: async (input: { id: string; question: string; context: string }) => options.model?.(input)
      ?? (input.id.startsWith('summary:') ? summaryAnswer : `answer: ${input.question}`),
    send: async (input: { text: string }) => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} };
  let worker = createJournalWorker(journal, workerPorts as never);
  const sentinelPorts = (): LiveSentinelPorts => ({ now: () => clock.now, stopped: () => clock.stopped, startedAt: START,
    families: new Set(options.families ?? SENTINEL_FAMILIES),
    reground: operation => effects.push(`reground ${operation}`), recoverContext: operation => effects.push(`recover ${operation}`),
    selfHeal: turn => effects.push(`self-heal ${turn}`), actOnPromise: id => effects.push(`promise ${id}`) });
  let sentinels = createLiveSentinels(journal, sentinelPorts());
  return { root, path, clock, sent, effects, get journal() { return journal; }, get worker() { return worker; },
    get sentinels() { return sentinels; },
    reopen(extra: { presenceNotes?: boolean } = {}) { journal.close(); journal = openPreviewJournal(path, key);
      worker = createJournalWorker(journal, { ...workerPorts, ...extra } as never); sentinels = createLiveSentinels(journal, sentinelPorts()); },
    close() { journal.close(); } };
}

it('context: a launch opens a respawn episode and the first answered call on the current frontier verifies it', async () => {
  const world = harness({ families: ['context'] });
  try {
    world.worker.intake([update(1, 'What should I plant in October?')]);
    expect(world.sentinels.tick().recorded).toEqual(['context']);
    expect(sentinelReport(world.journal.view).context?.episode).toMatchObject({ kind: 'respawn', status: 'awaiting-receipt' });
    await world.worker.drain();
    world.clock.now += 1000;
    world.sentinels.tick();
    const report = sentinelReport(world.journal.view);
    expect(report.context?.episode).toMatchObject({ kind: 'respawn', status: 'recovered' });
    expect(report.events.map(event => event.event)).toContain('grounding-verified');
    expect(statusReply(world.journal.view, world.clock.now, 'America/Los_Angeles')).toContain('Sentinels: context respawn episode recovered');
    // Replay rebuilds exactly what the sentinel decided.
    const before = JSON.stringify(world.journal.view.sentinels);
    world.reopen();
    expect(JSON.stringify(world.journal.view.sentinels)).toBe(before);
  } finally { world.close(); }
});

it('context: with no open message the episode defers; past the grace an idle open message gets one re-ground request', async () => {
  const world = harness({ families: ['context'] });
  try {
    world.sentinels.tick();
    world.clock.now += defaultSentinelConfig.graceMs * 3;
    world.sentinels.tick();
    expect(sentinelReport(world.journal.view).context?.episode?.status).toBe('deferring');
    expect(world.effects).toEqual([]);
    world.worker.intake([update(1, 'Are you there?')]);
    world.sentinels.tick();
    expect(world.effects).toEqual([expect.stringMatching(/^reground awareness-reground:journal-context:respawn:/u)]);
    expect(sentinelReport(world.journal.view).context?.episode).toMatchObject({ status: 'verifying', attempts: 1 });
    // The requested pass is the runner's own drain; its grounded answer closes the episode.
    await world.worker.drain();
    world.clock.now += 1000;
    world.sentinels.tick();
    expect(sentinelReport(world.journal.view).context?.episode?.status).toBe('recovered');
    expect(world.effects).toHaveLength(1);
  } finally { world.close(); }
});

it('context: a summary after launch is a compaction episode, verified only by a call carrying that frontier', async () => {
  const world = harness({ families: ['context'] });
  try {
    for (let id = 1; id <= 3; id++) { world.worker.intake([update(id, `question ${id}`)]); await world.worker.drain(); world.clock.now += 1000; }
    world.sentinels.tick();
    await world.worker.summarizeIfNeeded(true);
    expect(world.journal.view.summaries.length).toBeGreaterThan(0);
    world.clock.now += 1000;
    world.sentinels.tick();
    expect(sentinelReport(world.journal.view).context?.episode).toMatchObject({ kind: 'compact', status: 'awaiting-receipt' });
    world.worker.intake([update(4, 'and one more')]); await world.worker.drain();
    world.clock.now += 1000;
    world.sentinels.tick();
    expect(sentinelReport(world.journal.view).context?.episode).toMatchObject({ kind: 'compact', status: 'recovered' });
  } finally { world.close(); }
});

it('context: input too long for its context is handed to the summary pass, bounded by the cooldown', async () => {
  const world = harness({ families: ['context'] });
  try {
    world.worker.intake([update(1, `Please read all of this: ${'lorem ipsum '.repeat(2000)}`)]);
    await world.worker.drain();
    expect(world.journal.view.order[0]?.noticeClass).toBe('too-long-input');
    world.sentinels.tick();
    expect(world.effects).toEqual([expect.stringMatching(/^recover awareness-recover:journal-context:1:/u)]);
    expect(sentinelReport(world.journal.view).events.map(event => event.event)).toContain('context-wall');
    world.clock.now += 1000;
    world.sentinels.tick();
    expect(world.effects).toHaveLength(1);
    world.clock.now += 600_000;
    world.sentinels.tick();
    expect(world.effects).toHaveLength(2);
  } finally { world.close(); }
});

it('wiring: a recovery the context sentinel records runs inside the admitted ordinary job; a busy lane defers the tick', async () => {
  const world = harness({ families: ['context'] });
  try {
    world.worker.intake([update(1, `Please read all of this: ${'lorem ipsum '.repeat(2000)}`)]);
    await world.worker.drain();
    expect(world.journal.view.order[0]?.noticeClass).toBe('too-long-input');
    // The runner's real lane and cycle; the recovery port queues the forced summary pass exactly as the runner does.
    const requested: (() => Promise<unknown>)[] = [], recoveries: string[] = [];
    const lane = createOrdinaryLane({ elapsed: () => world.clock.now, peerCurrent: () => true, after: () => {} });
    const sentinels = createLiveSentinels(world.journal, { now: () => world.clock.now, startedAt: START, stopped: () => false,
      families: new Set(['context']), reground: () => requested.push(() => world.worker.drain()),
      recoverContext: operation => requested.push(async () => { recoveries.push(operation); await world.worker.summarizeIfNeeded(true); }),
      selfHeal: () => {}, actOnPromise: () => {} });
    const cycle = () => sentinelCycle(lane, { tick: () => { sentinels.tick(); }, requested, drain: () => world.worker.drain(),
      after: async () => {} });
    // A busy neighbour holds the lane: the tick is deferred, so nothing is recorded and nothing counts as attempted.
    let release!: () => void;
    expect(lane.submit(() => new Promise<void>(done => { release = done; }))).toBe(true);
    expect(cycle()).toBe(false);
    expect(world.journal.view.sentinels).toBeUndefined();
    expect(requested).toEqual([]);
    release(); await lane.settle();
    // Admitted: the recorded recovery executes inside this cycle's job, after its drain.
    expect(cycle()).toBe(true);
    await lane.settle();
    expect(recoveries).toEqual([expect.stringMatching(/^awareness-recover:journal-context:1:/u)]);
    expect(sentinelReport(world.journal.view).context?.recoveries).toBe(1);
    // Each later recorded recovery executes too: never more recorded attempts than executed ones.
    for (let i = 0; i < 2; i++) { world.clock.now += 600_000; cycle(); await lane.settle(); }
    expect(recoveries.length).toBe(sentinelReport(world.journal.view).context?.recoveries);
    expect(requested).toEqual([]);
  } finally { world.close(); }
});

it('wiring, two machines: the tick\'s own record cannot revoke its admission; the requested self-heal runs before any holding note', async () => {
  const live = recorded.held.find(item => item.cause === 'reply check unavailable')!;
  const world = harness({ families: ['presence'] });
  try {
    world.worker.intake([update(live.update, live.text)]);
    const id = world.journal.view.order[0]!.id;
    world.journal.append({ kind: 'hold', id, reason: live.cause, at: world.clock.now });
    // The real shipper and replica store: the peer is current only while it holds the journal's whole length,
    // so any sentinel frame appended before the lane's admission check would decline the job.
    const store = openReplicaStore({ directory: join(world.root, 'replica'), conversation: 'telegram/bot-12345678/chat-7654321',
      machine: 'laptop', secret: 'sentinel-wiring-secret-0123456789' });
    const shipper = createJournalShipper({ path: world.path, size: () => world.journal.size, peer: localReplicaClient(store),
      conversation: 'telegram/bot-12345678/chat-7654321', machine: 'studio', secret: 'sentinel-wiring-secret-0123456789',
      epoch: () => 1, monotonic: () => world.clock.now });
    const requested: (() => Promise<unknown>)[] = [], healed: string[] = [];
    const lane = createOrdinaryLane({ elapsed: () => world.clock.now, peerCurrent: () => shipper.status(60_000).current, after: () => {} });
    const sentinels = createLiveSentinels(world.journal, { now: () => world.clock.now, startedAt: START, stopped: () => false,
      families: new Set(['presence']), reground: () => {}, recoverContext: () => {}, actOnPromise: () => {},
      selfHeal: turn => requested.push(async () => { healed.push(turn); }) });
    const cycle = async () => {
      expect(await shipper.drain()).toBe(true);
      expect(shipper.status(60_000).current).toBe(true);
      const admitted = sentinelCycle(lane, { tick: () => { sentinels.tick(); }, requested, drain: async () => {}, after: async () => {} });
      await lane.settle();
      return admitted;
    };
    world.clock.now += defaultPresenceConfig.thresholdMs;
    expect(await cycle()).toBe(true);
    // The recorded self-heal request executed inside the same admitted job; nothing is left queued.
    expect(sentinelReport(world.journal.view).presence.selfHealRequested).toBe(1);
    expect(healed).toEqual([id]);
    expect(requested).toEqual([]);
    expect(sentinelReport(world.journal.view).presence.holdingNoteDue).toEqual([]);
    world.clock.now += defaultPresenceConfig.healWindowMs;
    expect(await cycle()).toBe(true);
    expect(sentinelReport(world.journal.view).presence.holdingNoteDue).toEqual([id]);
    // Exactly one self-heal was recorded and exactly one executed, before the note fell due.
    expect(healed).toEqual([id]);
  } finally { world.close(); }
});

it('wiring: a backing-off or peer-waiting lane defers the tick; a failed drain still runs the requested step', async () => {
  const world = harness({ families: ['context'] });
  try {
    world.worker.intake([update(1, `Please read all of this: ${'lorem ipsum '.repeat(2000)}`)]);
    await world.worker.drain();
    let peer = false;
    const requested: (() => Promise<unknown>)[] = [], ran: string[] = [];
    const lane = createOrdinaryLane({ elapsed: () => world.clock.now, peerCurrent: () => peer, after: () => {} });
    const sentinels = createLiveSentinels(world.journal, { now: () => world.clock.now, startedAt: START, stopped: () => false,
      families: new Set(['context']), reground: () => requested.push(async () => { ran.push('reground'); }),
      recoverContext: () => requested.push(async () => { ran.push('recover'); }), selfHeal: () => {}, actOnPromise: () => {} });
    const cycle = (drain: () => Promise<unknown>) => sentinelCycle(lane, { tick: () => { sentinels.tick(); }, requested, drain,
      after: async () => { ran.push('after'); } });
    expect(cycle(async () => {})).toBe(false);
    expect(world.journal.view.sentinels).toBeUndefined();
    peer = true;
    expect(cycle(async () => { throw Error('drain failed'); })).toBe(true);
    await lane.settle();
    expect(ran).toEqual(['recover']);
    // The failure backs the lane off: the next cycle is deferred and records nothing new.
    const counts = { ...world.journal.view.sentinels!.counts };
    world.clock.now += 500;
    expect(cycle(async () => {})).toBe(false);
    expect(world.journal.view.sentinels!.counts).toEqual(counts);
  } finally { world.close(); }
});

it('presence off-switch: a holding note already marked due is not sent after a restart with presence disabled', async () => {
  const live = recorded.held.find(item => item.cause === 'reply check unavailable')!;
  for (const enabled of [false, true]) {
    const world = harness({ families: ['presence'] });
    try {
      world.worker.intake([update(live.update, live.text)]);
      const id = world.journal.view.order[0]!.id;
      world.journal.append({ kind: 'hold', id, reason: live.cause, at: world.clock.now });
      world.clock.now += defaultPresenceConfig.thresholdMs;
      world.sentinels.tick();
      world.clock.now += defaultPresenceConfig.healWindowMs;
      world.sentinels.tick();
      expect(sentinelReport(world.journal.view).presence.holdingNoteDue).toEqual([id]);
      world.reopen({ presenceNotes: enabled });
      await world.worker.minimal();
      expect(world.sent).toEqual(enabled ? [limitedAnswerText(world.journal.view, 'worker', 1)] : []);
      // The saved decision stays for audit either way (a later enabled tick closes it once answered).
      expect(sentinelReport(world.journal.view).presence.holdingNoteDue).toEqual([id]);
      expect(world.journal.view.order[0]?.limited?.reason).toBe(enabled ? 'worker' : undefined);
    } finally { world.close(); }
  }
});

it('presence: a held recorded live turn gets one self-heal, then one honest infrastructure holding note', async () => {
  const live = recorded.held.find(item => item.cause === 'reply check unavailable')!;
  const world = harness({ families: ['presence'] });
  try {
    world.worker.intake([update(live.update, live.text)]);
    const id = world.journal.view.order[0]!.id;
    expect(id).toBe(`telegram:12345678:update:${live.update}`);
    world.journal.append({ kind: 'hold', id, reason: live.cause, at: world.clock.now });
    world.clock.now += defaultPresenceConfig.thresholdMs - 1;
    world.sentinels.tick(); await world.worker.minimal();
    expect({ effects: world.effects, sent: world.sent }).toEqual({ effects: [], sent: [] });
    world.clock.now += 1;
    world.sentinels.tick(); await world.worker.minimal();
    expect(world.effects).toEqual([`self-heal ${id}`]);
    expect(world.sent).toEqual([]);
    world.clock.now += defaultPresenceConfig.healWindowMs;
    world.sentinels.tick();
    expect(sentinelReport(world.journal.view).presence.holdingNoteDue).toEqual([id]);
    await world.worker.minimal();
    expect(world.sent).toEqual([limitedAnswerText(world.journal.view, 'worker', 1)]);
    expect(world.sent[0]).not.toMatch(/working on it/iu);
    expect(world.journal.view.order[0]?.limited?.reason).toBe('worker');
    // Sent once: later ticks and minimal steps add nothing, across a restart too.
    world.clock.now += 3_600_000;
    world.sentinels.tick(); await world.worker.minimal();
    world.reopen();
    world.sentinels.tick(); await world.worker.minimal();
    expect(world.sent).toHaveLength(1);
    expect(statusReply(world.journal.view, world.clock.now, 'America/Los_Angeles')).toContain('presence watching 1 unanswered (1 holding note due)');
  } finally { world.close(); }
});

it('presence: the recorded live shape that already carries its own notice stays silent (no second message)', async () => {
  const live = recorded.held.find(item => item.workerShape.startsWith('ended uncertain'))!;
  const world = harness({ families: ['presence'], model: input => input.id.startsWith('summary:') ? summaryAnswer : { state: 'uncertain' } });
  try {
    world.worker.intake([update(live.update, live.text)]);
    await world.worker.drain();
    world.clock.now += 60 * 60_000;
    await world.worker.drain();
    const before = world.sent.length;
    for (let step = 0; step < 4; step++) { world.clock.now += defaultPresenceConfig.thresholdMs; world.sentinels.tick(); await world.worker.minimal(); }
    expect(world.effects).toEqual([]);
    expect(world.sent).toHaveLength(before);
    expect(sentinelReport(world.journal.view).presence.holdingNoteDue).toEqual([]);
  } finally { world.close(); }
});

it('presence: a memory decision waiting on the operator is never narrated as the responder being unavailable', async () => {
  const world = harness({ families: ['presence'] });
  try {
    world.worker.intake([update(1, 'Actually my locker code changed.')]);
    const id = world.journal.view.order[0]!.id;
    world.journal.append({ kind: 'hold', id, reason: 'memory correction pending', at: world.clock.now });
    for (let step = 0; step < 4; step++) { world.clock.now += defaultPresenceConfig.thresholdMs; world.sentinels.tick(); await world.worker.minimal(); }
    expect(world.effects).toEqual([]);
    expect(world.sent).toEqual([]);
    expect(sentinelReport(world.journal.view).events.map(event => event.event)).toEqual(['unanswered-observed']);
  } finally { world.close(); }
});

const requestModel = (input: { id: string; question: string }) => {
  if (input.id.startsWith('summary:')) return summaryAnswer;
  if (input.id.startsWith('requested-action:')) return 'Here is the reminder you asked for: call Priya.';
  if (/remind me/u.test(input.question)) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: input.question, when: 'today at 11 am', remind: true }] });
  return `answer: ${input.question}`;
};

it('promise: a dated request reaching its instant is acted on through the owner step, and closes once answered', async () => {
  const world = harness({ families: ['promise'], model: requestModel });
  try {
    world.worker.intake([update(1, 'remind me today at 11 am to call Priya')]); await world.worker.drain();
    expect(openRequests(world.journal.view)).toHaveLength(1);
    world.sentinels.tick();
    expect(world.effects).toEqual([]);
    world.clock.now = START + 60 * 60_000 + 1000; // past 11:00 in Los Angeles
    world.sentinels.tick();
    expect(world.effects).toEqual([expect.stringMatching(/^promise request:[0-9a-f]{16}$/u)]);
    expect(sentinelReport(world.journal.view).promise.workRequested).toBe(1);
    await world.worker.sendRequested();
    expect(openRequests(world.journal.view)).toHaveLength(0);
    world.clock.now += 1000;
    world.sentinels.tick();
    expect(sentinelReport(world.journal.view).events.map(event => event.event)).toEqual(['work-requested', 'closed']);
  } finally { world.close(); }
});

it('promise: one still unacted past the window is reported on the pull surface, never pushed', async () => {
  const world = harness({ families: ['promise'], model: requestModel });
  try {
    world.worker.intake([update(1, 'remind me today at 11 am to call Priya')]); await world.worker.drain();
    const sends = world.sent.length;
    world.clock.now = START + 60 * 60_000 + 1000;
    world.sentinels.tick();
    world.clock.now += defaultPromiseConfig.reportAfterMs;
    world.sentinels.tick();
    const report = sentinelReport(world.journal.view);
    expect(report.promise.overdueReported).toHaveLength(1);
    expect(sentinelStatusLines(world.journal.view)[0]).toContain('promises 1 overdue reported');
    expect(world.sent).toHaveLength(sends);
  } finally { world.close(); }
});

it('off-switch, stop and an unrecordable decision all request nothing', async () => {
  const off = harness({ families: [] });
  try {
    off.worker.intake([update(1, 'hello')]);
    off.clock.now += 3_600_000;
    expect(off.sentinels.tick()).toEqual({ recorded: [], effects: [], failures: [] });
    expect(off.journal.view.sentinels).toBeUndefined();
    expect(sentinelStatusLines(off.journal.view)).toEqual([]);
  } finally { off.close(); }
  const stopped = harness();
  try {
    stopped.worker.intake([update(1, 'hello')]);
    stopped.clock.stopped = true; stopped.clock.now += 3_600_000;
    stopped.sentinels.tick();
    expect(stopped.effects).toEqual([]);
  } finally { stopped.close(); }
  const broken = harness({ families: ['presence'] });
  try {
    broken.worker.intake([update(1, 'hello')]);
    broken.clock.now += defaultPresenceConfig.thresholdMs;
    const failing = { get view() { return broken.journal.view; }, append: () => { throw Error('disk full'); } };
    const effects: string[] = [];
    const sentinels = createLiveSentinels(failing, { now: () => broken.clock.now, stopped: () => false, startedAt: START,
      families: new Set(['presence']), reground: () => {}, recoverContext: () => {}, selfHeal: turn => effects.push(turn), actOnPromise: () => {} });
    const report = sentinels.tick();
    expect(report.failures).toEqual([{ family: 'presence', stage: 'record', detail: 'disk full' }]);
    expect(effects).toEqual([]);
    expect(sentinels.failures().presence).toBe(1);
  } finally { broken.close(); }
});

it('the journal refuses a holding-note mark with no recorded self-heal before it', () => {
  const world = harness({ families: ['presence'] });
  try {
    world.worker.intake([update(1, 'hello')]);
    const id = world.journal.view.order[0]!.id;
    expect(() => world.journal.append({ kind: 'sentinel', family: 'presence', events: [],
      presence: { [id]: { firstSeenAt: 0, cause: 'unpicked', healAt: null, noteDueAt: 5, closedAt: null } }, at: world.clock.now }))
      .toThrow('sentinel record refused');
    expect(() => world.journal.append({ kind: 'sentinel', family: 'presence', events: [],
      presence: { 'telegram:12345678:update:999': { firstSeenAt: 0, cause: 'unpicked', healAt: 1, noteDueAt: 5, closedAt: null } }, at: world.clock.now }))
      .toThrow('sentinel record refused');
    expect(world.journal.view.sentinels).toBeUndefined();
  } finally { world.close(); }
});
