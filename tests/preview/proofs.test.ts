// Build 9: due plans, their probes and Nine's posture over the durable records (Rules 9, 26, 38, 43, 73).
import { describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { CREDENTIAL_SHAPE_NOTICE } from './journal.js';
import type { JournalView, Turn } from './journal.js';
import { HOLDING_REPLY } from './reply-check.js';
import { CRITICAL_PIPELINES, PREVIEW_PROOF_PLANS, executeProof, nextDuePlan, planVersion, projectionSections, proofPosture,
  stepCoverage, verificationPlanInput } from './proofs.js';
import type { Observed, ProofPorts, ProofRecord } from './proofs.js';
import { appendProof, readProofs } from './proof-log.js';
import { decodeVerificationRecord } from '../../src/verification/index.js';

const key = new Uint8Array(32).fill(29);
const T0 = 1790000000000, MINUTE = 60_000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
// cint-L2 merge: 8400, not 8000. A reviewed answer's prompt check (packet + the live repair's 3039-byte system prompt
// + review headroom) measured just over 8000 bytes on the merged tree (passes from 8050). The live bound is 32768.
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 50, maxReplies: 50, maxTurns: 50, maxBytes: 8400, cursor: 0 };
const plan = (id: string) => PREVIEW_PROOF_PLANS.find(p => p.id === id)!;
const supervisors = { replyReview: true, summaryReview: true, stepCheck: false };

async function world(options: { review?: boolean } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-proofs-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis);
  const clock = { now: T0 };
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'UTC',
    prepareModel: input => input.context, model: async () => 'Noted.',
    send: async () => 7, checkOutbound: () => {},
    ...(options.review ? { replyCheck: { elapsedMs: () => clock.now, jev: async () => ({ value: { model: 'jev-1.13.0', answers: {} }, latencyMs: 1 }),
      escalate: async () => ({ verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 1, reason: 'fine' }) } } : {}) });
  let next = 1;
  const say = async (text: string) => {
    worker.intake([{ update_id: next++, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
      date: Math.floor(clock.now / 1000) } }]);
    await worker.drain();
  };
  const ports = (extra: Partial<ProofPorts> = {}): ProofPorts => ({ now: () => clock.now, liveView: () => journal.view,
    durableView: () => { const copy = openPreviewJournal(path, key, undefined, undefined, true); try { return copy.view; } finally { copy.close(); } },
    botIdentity: () => ({ id: 12345678 }), boundBot: 12345678, supervisors, storeAgreements: () => [], ...extra });
  return { root, path, journal, clock, say, ports };
}
const delivered = { attempts: 1, accepted: 1, latestAccepted: true, latestReceipt: 7 };
/** An observation each plan's own `confirms` accepts: what a genuine passing probe retains. */
const SAMPLE: Record<string, Observed> = { startup: { identity: 12345678, boundBot: 12345678, cursor: 0, turns: 0 },
  'telegram-identity': { identity: 12345678, boundBot: 12345678 }, 'journal-restore': { sections: 30, cursor: 1, restored: true, differing: null },
  'reply-drain': { unfinished: 0, oldestUnfinishedAgeMs: null, backlogOverdue: false, inhibition: null },
  'reply-delivered': delivered, 'held-notice-delivered': delivered, 'reminder-delivered': delivered,
  'status-answered': delivered, 'provider-outcomes': { observedCalls: 1, completed: 1 },
  'reply-review-reached': { sentAnswers: 1, reviewed: 1, unreviewed: 0 },
  'spend-cap-refusal': { calls: 5, maxCalls: 5, replies: 1, maxReplies: 5, refusals: 1 },
  'summary-checked': { summaries: 1, checked: 1, unchecked: 0, lost: 0 }, 'step-check-reached': { steps: 1, verdicts: 1, pending: 0 },
  'store-agreements': { declared: 4, agree: 3, disagree: 0, unmeasured: 1, unchecked: 0, disagreeing: null, unmeasurable: 'unfinished-at-exit' } };
/** A probe run at `at`, observing a source produced at `observedAt`. */
const run = (id: string, at: number, disposition: 'passed' | 'failed' | 'unknown', observedAt: number | null = at, generation = 'g1',
  observed: Observed = SAMPLE[id]!): ProofRecord =>
  executeProof({ ...plan(id), probe: () => ({ disposition, observed, detail: disposition, observedAt }) },
    { now: () => at } as ProofPorts, generation, () => 0);
/** The launch history: the startup record that names the code generation a source was produced under. */
const launch = (generation = 'g1', startedAt = T0 - HOUR) => run('startup', startedAt, 'passed', startedAt, generation);
const at = (records: ProofRecord[], now: number, generation = 'g1', ports = { supervisors }) =>
  new Map(proofPosture(PREVIEW_PROOF_PLANS, [launch(generation), ...records], generation, ports, now).map(row => [row.plan, row]));
/** A view with only the fields a probe reads; the rest of the projection is irrelevant to it. */
const view = (fields: Partial<JournalView>): JournalView => ({ order: [], turns: new Map(), summaries: [], stepChecks: new Map(), callOutcomes: [],
  reminders: new Map(), awayEvents: [], memory: [], calls: 0, replies: 0, limits: genesis, stop: null, expires: 9999999999999, ...fields }) as unknown as JournalView;
const turn = (id: string, fields: Partial<Turn>): Turn => ({ id, update: Number(id.slice(1)), text: 'what is the plan', raw: '', accepted: true, at: T0,
  reserved: false, answer: 'Here it is.', intent: 'PREVIEW — Here it is.', ...fields });

describe("posture and due work through Nine's decoders and derivations", () => {
  it('every plan decodes as a full Nine VerificationPlan (witness, consumer, bounds, activation)', () => {
    for (const p of PREVIEW_PROOF_PLANS) {
      const decoded = decodeVerificationRecord('VerificationPlan', verificationPlanInput(p, 'g1', true),
        { site: 'preview.proofs', preserved: 'x', register: { generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'x' }, entries: [], sites: { 'preview.proofs': 'closed' } } });
      expect(decoded.kind, `${p.id}: ${'detail' in decoded ? decoded.detail : ''}`).toBe('Success');
    }
  });
  it('distinguishes never-run, healthy, failed, stale, not-current and inactive', () => {
    expect(at([], T0).get('journal-restore')).toMatchObject({ posture: 'unknown', last: null, overdueBy: T0 });
    expect(at([run('journal-restore', T0, 'passed')], T0 + HOUR).get('journal-restore')).toMatchObject({
      posture: 'healthy', lastSuccessAt: T0, dueAt: T0 + 6 * HOUR, overdueBy: 0, undecodable: 0, conflicts: 0, sourceUnavailable: false });
    expect(at([run('journal-restore', T0, 'passed'), run('journal-restore', T0 + HOUR, 'failed')], T0 + 2 * HOUR).get('journal-restore')!.posture).toBe('failed');
    expect(at([run('journal-restore', T0, 'unknown', null)], T0 + HOUR).get('journal-restore')!.posture).toBe('unknown');
    // Past the freshness window the witness no longer binds: Nine reads that as unknown, never healthy.
    expect(at([run('journal-restore', T0, 'passed')], T0 + 13 * HOUR).get('journal-restore')!.posture).toBe('unknown');
    // A record from another code generation is history, not current proof.
    expect(at([run('journal-restore', T0, 'passed', T0, 'g0')], T0 + HOUR).get('journal-restore')!.posture).toBe('unknown');
    expect(at([], T0).get('step-check-reached')).toMatchObject({ required: false, posture: 'inactive', overdueBy: 0 });
    expect(at([], T0, 'g1', { supervisors: { ...supervisors, stepCheck: true } }).get('step-check-reached')!.required).toBe(true);
  });
  it('an old source observation never renews into fresh health, however recently it was re-read', () => {
    // The probe ran an hour ago, but what it saw was produced 25 hours earlier: the witness has expired.
    const renewed = run('reply-delivered', T0 + 25 * HOUR, 'passed', T0);
    expect(at([renewed], T0 + 26 * HOUR).get('reply-delivered')!.posture).not.toBe('healthy');
    // The same attempt over a source inside the window is healthy.
    expect(at([run('reply-delivered', T0 + 25 * HOUR, 'passed', T0 + 24 * HOUR)], T0 + 26 * HOUR).get('reply-delivered')!.posture).toBe('healthy');
    // Provider outcomes: a 30-day-old successful call is not a current observation at all.
    const old = view({ callOutcomes: [{ kind: 'call-outcome', id: 'c', role: 'model', at: T0,
      outcome: { exitCode: 0, localLimit: null, elapsedMs: 1, type: 'result', subtype: 'success', isError: false, outputTokens: 1, promptBytes: 1 } }] as JournalView['callOutcomes'] });
    const later = T0 + 30 * DAY, record = executeProof(plan('provider-outcomes'), { now: () => later, liveView: () => old } as ProofPorts, 'g1', () => 0);
    expect(record).toMatchObject({ disposition: 'unknown', observedAt: null, capture: null });
    expect(at([record], later).get('provider-outcomes')!.posture).toBe('unknown');
  });
  it('an altered observation no longer binds its witness, and a pass with no source time is not a pass', () => {
    const genuine = run('journal-restore', T0, 'passed');
    expect(at([{ ...genuine, observed: { n: 2 } }], T0 + HOUR).get('journal-restore')!.posture).toBe('unknown');
    expect(run('journal-restore', T0, 'passed', null)).toMatchObject({ disposition: 'unknown', capture: null });
  });
  it("a pass is resolved from its retained observation: an empty observation with its own digest is never healthy (Astra MF1)", () => {
    // What the probe claims: `passed` over `{}`; the executor refuses to record that as a pass at all.
    expect(run('journal-restore', T0, 'passed', T0, 'g1', {})).toMatchObject({ disposition: 'unknown' });
    // A forged record — `passed`, `{}` and the canonical digest of `{}` — binds no witness either.
    const forged = { ...run('journal-restore', T0, 'failed', T0, 'g1', {}), disposition: 'passed' as const };
    expect(forged.capture).toMatch(/^sha256:/u);
    expect(at([forged], T0 + 10).get('journal-restore')!.posture).toBe('unknown');
    // Neighbor: the same attempt retaining a genuine restore observation is healthy.
    expect(at([run('journal-restore', T0, 'passed')], T0 + 10).get('journal-restore')!.posture).toBe('healthy');
  });
  it('two dispositions for one logical attempt are a conflict in either order, never a file-order choice (Astra MF1)', () => {
    const passed = run('journal-restore', T0, 'passed'), failed = { ...passed, disposition: 'failed' as const };
    for (const records of [[failed, passed], [passed, failed]])
      expect(at(records, T0 + 10).get('journal-restore')).toMatchObject({ posture: 'unknown', conflicts: 1, sourceUnavailable: true });
  });
  it('two retained observations for one logical attempt are a conflict in either order, even when both claim a pass (Astra round-2 MF1)', () => {
    const good = run('journal-restore', T0, 'passed');
    const other = run('journal-restore', T0, 'passed', T0, 'g1', { restored: true, differing: null, sections: 20, cursor: 10 });
    // An empty observation carrying its own canonical digest, labelled passed.
    const empty = { ...run('journal-restore', T0, 'failed', T0, 'g1', {}), disposition: 'passed' as const };
    // Round 3: the same claimed capture digest over different retained content (no hash collision needed).
    const sameClaim = { ...good, observed: {} };
    for (const records of [[good, empty], [empty, good], [good, other], [other, good], [sameClaim, good], [good, sameClaim]])
      expect(at(records, T0 + 10).get('journal-restore')).toMatchObject({ posture: 'unknown', conflicts: 1, sourceUnavailable: true });
    // Positive neighbors: the single confirming observation, and the same record replayed byte-identically.
    for (const records of [[good], [good, { ...good }]])
      expect(at(records, T0 + 10).get('journal-restore')).toMatchObject({ posture: 'healthy', conflicts: 0, sourceUnavailable: false });
    // Through the durable log, in both orders, and the single-content positive.
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-proof-claim-')));
    for (const [name, records, expected] of [['a', [sameClaim, good], 'unknown'], ['b', [good, sameClaim], 'unknown'], ['c', [good], 'healthy']] as const) {
      const path = join(root, `${name}.jsonl`);
      for (const record of [launch(), ...records]) appendProof(path, record);
      const log = readProofs(path);
      expect(log).toMatchObject({ unreadable: 0, refused: [] });
      const posture = proofPosture(PREVIEW_PROOF_PLANS, log.proofs, 'g1', { supervisors }, T0 + 10, log.refused).find(row => row.plan === 'journal-restore')!;
      expect(posture).toMatchObject(expected === 'healthy' ? { posture: 'healthy', conflicts: 0, sourceUnavailable: false }
        : { posture: 'unknown', conflicts: 1, sourceUnavailable: true });
    }
  });
  it('a refused newest attempt is an unavailable source; the earlier pass does not stand in for it (Astra MF1)', () => {
    const earlier = run('journal-restore', T0, 'passed');
    const torn = { ...earlier, startedAt: T0 + 1, completedAt: T0, disposition: 'failed' as const };
    expect(at([earlier, torn], T0 + 10).get('journal-restore')).toMatchObject({ posture: 'unknown', undecodable: 1, sourceUnavailable: true });
    // Neighbor: the refused line BEFORE the pass leaves the newest attempt available.
    expect(at([torn, earlier], T0 + 10).get('journal-restore')).toMatchObject({ posture: 'healthy', undecodable: 1, sourceUnavailable: false });
    // Through the durable log: a malformed newest line of the plan is refused by the reader and still counts as unavailable.
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-proof-refused-')));
    const path = join(root, 'proofs.jsonl');
    for (const record of [launch(), earlier]) appendProof(path, record);
    appendFileSync(path, `${JSON.stringify({ ...earlier, startedAt: T0 + 5, completedAt: T0 + 4 })}\n`);
    const log = readProofs(path);
    expect(log.refused).toEqual([{ plan: 'journal-restore', after: 2 }]);
    const posture = proofPosture(PREVIEW_PROOF_PLANS, log.proofs, 'g1', { supervisors }, T0 + 10, log.refused).find(row => row.plan === 'journal-restore')!;
    expect(posture).toMatchObject({ posture: 'unknown', sourceUnavailable: true });
  });
  it('re-probing an old reply under new code is not current proof; a reply the new code sent is (Astra MF1)', () => {
    const reply = (sentAt: number) => view({ order: [turn('u1', { sent: 4, sentAt })] });
    const oldLaunch = launch('old-code', T0 - HOUR), newLaunch = launch('new-code', T0 + 30 * MINUTE);
    const reprobe = executeProof(plan('reply-delivered'), { now: () => T0 + HOUR, liveView: () => reply(T0) } as ProofPorts, 'new-code', () => 0);
    expect(reprobe).toMatchObject({ disposition: 'passed', observedAt: T0 });
    const posture = (records: ProofRecord[]) => proofPosture(PREVIEW_PROOF_PLANS, [oldLaunch, newLaunch, ...records], 'new-code', { supervisors }, T0 + HOUR + 10)
      .find(row => row.plan === 'reply-delivered')!.posture;
    expect(posture([reprobe])).toBe('unknown');
    const fresh = executeProof(plan('reply-delivered'), { now: () => T0 + HOUR, liveView: () => reply(T0 + 45 * MINUTE) } as ProofPorts, 'new-code', () => 0);
    expect(posture([fresh])).toBe('healthy');
    // With no launch history at all, no source has a known executing version: nothing is healthy.
    expect(proofPosture(PREVIEW_PROOF_PLANS, [fresh], 'new-code', { supervisors }, T0 + HOUR + 10).find(row => row.plan === 'reply-delivered')!.posture).toBe('unknown');
  });
  it('the executor takes one most-overdue cadence plan and never a launch plan', () => {
    expect(nextDuePlan(PREVIEW_PROOF_PLANS, [], 'g1', { supervisors }, T0)!.trigger).toBe('cadence');
    const everyCadence = PREVIEW_PROOF_PLANS.filter(p => p.trigger === 'cadence').map(p => run(p.id, T0, 'passed'));
    expect(nextDuePlan(PREVIEW_PROOF_PLANS, everyCadence, 'g1', { supervisors }, T0 + MINUTE)).toBeNull();
    expect(nextDuePlan(PREVIEW_PROOF_PLANS, everyCadence, 'g1', { supervisors }, T0 + 15 * MINUTE)!.id).toBe('reply-drain');
    // A failed or unknown attempt is due again only after its cadence: no retry storm.
    expect(nextDuePlan(PREVIEW_PROOF_PLANS, PREVIEW_PROOF_PLANS.filter(p => p.trigger === 'cadence').map(p => run(p.id, T0, 'failed')),
      'g1', { supervisors }, T0 + MINUTE)).toBeNull();
  });
  it('a probe that cannot observe is recorded unknown, never passed', () => {
    const broken = { ...plan('journal-restore'), probe: () => { throw Error('unreadable'); } };
    expect(executeProof(broken, { now: () => T0 } as ProofPorts, 'g1', () => 0)).toMatchObject({ disposition: 'unknown', observed: {}, capture: null });
  });
});

describe('probes observe underlying state', () => {
  it('journal restore compares the whole durable projection: equal passes; changed content with equal counts fails by section', async () => {
    const w = await world();
    await w.say('remember that the marker is Juniper');
    await w.say('what is the marker');
    expect(plan('journal-restore').probe(w.ports())).toMatchObject({ disposition: 'passed', observed: { restored: true, differing: null } });
    // Astra's neighbor: identical counts, different turn text, answer and memory — the old count fingerprint passed this.
    const live = w.journal.view;
    const changed = { ...live, order: live.order.map(t => ({ ...t, text: 'REPLACED', answer: 'CORRUPT' })),
      turns: new Map([...live.turns].map(([id, t]) => [id, { ...t, text: 'REPLACED', answer: 'CORRUPT' }])),
      memory: live.memory.map(m => ({ ...m, quote: 'different memory' })) } as JournalView;
    const differing = plan('journal-restore').probe(w.ports({ durableView: () => changed }));
    expect(differing.disposition).toBe('failed');
    expect(String(differing.observed.differing)).toMatch(/turns/u);
    expect(JSON.stringify(differing)).not.toMatch(/Juniper|REPLACED|CORRUPT/u);
    expect(plan('journal-restore').probe(w.ports({ durableView: () => { throw Error('corrupt'); } })).disposition).toBe('failed');
    expect(projectionSections(live)).toEqual(projectionSections(w.ports().durableView()));
    w.journal.close();
  });
  it('bot identity passes only for the bound bot, and no answer is unknown', async () => {
    const w = await world();
    expect(plan('telegram-identity').probe(w.ports()).disposition).toBe('passed');
    expect(plan('telegram-identity').probe(w.ports({ botIdentity: () => ({ id: 999 }) })).disposition).toBe('failed');
    expect(plan('telegram-identity').probe(w.ports({ botIdentity: () => null })).disposition).toBe('unknown');
    w.journal.close();
  });
  it("store agreements (Rule 33, build 11's declarations): a disagreement fails; never-checked or nothing measurable is unknown", () => {
    const agreements = plan('store-agreements'), ports = (rows: { id: string; at: number | null; agree: boolean | null }[]) =>
      ({ now: () => T0, storeAgreements: () => rows }) as unknown as ProofPorts;
    const agreeing = [{ id: 'memory-provenance', at: T0 - HOUR, agree: true }, { id: 'serving-runner', at: T0, agree: true },
      { id: 'snapshot-replay', at: T0, agree: true }, { id: 'unfinished-at-exit', at: T0, agree: null }];
    const passed = agreements.probe(ports(agreeing));
    expect(passed).toMatchObject({ disposition: 'passed', observedAt: T0 - HOUR,
      observed: { declared: 4, agree: 3, disagree: 0, unmeasured: 1, unchecked: 0, disagreeing: null, unmeasurable: 'unfinished-at-exit' } });
    expect(agreements.confirms(passed.observed)).toBe(true);
    const disagreeing = agreements.probe(ports([...agreeing.slice(0, 3), { id: 'unfinished-at-exit', at: T0, agree: false }]));
    expect(disagreeing).toMatchObject({ disposition: 'failed', observed: { disagree: 1, disagreeing: 'unfinished-at-exit' } });
    expect(agreements.confirms(disagreeing.observed)).toBe(false);
    expect(agreements.probe(ports([...agreeing.slice(0, 3), { id: 'unfinished-at-exit', at: null, agree: null }])).disposition).toBe('unknown');
    expect(agreements.probe(ports(agreeing.map(row => ({ ...row, agree: null })))).disposition).toBe('unknown');
    expect(agreements.probe(ports([])).disposition).toBe('unknown');
    // A pass retained with a disagreement in it never binds (the witness is resolved from the observation).
    expect(executeProof({ ...agreements, probe: () => ({ ...disagreeing, disposition: 'passed' as const }) }, ports(agreeing), 'g1', () => 0))
      .toMatchObject({ disposition: 'unknown' });
  });
  it('reply review reached: over the whole population, one unreviewed answer fails it', async () => {
    const unreviewed = await world();
    expect(plan('reply-review-reached').probe(unreviewed.ports()).disposition).toBe('unknown');
    await unreviewed.say('what is the weather like');
    expect(plan('reply-review-reached').probe(unreviewed.ports())).toMatchObject({ disposition: 'failed', observed: { unreviewed: 1 } });
    unreviewed.journal.close();
    const reviewed = await world({ review: true });
    await reviewed.say('what is the weather like');
    expect(plan('reply-review-reached').probe(reviewed.ports())).toMatchObject({ disposition: 'passed', observed: { sentAnswers: 1, reviewed: 1 } });
    reviewed.journal.close();
  });
  it('summary and step duties hold over every member: one checked sibling never hides an unchecked one', () => {
    const mixed = view({ summaries: [{ faithfulness: { verdict: 'unavailable' } }, {}] as unknown as JournalView['summaries'] });
    expect(plan('summary-checked').probe({ now: () => T0, liveView: () => mixed } as ProofPorts))
      .toMatchObject({ disposition: 'failed', observed: { summaries: 2, checked: 1, unchecked: 1 } });
    const steps = view({ stepChecks: new Map([['answer:a', { result: { verdict: 'pass', reason: '', score: 0, latencyMs: 1 } }], ['cleanup:a', {}]]) });
    expect(plan('step-check-reached').probe({ now: () => T0, liveView: () => steps } as ProofPorts))
      .toMatchObject({ disposition: 'failed', observed: { steps: 2, verdicts: 1, pending: 1 } });
  });
  it('reply drain fails only on overdue accepted work with nothing inhibiting it', async () => {
    const w = await world();
    expect(plan('reply-drain').probe(w.ports()).disposition).toBe('passed');
    const waiting = { ...w.journal.view, order: [{ id: 'x', update: 1, text: 'hi', raw: '', accepted: true, at: T0, reserved: false }] } as unknown as JournalView;
    w.clock.now = T0 + HOUR;
    expect(plan('reply-drain').probe(w.ports({ liveView: () => waiting })).disposition).toBe('failed');
    expect(plan('reply-drain').probe(w.ports({ liveView: () => ({ ...waiting, stop: 'operator' }) as JournalView }))).toMatchObject({
      disposition: 'passed', observed: { inhibition: 'operator' } });
    w.journal.close();
  });
  it('delivery outcomes read Telegram acceptance and its source time: accepted passes, unknown fails, none or old is unknown', async () => {
    const w = await world();
    expect(plan('reply-delivered').probe(w.ports())).toMatchObject({ disposition: 'unknown', observedAt: null });
    await w.say('what is the plan');
    expect(plan('reply-delivered').probe(w.ports())).toMatchObject({ disposition: 'passed', observedAt: T0 });
    w.journal.close();
    const lost = view({ order: [turn('u1', { sent: 4, sentAt: T0 }), turn('u2', {})] });
    expect(plan('reply-delivered').probe({ now: () => T0, liveView: () => lost } as ProofPorts)).toMatchObject({ disposition: 'failed', observedAt: T0 });
    const old = view({ order: [turn('u1', { sent: 4, sentAt: T0 })] });
    expect(plan('reply-delivered').probe({ now: () => T0 + 2 * DAY, liveView: () => old } as ProofPorts).disposition).toBe('unknown');
    const status = view({ order: [turn('u1', { text: 'status', sent: 5, sentAt: T0 }), turn('u2', { sent: 6, sentAt: T0 })] });
    expect(plan('status-answered').probe({ now: () => T0, liveView: () => status } as ProofPorts)).toMatchObject({ disposition: 'passed', observed: { attempts: 1 } });
    const notice = view({ order: [turn('u1', { heldNoticeIntent: 'x', heldNoticeSent: 8, heldNoticeSentAt: T0 })] });
    expect(plan('held-notice-delivered').probe({ now: () => T0 + HOUR, liveView: () => notice } as ProofPorts).disposition).toBe('passed');
  });
  it('spend-cap refusal passes only on an observed hold at a reached allowance, and fails on overspend', () => {
    const probe = (fields: Partial<JournalView>) => plan('spend-cap-refusal').probe({ now: () => T0 + HOUR, liveView: () => view(fields) } as ProofPorts);
    expect(probe({})).toMatchObject({ disposition: 'unknown' });
    expect(probe({ calls: 50, awayEvents: [{ kind: 'hold', at: T0, id: 'u1', reason: 'call cap' }] })).toMatchObject({ disposition: 'passed', observedAt: T0 });
    expect(probe({ calls: 51 })).toMatchObject({ disposition: 'failed' });
  });
  it('provider outcomes: unknown before any call, failed when the recent calls all failed', async () => {
    const w = await world();
    expect(plan('provider-outcomes').probe(w.ports()).disposition).toBe('unknown');
    const call = (subtype: string) => ({ kind: 'call-outcome', id: 'c', role: 'model', at: T0,
      outcome: { exitCode: 0, localLimit: null, elapsedMs: 1, type: 'result', subtype, isError: subtype !== 'success', outputTokens: 1, promptBytes: 1 } });
    const failing = { ...w.journal.view, callOutcomes: [call('success'), call('other'), call('other'), call('other')] } as unknown as JournalView;
    expect(plan('provider-outcomes').probe(w.ports({ liveView: () => failing })).disposition).toBe('failed');
    const recovering = { ...failing, callOutcomes: [...failing.callOutcomes, call('success')] } as unknown as JournalView;
    expect(plan('provider-outcomes').probe(w.ports({ liveView: () => recovering })).disposition).toBe('passed');
    w.journal.close();
  });
});

describe('every critical pipeline step, over its complete population (Rule 38)', () => {
  const coverage = (fields: Partial<JournalView>, on = supervisors) => stepCoverage(view(fields), on);
  const row = (rows: ReturnType<typeof stepCoverage>[string], step: string) => rows.rows.find(r => r.boundary === step)!;
  it('one reviewed answer never covers an unreviewed one (mixed pass/missing neighbor)', () => {
    const reviewed = turn('u1', { sent: 1, sentAt: T0, replyChecks: [{ verdict: 'pass', ruleIds: [], confidence: null, path: 'jev', latencyMs: 1 }] });
    const bare = turn('u2', { sent: 2, sentAt: T0 });
    const rows = coverage({ order: [reviewed, bare], turns: new Map([['u1', reviewed], ['u2', bare]]) })['operator-reply']!;
    for (const step of ['answer', 'interpret', 'send'])
      expect(row(rows, step)).toMatchObject({ population: 2, validated: 1, missing: 1, state: 'missing' });
    // Intake has a supervisor of its own (the step supervisor): with it off, intake is missing, never exempt.
    expect(row(rows, 'intake')).toMatchObject({ state: 'missing', supervisors: ['step-check'] });
    const both = coverage({ order: [reviewed], turns: new Map([['u1', reviewed]]) })['operator-reply']!;
    expect(row(both, 'send').state).toBe('validated');
  });
  it('a step no supervisor reaches is missing, never validated; an off supervisor contributes nothing (missing-step neighbor)', () => {
    const reviewed = turn('u1', { sent: 1, sentAt: T0, replyChecks: [{ verdict: 'pass', ruleIds: [], confidence: null, path: 'jev', latencyMs: 1 }] });
    const stepChecks = new Map([['cleanup:u1', { result: { verdict: 'pass' as const, reason: '', score: 0, latencyMs: 1 } }]]);
    const off = coverage({ order: [reviewed], turns: new Map([['u1', reviewed]]), stepChecks })['operator-reply']!;
    expect(row(off, 'prepare-packet').state).toBe('missing');
    expect(row(off, 'cleanup').state).toBe('missing');
    const on = coverage({ order: [reviewed], turns: new Map([['u1', reviewed]]), stepChecks }, { ...supervisors, stepCheck: true })['operator-reply']!;
    expect(row(on, 'cleanup').state).toBe('validated');
    expect(row(on, 'prepare-packet').state).toBe('missing');
    // A violation whose flagged text went out is failed, not validated.
    const flagged = turn('u1', { sent: 1, sentAt: T0, replyChecks: [{ verdict: 'violation', ruleIds: [], confidence: 1, path: 'holding', latencyMs: 0 }] });
    expect(row(coverage({ order: [flagged], turns: new Map([['u1', flagged]]) })['operator-reply']!, 'send').state).toBe('failed');
  });
  it('a violation whose answer was held is covered and stays a refusal: held, never failed or validated (Rules 38, 42)', () => {
    const violation = [{ verdict: 'violation' as const, ruleIds: ['credential' as const], confidence: 1, path: 'subscription' as const, latencyMs: 1 }];
    const held = turn('u1', { sent: 1, sentAt: T0, intent: HOLDING_REPLY, replyChecks: violation });
    const notice = turn('u2', { sent: 2, sentAt: T0, intent: CREDENTIAL_SHAPE_NOTICE, replyChecks: violation });
    const headed = turn('u3', { sent: 3, sentAt: T0, intent: `Reminder: call Sam\n${HOLDING_REPLY.replace(/^PREVIEW — /u, '')}`, replyChecks: violation });
    const released = turn('u4', { sent: 4, sentAt: T0, replyChecks: violation });
    const passed = turn('u5', { sent: 5, sentAt: T0, replyChecks: [{ verdict: 'pass', ruleIds: [], confidence: null, path: 'jev', latencyMs: 1 }] });
    const of = (...turns: Turn[]) => coverage({ order: turns, turns: new Map(turns.map(t => [t.id, t])) })['operator-reply']!;
    for (const step of ['answer', 'interpret', 'send'])
      expect(row(of(held, notice, headed, passed), step)).toMatchObject({ population: 4, validated: 1, held: 3, failed: 0, missing: 0, state: 'held' });
    // The neighbor across the boundary: the same verdict with the flagged answer sent is failed.
    expect(row(of(held, released, passed), 'send')).toMatchObject({ validated: 1, held: 1, failed: 1, state: 'failed' });
    // A held operation never hides an unreviewed one.
    expect(row(of(held, turn('u6', { sent: 6, sentAt: T0 })), 'send')).toMatchObject({ held: 1, missing: 1, state: 'missing' });
  });
  it('no business step is exempt: every roster step names a supervisor, and an unobserved requested action is missing under the reply review\'s open direction', () => {
    const due = turn('requested-action:0', { update: 1.0009765625, sent: 3, sentAt: T0, requestedAction: { items: [{ source: 'u1', quote: 'call Sam', when: 'at 5' }] } });
    const pipeline = coverage({ order: [due], turns: new Map([[due.id, due]]) }, { ...supervisors, stepCheck: true })['requested-action']!;
    expect(pipeline.failureDirection).toBe('open'); // Rule 95: its send runs the pre-send reply review, which fails open.
    expect(pipeline.rows.map(r => [r.boundary, r.population, r.state])).toEqual([['select-due', 1, 'missing'], ['prepare-packet', 1, 'missing'],
      ['answer', 1, 'missing'], ['send', 1, 'missing']]);
    for (const step of Object.values(CRITICAL_PIPELINES).flatMap(p => p.steps)) expect(step.supervisors.length, step.step).toBeGreaterThan(0);
    expect(Object.values(CRITICAL_PIPELINES).flatMap(p => p.steps).some(s => 'bootstrap' in s)).toBe(false);
    expect(Object.keys(stepCoverage(view({}), supervisors))).toEqual(Object.keys(CRITICAL_PIPELINES));
  });
});

it('the proof log keeps valid rows, counts torn or malformed ones, and reports an unreadable store', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-proof-log-')));
  const path = join(root, 'proofs.jsonl');
  appendProof(path, run('journal-restore', T0, 'passed'));
  appendProof(path, { v: 1, liveProof: 'live-proof:preview.reply', capability: 'preview.reply', version: 'v', generation: 'g1', fact: 'outcome-observed',
    update: 1, messageId: 3, observedAt: T0, recordedAt: T0, deskObservation: null });
  appendFileSync(path, '{"v":1,"plan":"x","planVersion":"v","generation":"g","startedAt":5,"completedAt":4,"disposition":"passed","observed":{},"detail":"","observedAt":null,"capture":null}\n{"v":1,"plan":');
  const log = readProofs(path);
  expect(log).toMatchObject({ available: true, unreadable: 2 });
  expect(log.proofs).toHaveLength(1);
  expect(log.liveProofs).toHaveLength(1);
  writeFileSync(path, '');
  expect(readProofs(join(root, 'absent.jsonl'))).toEqual({ proofs: [], liveProofs: [], unreadable: 0, available: true, refused: [] });
  mkdirSync(join(root, 'dir.jsonl'));
  expect(readProofs(join(root, 'dir.jsonl')).available).toBe(false);
});
