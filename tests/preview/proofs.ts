/** Due verification plans for the live journal runner, and the probes that execute them
 * (Rules 9, 26, 38, 43, 73). A plan is a declared check with a cadence and freshness
 * window; a probe observes state through the ports it is handed and returns what it saw
 * and WHEN that state was produced (a Telegram acceptance, a provider answer, a fresh
 * replay). The architecture check (NF-26) keeps this module off the filesystem, process
 * and clock. That keeps the reading to the ports; it does not by itself make an
 * observation genuine — the witness binding below does that.
 *
 * Every plan and attempt is decoded by Nine's own record decoder (`decodeVerificationRecord`) and merged by
 * Nine's `mergeVerificationRecords`: two attempts with one logical identity and different content are a
 * conflict, an unavailable source, never resolved by file order. A passing attempt's Evidence witness is
 * resolved from its retained observation — the plan's `confirms` must hold over exactly what was captured —
 * and bound to the source time and the executing code generation named by the launch history (the startup
 * records). Posture is Nine's `probeBoundToCurrentEvidence` + `deriveGuardPosture`: a refused newest attempt
 * is an unavailable source, a witness past its window no longer binds, and re-reading an old source under new
 * code never renews it. The preview runs no fact store; the distributed spine is build 11's side. */
import { canonical, consumeResult, decode, decodeMeasurement } from '../../src/index.js';
import type { Clock, DecodeContext, Evidence, Result } from '../../src/index.js';
import { genesisHash } from '../../src/facts/index.js';
import type { FactContext } from '../../src/facts/index.js';
import { decodeVerificationRecord, deriveGuardPosture, deriveVerificationDue, mergeVerificationRecords, probeBoundToCurrentEvidence,
  supervisionCoverage, verificationIdentity } from '../../src/verification/index.js';
import type { GuardPosture, ProbePostureResolution, ProbeRecord, VerificationPlan } from '../../src/verification/index.js';
import { isStatusCommand } from './status-command.js';
import { loopHealth } from './obligations.js';
import { durableProjection, packetDigest, reminderId } from './journal.js';
import type { JournalView, Turn } from './journal.js';

const MINUTE = 60_000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;

export type ProofDisposition = 'passed' | 'failed' | 'unknown';
export type Observed = Readonly<Record<string, string | number | boolean | null>>;
/** One executed attempt, as written to the durable proof log. */
export interface ProofRecord {
  v: 1; plan: string; planVersion: string; generation: string; startedAt: number; completedAt: number;
  disposition: ProofDisposition; observed: Observed; detail: string;
  /** When the observed source state was produced; null when nothing was observed. Freshness binds to this. */
  observedAt: number | null;
  /** Canonical digest of `observed` (the witness capture); a changed observation no longer binds. */
  capture: string | null;
}
/** What a live-surface proof observed: the capability's own outcome, or a desk-recorded semantic observation. */
export type LiveFact = 'outcome-observed' | 'desk-observed';
/** A live-surface proof bound to the capability version of the launch that executed it. */
export interface LiveProofRecord {
  v: 1; liveProof: string; capability: string; version: string; generation: string; fact: LiveFact; update: number;
  messageId: number | null; observedAt: number; recordedAt: number; deskObservation: string | null;
}

/** What a probe may read. Each port returns an observation of real state; none returns a flag. */
export interface ProofPorts {
  now(): number;
  /** The running projection the worker acts on. */
  liveView(): JournalView;
  /** A fresh read-only replay of the durable encrypted journal (the restore at the declared demand). */
  durableView(): JournalView;
  /** An authenticated identity answer from the chat platform, or null when none was observed. */
  botIdentity(): { id: number } | null;
  readonly boundBot: number;
  /** Supervisors wired into this launch; an optional port that is off is reported, never counted. */
  readonly supervisors: Readonly<{ replyReview: boolean; summaryReview: boolean; stepCheck: boolean }>;
  /** At launch only: the options and capability versions this launch runs with, recorded by the startup proof. */
  readonly launch?: Observed;
}
export interface ProofOutcome { disposition: ProofDisposition; observed: Observed; detail: string; observedAt: number | null }

export type PlanKind = 'startup' | 'critical-outcome' | 'restore' | 'duty';
export interface ProofPlan {
  id: string; kind: PlanKind; rules: readonly number[]; capability: string;
  /** What underlying state the probe reads (the evidence source, not a symbol of it). */
  observes: string;
  /** The controller of the observed source; the tested worker is never its own witness. */
  witness: Witness;
  cadenceMs: number; freshnessMs: number;
  /** Launch plans run once per start; cadence plans run when due. */
  trigger: 'launch' | 'cadence';
  /** False only for an optional port that is off in this launch: its posture is inactive, never healthy. */
  required(ports: Pick<ProofPorts, 'supervisors'>): boolean;
  probe(ports: ProofPorts): ProofOutcome;
  /** Whether a retained observation itself shows the outcome. A witness is resolved from this, never from a
   * `passed` label: an empty or unrelated observation binds nothing, whatever disposition it carries. */
  confirms(observed: Observed): boolean;
}
export const WITNESSES = ['telegram.bot-api', 'preview.durable-journal', 'model.provider', 'preview.reply-reviewer',
  'preview.summary-reviewer', 'jev.step-supervisor'] as const;
export type Witness = typeof WITNESSES[number];
/** The register id of a plan's probe (the `probe`/`freshnessProbe` reference in preview.declarations.json). */
export const probeId = (plan: string) => `P9-PREVIEW-${plan}`;

const outcome = (disposition: ProofDisposition, observed: Observed, detail: string, observedAt: number | null): ProofOutcome =>
  ({ disposition, observed, detail, observedAt });
const encode = (value: unknown) => consumeResult(canonical(JSON.parse(JSON.stringify(value ?? null)) as unknown),
  { Success: encoded => encoded, Refused: refusal => { throw Error(refusal.detail); } });
const hashOf = (value: unknown): string => encode(value).hash;

/** Rule 26: section digests of the complete durable projection — the one the compaction verifier compares. */
export function projectionSections(view: JournalView): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(durableProjection(view)).sort(([a], [b]) => a.localeCompare(b))
    .map(([section, value]) => [section, hashOf(value)]));
}

/** Ordinary operator replies: accepted messages answered by the model (status pulls, requested summaries and fixed notices excluded). */
export const replyTurn = (turn: Turn) => turn.accepted && turn.answer !== undefined && !isStatusCommand(turn.text)
  && turn.requestedSummary === undefined && turn.groupedInto === undefined && turn.noticeClass === undefined;
export const statusTurn = (turn: Turn) => turn.accepted && turn.requestedSummary === undefined && isStatusCommand(turn.text);
export const requestedSummaryTurn = (turn: Turn) => turn.requestedSummary !== undefined && turn.groupedInto === undefined;
/** Sent model answers and whether each reached its before-send reviewer (fixed projections excluded). */
export function sentAnswers(view: JournalView) {
  const answers = view.order.filter(turn => turn.sent !== undefined && turn.answer !== undefined && !turn.noticeClass
    && !isStatusCommand(turn.text));
  return { answers, reviewed: answers.filter(turn => turn.replyChecks?.some(check => check.verdict === 'pass')) };
}

interface Attempt { message: number | undefined; attemptAt: number; acceptedAt: number | undefined }
/** A delivery outcome: the newest send attempt must carry Telegram's acceptance, observed inside the window. */
function delivery(rows: readonly Attempt[], now: number, freshness: number, noun: string): ProofOutcome {
  const latest = rows.at(-1);
  const observed = { attempts: rows.length, accepted: rows.filter(row => row.message !== undefined).length,
    latestAccepted: latest ? latest.message !== undefined : null, latestReceipt: latest?.message ?? null };
  if (!latest) return outcome('unknown', observed, `no ${noun} send has been attempted yet`, null);
  if (latest.message === undefined)
    return outcome('failed', observed, `the newest ${noun} send has no Telegram acceptance; its outcome is unknown`, latest.attemptAt);
  if (latest.acceptedAt === undefined) return outcome('unknown', observed, `the newest ${noun} acceptance has no recorded time`, null);
  if (now - latest.acceptedAt >= freshness)
    return outcome('unknown', observed, `the newest accepted ${noun} is older than the freshness window`, latest.acceptedAt);
  return outcome('passed', observed, `Telegram accepted the newest ${noun}`, latest.acceptedAt);
}
const turnAttempts = (view: JournalView, select: (turn: Turn) => boolean): Attempt[] => view.order
  .filter(turn => select(turn) && turn.intent !== undefined)
  .map(turn => ({ message: turn.sent, attemptAt: turn.at, acceptedAt: turn.sentAt }));
const answerCalls = (view: JournalView) => view.callOutcomes.filter(row => row.role === 'model');
const completedCall = (row: JournalView['callOutcomes'][number]) => row.outcome.subtype === 'success' && row.outcome.isError !== true && row.outcome.localLimit === null;
const CAP_HOLDS = new Set(['call cap', 'reply cap']);
const identity = (ports: ProofPorts, label: string): ProofOutcome => {
  const answer = ports.botIdentity(), at = ports.now();
  const observed = { identity: answer?.id ?? null, boundBot: ports.boundBot };
  if (answer === null) return outcome('unknown', observed, `no authenticated identity answer was observed ${label}`, null);
  return answer.id === ports.boundBot ? outcome('passed', observed, `the chat platform authenticated the bound bot ${label}`, at)
    : outcome('failed', observed, `the chat platform answered for a different bot ${label}`, at);
};

const cadence = (id: string, kind: PlanKind, capability: string, witness: Witness, rules: readonly number[], observes: string,
  cadenceMs: number, freshnessMs: number, confirms: ProofPlan['confirms'], probe: ProofPlan['probe'],
  required: ProofPlan['required'] = () => true): ProofPlan =>
  ({ id, kind, capability, witness, rules, observes, cadenceMs, freshnessMs, trigger: 'cadence', required, probe, confirms });
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
/** The bound bot answered for itself. */
const identityConfirmed = (o: Observed) => count(o.identity) && o.identity > 0 && o.identity === o.boundBot;
/** Telegram's acceptance of the newest attempt, with its receipt. */
const deliveryConfirmed = (o: Observed) => o.latestAccepted === true && count(o.latestReceipt) && o.latestReceipt > 0
  && count(o.accepted) && o.accepted > 0;

export const PREVIEW_PROOF_PLANS: readonly ProofPlan[] = Object.freeze([
  { id: 'startup', kind: 'startup', rules: [9, 26, 43], capability: 'preview.durable-intake', witness: 'telegram.bot-api', trigger: 'launch',
    observes: 'the authenticated bot identity answer and the replayed journal at launch', cadenceMs: 30 * DAY, freshnessMs: 30 * DAY,
    required: () => true, confirms: o => identityConfirmed(o) && count(o.cursor) && count(o.turns), probe: ports => {
      const result = identity(ports, 'at launch'), view = ports.liveView();
      return { ...result, observed: { ...result.observed, cursor: view.cursor, turns: view.order.length, ...ports.launch } };
    } },
  cadence('telegram-identity', 'critical-outcome', 'preview.reply', 'telegram.bot-api', [26, 43],
    'a fresh authenticated getMe answer bound to the recorded bot id', 6 * HOUR, 12 * HOUR, identityConfirmed, ports => identity(ports, 'now')),
  cadence('journal-restore', 'restore', 'preview.durable-intake', 'preview.durable-journal', [9, 26, 43],
    'a fresh read-only replay of the encrypted journal compared section by section with the live projection', 6 * HOUR, 12 * HOUR,
    o => o.restored === true && o.differing === null && count(o.sections) && o.sections > 0 && count(o.cursor), ports => {
      const at = ports.now(), live = projectionSections(ports.liveView());
      const base = { sections: Object.keys(live).length, cursor: ports.liveView().cursor };
      let durable: Readonly<Record<string, string>>;
      try { durable = projectionSections(ports.durableView()); }
      catch { return outcome('failed', { ...base, restored: false, differing: null }, 'the durable journal could not be replayed', at); }
      const differing = [...new Set([...Object.keys(live), ...Object.keys(durable)])].filter(section => live[section] !== durable[section]).sort();
      return differing.length === 0
        ? outcome('passed', { ...base, restored: true, differing: null }, 'a fresh replay of the durable journal equals the live projection', at)
        : outcome('failed', { ...base, restored: true, differing: differing.join(',') },
          `the durable replay differs from the live projection in ${differing.join(', ')}`, at);
    }),
  cadence('reply-drain', 'critical-outcome', 'preview.reply', 'preview.durable-journal', [9, 43],
    'accepted operator messages in the journal and whether each was settled', 15 * MINUTE, HOUR,
    o => count(o.unfinished) && typeof o.backlogOverdue === 'boolean' && !(o.backlogOverdue && o.inhibition === null), ports => {
      const at = ports.now(), health = loopHealth(ports.liveView(), at);
      const observed = { unfinished: health.unfinished, oldestUnfinishedAgeMs: health.oldestUnfinishedAgeMs,
        backlogOverdue: health.backlogOverdue, inhibition: health.inhibition };
      if (health.backlogOverdue && health.inhibition === null)
        return outcome('failed', observed, 'accepted work is past its drain limit with nothing inhibiting it', at);
      return outcome('passed', observed, health.backlogOverdue ? `accepted work waits on a recorded inhibition: ${health.inhibition}`
        : 'accepted work is settled or within its drain limit', at);
    }),
  cadence('reply-delivered', 'critical-outcome', 'preview.reply', 'telegram.bot-api', [26, 43],
    "Telegram's acceptance of the newest operator reply and its acceptance time", HOUR, DAY, deliveryConfirmed,
    ports => delivery(turnAttempts(ports.liveView(), replyTurn), ports.now(), DAY, 'operator reply')),
  cadence('provider-outcomes', 'critical-outcome', 'preview.reply', 'model.provider', [39, 43],
    'the recorded outcomes of answer calls made inside the freshness window', HOUR, 6 * HOUR,
    o => count(o.completed) && o.completed > 0 && count(o.observedCalls) && o.observedCalls >= o.completed, ports => {
      const at = ports.now(), recent = answerCalls(ports.liveView()).filter(row => at - row.at < 6 * HOUR && row.at <= at).slice(-3);
      const completed = recent.filter(completedCall);
      const observed = { observedCalls: recent.length, completed: completed.length };
      if (recent.length === 0) return outcome('unknown', observed, 'no answer call inside the freshness window', null);
      return completed.length ? outcome('passed', observed, 'recent answer calls completed', completed.at(-1)!.at)
        : outcome('failed', observed, 'the recent answer calls all failed', recent.at(-1)!.at);
    }),
  cadence('reply-review-reached', 'duty', 'preview.reply-review', 'preview.reply-reviewer', [9, 38, 73],
    'each sent model answer and the passing review recorded for it before the send', HOUR, 6 * HOUR,
    o => count(o.sentAnswers) && o.sentAnswers > 0 && o.reviewed === o.sentAnswers && o.unreviewed === 0, ports => {
      const at = ports.now(), { answers, reviewed } = sentAnswers(ports.liveView());
      const observed = { sentAnswers: answers.length, reviewed: reviewed.length, unreviewed: answers.length - reviewed.length };
      if (answers.length === 0) return outcome('unknown', observed, 'no sent answer yet to observe', null);
      return reviewed.length === answers.length ? outcome('passed', observed, 'every sent answer passed its review first', at)
        : outcome('failed', observed, `${answers.length - reviewed.length} sent answers have no passing review`, at);
    }),
  cadence('held-notice-delivered', 'critical-outcome', 'preview.held-reply-notice', 'telegram.bot-api', [43],
    "Telegram's acceptance of the newest held-reply notice and its acceptance time", HOUR, 7 * DAY, deliveryConfirmed,
    ports => delivery(ports.liveView().order.filter(turn => turn.heldNoticeIntent !== undefined)
      .map(turn => ({ message: turn.heldNoticeSent, attemptAt: turn.heldSince ?? turn.at, acceptedAt: turn.heldNoticeSentAt })),
    ports.now(), 7 * DAY, 'held-reply notice')),
  cadence('reminder-delivered', 'critical-outcome', 'preview.reminders', 'telegram.bot-api', [43],
    "Telegram's acceptance of the newest requested reminder, and no reminder overdue", HOUR, 7 * DAY, deliveryConfirmed, ports => {
      const view = ports.liveView(), at = ports.now(), health = loopHealth(view, at);
      if (health.overdueReminders > 0 && health.inhibition === null)
        return outcome('failed', { overdue: health.overdueReminders }, `${health.overdueReminders} reminders are overdue with nothing inhibiting them`, at);
      return delivery([...view.reminders.values()].sort((a, b) => a.at - b.at)
        .map(item => ({ message: item.sent, attemptAt: item.at, acceptedAt: item.sentAt })), at, 7 * DAY, 'reminder');
    }),
  cadence('requested-summary-delivered', 'critical-outcome', 'preview.requested-summaries', 'telegram.bot-api', [43],
    "Telegram's acceptance of the newest requested summary and its acceptance time", HOUR, 7 * DAY, deliveryConfirmed,
    ports => delivery(turnAttempts(ports.liveView(), requestedSummaryTurn), ports.now(), 7 * DAY, 'requested summary')),
  cadence('status-answered', 'critical-outcome', 'preview.status-pull', 'telegram.bot-api', [43],
    "Telegram's acceptance of the newest status reply and its acceptance time", HOUR, 7 * DAY, deliveryConfirmed,
    ports => delivery(turnAttempts(ports.liveView(), statusTurn), ports.now(), 7 * DAY, 'status reply')),
  cadence('spend-cap-refusal', 'critical-outcome', 'preview.spend-cap', 'preview.durable-journal', [15, 43],
    'used allowances against their limits, and the holds a reached allowance recorded instead of spending', HOUR, 30 * DAY,
    o => count(o.refusals) && o.refusals > 0 && count(o.calls) && count(o.maxCalls) && o.calls <= o.maxCalls
      && count(o.replies) && count(o.maxReplies) && o.replies <= o.maxReplies, ports => {
      const view = ports.liveView(), at = ports.now();
      const refusals = view.awayEvents.filter(event => event.kind === 'hold' && CAP_HOLDS.has(event.reason ?? ''));
      const observed = { calls: view.calls, maxCalls: view.limits.maxCalls, replies: view.replies, maxReplies: view.limits.maxReplies,
        refusals: refusals.length };
      if (view.calls > view.limits.maxCalls || view.replies > view.limits.maxReplies)
        return outcome('failed', observed, 'a used allowance exceeds its limit', at);
      const latest = refusals.at(-1);
      if (!latest) return outcome('unknown', observed, 'no allowance has been reached, so no refusal has been observed yet', null);
      if (at - latest.at >= 30 * DAY) return outcome('unknown', observed, 'the newest observed refusal is older than the freshness window', latest.at);
      return outcome('passed', observed, 'a reached allowance held the work instead of spending, and no allowance is exceeded', latest.at);
    }),
  cadence('summary-checked', 'duty', 'preview.rolling-summary', 'preview.summary-reviewer', [9, 38],
    'each committed rolling summary and the faithfulness verdict recorded with it', 6 * HOUR, DAY,
    o => count(o.summaries) && o.summaries > 0 && o.checked === o.summaries && o.unchecked === 0, ports => {
      const at = ports.now(), summaries = ports.liveView().summaries;
      const checked = summaries.filter(summary => summary.faithfulness !== undefined);
      const observed = { summaries: summaries.length, checked: checked.length, unchecked: summaries.length - checked.length,
        lost: checked.filter(summary => summary.faithfulness?.verdict === 'lost').length };
      if (summaries.length === 0) return outcome('unknown', observed, 'no rolling summary committed yet', null);
      return checked.length === summaries.length ? outcome('passed', observed, 'every committed summary carries a faithfulness verdict', at)
        : outcome('failed', observed, `${summaries.length - checked.length} of ${summaries.length} committed summaries carry no faithfulness verdict`, at);
    }),
  cadence('step-check-reached', 'duty', 'preview.step-check', 'jev.step-supervisor', [9, 38, 73],
    'each completed business step and the step verdict recorded for it', 6 * HOUR, DAY,
    o => count(o.steps) && o.steps > 0 && o.verdicts === o.steps && o.pending === 0, ports => {
      const at = ports.now(), steps = [...ports.liveView().stepChecks.values()];
      const done = steps.filter(item => item.result !== undefined).length;
      const observed = { steps: steps.length, verdicts: done, pending: steps.length - done };
      if (steps.length === 0) return outcome('unknown', observed, 'no completed step observed yet', null);
      return done === steps.length ? outcome('passed', observed, `all ${steps.length} steps carry a verdict`, at)
        : outcome('failed', observed, `${steps.length - done} of ${steps.length} steps carry no verdict`, at);
    }, ports => ports.supervisors.stepCheck),
]);

/** Plan version is the declared plan itself: changing what a plan observes or how often voids its old records. */
export const planVersion = (plan: ProofPlan) => `v2:${plan.observes}:${plan.cadenceMs}:${plan.freshnessMs}:${plan.witness}`;

// Nine's decoders read the preview's own register: its witnesses, its runner and its clock.
const REGISTER = { generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:proofs' },
  entries: ['types.decode', 'preview', 'preview.proof-runner', 'preview.worker', ...WITNESSES], producers: ['preview.proof-runner'],
  methods: [], actions: {}, subjects: { clock: ['unix-ms'] }, sites: { 'types.decode': 'closed', 'preview.proofs': 'closed' },
  keys: {}, allowRedelegation: false, conflictStanding: { ordinary: 'delegate', authority: 'operator' } } as const;
const BOUNDARY = { site: 'preview.proofs', preserved: 'preview:proofs', register: REGISTER };
const take = <T>(result: Result<T>): T => consumeResult(result, { Success: value => value, Refused: refusal => { throw Error(refusal.detail); } });
const attempt = <T>(result: Result<T>): T | null => consumeResult(result, { Success: value => value, Refused: () => null });
const decodeContext = (captures: Readonly<Record<string, string>>): DecodeContext => ({ register: REGISTER, preserved: 'preview:proofs', captures });
const clockAt = (context: DecodeContext, at: number): Clock => take(decodeMeasurement('clock', { type: 'Measurement', schemaVersion: 1,
  subject: { kind: 'clock', instance: 'preview' }, value: at, unit: 'unix-ms', at, by: 'preview.proof-runner' }, context));
const factContext = (context: DecodeContext, now: Clock): FactContext => ({ site: 'preview.proofs', preserved: 'preview:proofs', decode: context,
  schemas: [], keys: [], facts: [], grants: [], revocations: [], genesis: { hash: genesisHash, clock: now }, timeAnchors: [], captures: {}, folded: {} });

const subjectDigest = (plan: ProofPlan) => hashOf({ plan: plan.id, capability: plan.capability, observes: plan.observes, witness: plan.witness });
/** The full Nine plan: subject, probe arm, bar, independence, scheduling, bounds, consumer, privacy and activation. */
export function verificationPlanInput(plan: ProofPlan, generation: string, required: boolean) {
  return { type: 'VerificationPlan', schemaVersion: 1, id: plan.id, predecessors: [],
    subject: { rules: [...plan.rules], holder: 'preview.proof-runner', governed: plan.capability, scope: 'preview', generation },
    arms: [{ id: 'probe', kind: 'probe', executable: `tests/preview/proofs.ts#${plan.id}`, fixture: probeId(plan.id),
      outputContract: 'ProofRecord', canFail: 'failed or unknown when the observed source state does not show the outcome', required }],
    bar: { version: planVersion(plan), predicates: [], sources: [plan.witness], minimumStrength: 'observation',
      subjectDigest: subjectDigest(plan), captureRequired: true, freshness: plan.freshnessMs, complete: true },
    independence: { testedPrincipal: 'preview.worker', observerPrincipal: 'preview.proof-runner', witnessController: plan.witness,
      commonFailures: ['the durable journal that records the source answer is written by the tested worker'] },
    scheduling: { owner: 'preview.proof-runner', run: 'journal-cycle', loopPolicy: 'one most-overdue due plan per cycle; stop and expiry inhibit',
      cadence: plan.cadenceMs, freshnessWindow: plan.freshnessMs, dueAction: 'probe', recoveryBudget: 'next cadence; a failed durable write backs off' },
    bounds: [{ resource: 'model-calls', limit: 0 }, { resource: 'sends', limit: 0 }, { resource: 'probes-per-cycle', limit: 1 }],
    consumers: [{ id: 'status-pull', direction: 'open', enforcedRecord: 'ProbeRecord', decoder: 'decodeVerificationRecord', preserved: 'preview:proofs' }],
    privacy: { readers: ['operator', 'desk'], providers: [], captureClass: 'counts-and-ids', secretCustody: 'none: no message text is observed',
      destinations: ['proofs.jsonl'] },
    activation: { unit: ['tests/preview/proofs.test.ts'], integration: ['tests/preview/proofs-launcher.test.ts'],
      lifecycle: ['tests/preview/proofs-launcher.test.ts'], semantic: ['desk live test'], limits: ['one due plan per cycle'], evidence: ['proofs.jsonl'] } };
}
const recordId = (record: ProofRecord) => `${record.plan}:${record.generation.slice(-12)}:${record.startedAt}`;
/** One retained capture of an attempt: the logical attempt identity stays `recordId`, while the capture and its
 * witness are named by what was observed, so two captures of one attempt never overwrite each other. */
const captureId = (record: ProofRecord) => `${recordId(record)}:${record.capture ?? 'none'}`;
const challenge = (record: ProofRecord) => hashOf({ plan: record.plan, planVersion: record.planVersion, generation: record.generation, startedAt: record.startedAt });
const bindingOf = (record: ProofRecord) => ({ challengeDigest: challenge(record), plan: record.plan, planVersion: record.planVersion,
  arm: 'probe', slot: record.generation, attempt: String(record.startedAt), run: `preview:${record.generation}`, operation: `proof:${record.plan}`,
  // The comparison carries the retained capture and its source time, so two records of one attempt that retained
  // different observations are an immutable disagreement in Nine's merge, never a file-order choice.
  comparison: `Result:${record.disposition}:capture:${record.capture ?? 'none'}:at:${record.observedAt ?? 'none'}` });
function probeInput(record: ProofRecord, plan: ProofPlan) {
  const binding = bindingOf(record);
  return { type: 'ProbeRecord', schemaVersion: 1, id: `probe:${recordId(record)}`, predecessors: [], ...binding, subject: plan.capability,
    startedAt: record.startedAt, completedAt: record.completedAt,
    witnesses: record.disposition === 'passed' && record.capture ? [`evidence:${captureId(record)}`] : [],
    disposition: record.disposition === 'unknown' ? 'inconclusive' : record.disposition,
    missingPhases: record.disposition === 'unknown' ? ['observation'] : [], captureStatus: record.capture ? 'available' : 'missing',
    costs: [{ resource: 'model-calls', amount: 0 }] };
}
/** The executing version of a source outcome, from the launch history: the generation of the newest startup
 * recorded at or before the source time. A source produced under other code is history, not current proof. */
export function sourceGeneration(records: readonly ProofRecord[], observedAt: number | null): string | null {
  if (observedAt === null) return null;
  return records.filter(row => row.plan === 'startup' && row.startedAt <= observedAt)
    .sort((a, b) => a.startedAt - b.startedAt).at(-1)?.generation ?? null;
}
/** The witness a passing attempt carries, resolved from its retained observation: the observation must itself show
 * the outcome, the source must have been produced by the code generation the record claims, and the claim binds
 * the source time, the executing generation and the capture of exactly what was observed. */
function witnessInput(record: ProofRecord, plan: ProofPlan, context: DecodeContext, executing: string | null) {
  if (record.disposition !== 'passed' || record.capture === null || record.observedAt === null
    || record.capture !== hashOf(record.observed) || !plan.confirms(record.observed) || executing !== record.generation) return null;
  return { type: 'Evidence', schemaVersion: 1, id: `evidence:${captureId(record)}`,
    claim: { subject: plan.capability, predicate: 'probe-passed', value: { ...bindingOf(record), subjectDigest: subjectDigest(plan),
      sourceGeneration: executing, observation: record.capture } },
    source: plan.witness, observedAt: clockAt(context, record.observedAt), freshFor: plan.freshnessMs,
    capture: { reference: `capture:${captureId(record)}`, hash: record.capture }, strength: 'observation' };
}

export interface PlanPosture {
  plan: string; kind: PlanKind; capability: string; rules: readonly number[]; required: boolean; posture: GuardPosture;
  /** Records of this plan that Nine's decoders or the log reader refused (a torn or altered attempt). */
  undecodable: number;
  /** Immutable disagreements between attempts sharing one logical identity (Nine's merge): the source is unavailable. */
  conflicts: number;
  /** The newest source is refused, conflicted or absent from the launch history: unavailable, never an earlier pass. */
  sourceUnavailable: boolean;
  last: { at: number; disposition: ProofDisposition; detail: string; generation: string; observed: Observed; observedAt: number | null } | null;
  lastSuccessAt: number | null; dueAt: number; overdueBy: number;
}
/** A proof-log line of this plan that the reader refused, and how many valid records preceded it in the log. */
export interface RefusedProof { plan: string; after: number }
/** Posture per plan from the durable records, through Nine's decoders, merge and derivations. The adapter supplies
 * what Nine's runtime service resolves from the spine: decoded plans and attempts, the merged record set with its
 * conflicts, per-attempt source availability, and the current independently resolved Evidence inventory. */
export function proofPosture(plans: readonly ProofPlan[], records: readonly ProofRecord[], generation: string,
  ports: Pick<ProofPorts, 'supervisors'>, now: number, refused: readonly RefusedProof[] = []): PlanPosture[] {
  const captures: Record<string, string> = {};
  for (const record of records) if (record.capture) captures[`capture:${captureId(record)}`] = encode(record.observed).bytes;
  const context = decodeContext(captures), at = clockAt(context, now), facts = factContext(context, at);
  return plans.map(plan => {
    const required = plan.required(ports);
    const decodedPlan = attempt(decodeVerificationRecord('VerificationPlan', verificationPlanInput(plan, generation, required), BOUNDARY));
    const positions = records.map((record, index) => ({ record, index }))
      .filter(({ record }) => record.plan === plan.id && record.planVersion === planVersion(plan));
    const current = positions.filter(({ record }) => record.generation === generation);
    const evidence: Evidence[] = [];
    const decoded = current.map(({ record, index }) => {
      const input = witnessInput(record, plan, context, sourceGeneration(records, record.observedAt));
      const witness = input ? attempt(decode('Evidence', input, context)) : null;
      if (witness) evidence.push(witness);
      return { record, index, probe: attempt(decodeVerificationRecord('ProbeRecord', probeInput(record, plan), BOUNDARY)) };
    });
    const valid = decoded.filter((row): row is typeof row & { probe: ProbeRecord } => row.probe !== null);
    // Nine's merge: attempts sharing one logical identity with different content are a conflict, never file order.
    const merged = mergeVerificationRecords(valid.map(row => row.probe));
    const conflicted = new Set(merged.conflicts.flatMap(conflict => valid.filter(row =>
      conflict.facts.includes(verificationIdentity(row.probe).canonicalHash)).map(row => row.probe.id)));
    const resolved: (ProbePostureResolution & { record: ProofRecord })[] = decodedPlan ? valid.map(({ record, probe }) => {
      const available = !conflicted.has(probe.id);
      return { record, probe, sourceStatus: available ? 'available' as const : 'unavailable' as const,
        bound: available && probeBoundToCurrentEvidence(decodedPlan, probe, at, evidence, context, facts, BOUNDARY) };
    }) : [];
    // The newest attempt is the last in the append-only log; a refused newest line is an unavailable source.
    const newestValid = valid.at(-1)?.index ?? -1;
    const undecodable = decoded.length - valid.length + refused.filter(row => row.plan === plan.id).length;
    const sourceUnavailable = conflicted.size > 0 || (decoded.at(-1) !== undefined && decoded.at(-1)!.probe === null)
      || refused.some(row => row.plan === plan.id && row.after > newestValid);
    const derived = decodedPlan ? deriveGuardPosture(decodedPlan, resolved, at, generation, true).posture : 'unknown';
    const posture: GuardPosture = sourceUnavailable && derived !== 'inactive' ? 'unknown' : derived;
    const probes: ProbeRecord[] = valid.map(row => row.probe);
    const [due] = decodedPlan ? deriveVerificationDue([decodedPlan as VerificationPlan], probes, at) : [];
    const last = positions.at(-1)?.record, success = resolved.filter(row => row.record.disposition === 'passed' && row.bound).at(-1)?.record;
    return { plan: plan.id, kind: plan.kind, capability: plan.capability, rules: plan.rules, required, posture, undecodable,
      conflicts: merged.conflicts.length, sourceUnavailable,
      last: last ? { at: last.completedAt, disposition: last.disposition, detail: last.detail, generation: last.generation,
        observed: last.observed, observedAt: last.observedAt } : null,
      lastSuccessAt: success?.completedAt ?? null, dueAt: due?.dueAt ?? 0, overdueBy: required ? due?.overdueBy ?? 0 : 0 };
  });
}

/** The single most overdue required cadence plan, or null. Launch plans run once per start, not here. */
export function nextDuePlan(plans: readonly ProofPlan[], records: readonly ProofRecord[], generation: string,
  ports: Pick<ProofPorts, 'supervisors'>, now: number): ProofPlan | null {
  const due = proofPosture(plans, records, generation, ports, now)
    .filter(row => row.required && now >= row.dueAt && plans.find(plan => plan.id === row.plan)!.trigger === 'cadence')
    .sort((a, b) => a.dueAt - b.dueAt || a.plan.localeCompare(b.plan))[0];
  return due ? plans.find(plan => plan.id === due.plan)! : null;
}

/** Execute one plan's probe. A probe that throws is recorded as unknown with no observation, never as a pass. */
export function executeProof(plan: ProofPlan, ports: ProofPorts, generation: string, elapsed: () => number): ProofRecord {
  const startedAt = ports.now(), began = elapsed();
  let result: ProofOutcome;
  try { result = plan.probe(ports); }
  catch { result = outcome('unknown', {}, 'the probe could not observe its state', null); }
  const completedAt = Math.max(startedAt, ports.now(), startedAt + Math.round(elapsed() - began));
  // A source time after the attempt ended is not an observation this attempt made.
  const observedAt = result.observedAt !== null && Number.isSafeInteger(result.observedAt) && result.observedAt <= completedAt ? result.observedAt : null;
  return { v: 1, plan: plan.id, planVersion: planVersion(plan), generation, startedAt, completedAt,
    disposition: result.disposition === 'passed' && (observedAt === null || !plan.confirms(result.observed)) ? 'unknown' : result.disposition,
    observed: result.observed, detail: result.detail, observedAt, capture: observedAt === null ? null : hashOf(result.observed) };
}

/** Rule 38: every business step of each critical pipeline, and the supervisor that reaches it. No business step is
 * exempt: the only deterministic bootstrap the scheduled-work design allows admits the supervisor call itself, and
 * that is not a roster member. A step whose supervisor is off in a launch, or has no verdict, stays visible as missing. */
export interface PipelineStep { step: string; supervisors: readonly Supervisor[] }
export type Supervisor = 'reply-review' | 'summary-review' | 'step-check';
export interface Pipeline { failureDirection: 'open' | 'closed'; steps: readonly PipelineStep[]; owner: string }
export const CRITICAL_PIPELINES: Readonly<Record<string, Pipeline>> = Object.freeze({
  'operator-reply': { failureDirection: 'closed',
    owner: 'reply review holds the send without a pass; the step supervisor observes intake, preparation, answer and cleanup',
    steps: [
      { step: 'intake', supervisors: ['step-check'] },
      { step: 'prepare-packet', supervisors: ['step-check'] },
      { step: 'answer', supervisors: ['reply-review', 'step-check'] },
      { step: 'interpret', supervisors: ['reply-review'] },
      { step: 'send', supervisors: ['reply-review'] },
      { step: 'cleanup', supervisors: ['step-check'] },
    ] },
  'requested-summary': { failureDirection: 'closed',
    owner: 'the step supervisor validates due selection and preparation before the model call; reply review holds the send without a pass',
    steps: [
      { step: 'select-due', supervisors: ['step-check'] },
      { step: 'prepare-packet', supervisors: ['step-check'] },
      { step: 'summarize', supervisors: ['reply-review', 'step-check'] },
      { step: 'send', supervisors: ['reply-review'] },
    ] },
  'rolling-summary': { failureDirection: 'open', owner: 'the faithfulness verdict is recorded with each commit',
    steps: [
      { step: 'summarize', supervisors: ['summary-review', 'step-check'] },
      { step: 'commit-summary', supervisors: ['summary-review'] },
    ] },
  'requested-reminder': { failureDirection: 'open',
    owner: 'the step supervisor validates due selection and the reminder line before the send; only a violation keeps it unsent',
    steps: [
      { step: 'select-due', supervisors: ['step-check'] },
      { step: 'send', supervisors: ['step-check'] },
    ] },
});

type StepState = 'validated' | 'failed' | 'unavailable' | 'missing';
interface Operation { id: string; states: Partial<Record<string, { state: StepState; attempt: string; resolution: string }>> }
const verdictState = (verdict: string | undefined): StepState => verdict === 'pass' ? 'validated'
  : verdict === 'violation' || verdict === 'lost' ? 'failed' : verdict === undefined ? 'missing' : 'unavailable';
function stepState(view: JournalView, supervisor: Supervisor, key: string, supervisors: ProofPorts['supervisors']) {
  if (supervisor === 'reply-review') {
    if (!supervisors.replyReview) return null;
    const turn = view.turns.get(key), checks = turn?.replyChecks ?? [], last = checks.at(-1);
    const passed = checks.findIndex(check => check.verdict === 'pass');
    return passed >= 0 ? { state: 'validated' as const, attempt: `reply-check:${key}:${passed}`, resolution: 'pass' }
      : last ? { state: verdictState(last.verdict), attempt: `reply-check:${key}:${checks.length - 1}`, resolution: last.verdict } : null;
  }
  if (supervisor === 'summary-review') {
    if (!supervisors.summaryReview) return null;
    const summary = view.summaries.find(item => `summary:${item.through}` === key);
    return summary?.faithfulness ? { state: verdictState(summary.faithfulness.verdict), attempt: key, resolution: summary.faithfulness.verdict } : null;
  }
  if (!supervisors.stepCheck) return null;
  const step = view.stepChecks.get(key);
  return step?.result ? { state: verdictState(step.result.verdict), attempt: `step-check:${key}`, resolution: step.result.verdict } : null;
}
/** The complete population of each pipeline, one operation per actual attempt, with each step's own supervision. */
function operations(view: JournalView, pipeline: string, supervisors: ProofPorts['supervisors']): Operation[] {
  const byTurn = (turn: Turn, steps: Record<string, [Supervisor, string][]>): Operation => ({ id: turn.id,
    states: Object.fromEntries(Object.entries(steps).map(([step, reach]) => {
      const seen = reach.map(([supervisor, key]) => stepState(view, supervisor, key, supervisors)).filter(item => item !== null);
      const best = seen.find(item => item.state === 'validated') ?? seen.find(item => item.state === 'failed')
        ?? seen.find(item => item.state === 'unavailable') ?? seen[0];
      return [step, best];
    })) });
  if (pipeline === 'operator-reply') return view.order.filter(turn => replyTurn(turn) && turn.intent !== undefined).map(turn => byTurn(turn, {
    intake: [['step-check', `intake:${turn.id}`]], 'prepare-packet': [['step-check', `prepare:${turn.id}`]],
    answer: [['reply-review', turn.id], ['step-check', `answer:${turn.id}`]], interpret: [['reply-review', turn.id]],
    send: [['reply-review', turn.id]], cleanup: [['step-check', `cleanup:${turn.id}`]] }));
  if (pipeline === 'requested-summary') return view.order.filter(turn => requestedSummaryTurn(turn) && turn.intent !== undefined).map(turn => {
    // The pre-model checks bound to the packet this summary was actually prepared with.
    const packet = turn.prompt === undefined ? null : packetDigest(turn.prompt);
    const bound = (prefix: string) => [...view.stepChecks.keys()].filter(key => key.startsWith(`${prefix}:${turn.id}:`)
      && (packet === null || key.endsWith(`:${packet}`)));
    return byTurn(turn, { 'select-due': bound('select-due').map(key => ['step-check', key] as [Supervisor, string]),
      'prepare-packet': bound('prepare').map(key => ['step-check', key] as [Supervisor, string]),
      summarize: [['reply-review', turn.id], ['step-check', `answer:${turn.id}`]], send: [['reply-review', turn.id]] });
  });
  if (pipeline === 'rolling-summary') return view.summaries.map(summary => ({ id: `summary:${summary.through}`, states: {
    summarize: [stepState(view, 'summary-review', `summary:${summary.through}`, supervisors), stepState(view, 'step-check', `summary:${summary.through}`, supervisors)]
      .filter(item => item !== null).sort((a, b) => Number(b.state === 'validated') - Number(a.state === 'validated'))[0],
    'commit-summary': stepState(view, 'summary-review', `summary:${summary.through}`, supervisors) ?? undefined } }));
  // One operation per requested reminder actually sent or attempted; a legacy morning batch has no reminder steps.
  return [...view.reminders.entries()].flatMap(([key, batch]) => batch.requested ? batch.items.map(ref => {
    const id = reminderId(ref);
    return { id, states: { 'select-due': stepState(view, 'step-check', `reminder-due:${id}`, supervisors) ?? undefined,
      send: stepState(view, 'step-check', `reminder-send:${id}`, supervisors) ?? undefined } };
  }) : [{ id: `reminder:${key}`, states: {} }]);
}
export interface StepCoverageRow {
  boundary: string; supervisors: readonly Supervisor[];
  /** Operations (actual attempts) of this pipeline; each boundary is judged over all of them. */
  population: number; validated: number; failed: number; unavailable: number; missing: number;
  state: StepState | 'no-population'; references: readonly string[];
}
/** Observed supervision per pipeline step over the complete population, through Nine's coverage function per
 * operation: one reviewed attempt never covers another, and an off supervisor contributes nothing (Rule 73). */
export function stepCoverage(view: JournalView, supervisors: ProofPorts['supervisors']): Record<string, { failureDirection: 'open' | 'closed'; owner: string; rows: StepCoverageRow[] }> {
  return Object.fromEntries(Object.entries(CRITICAL_PIPELINES).map(([pipeline, declared]) => {
    const population = operations(view, pipeline, supervisors);
    const rows = declared.steps.map(step => {
      const counts = { validated: 0, failed: 0, unavailable: 0, missing: 0 }, references: string[] = [];
      for (const operation of population) {
        const seen = operation.states[step.step];
        const [row] = supervisionCoverage([step.step], seen && seen.state !== 'failed' ? [{ boundary: step.step, state: seen.state === 'validated' ? 'validated' : 'unavailable',
          attempt: seen.attempt, resolution: seen.resolution, operation: operation.id, recursivelySupervisesOwnCall: false }] : []);
        const state: StepState = seen?.state === 'failed' ? 'failed' : row!.state === 'validated' ? 'validated' : row!.state === 'unavailable' ? 'unavailable' : 'missing';
        counts[state]++;
        if (seen && references.length < 6) references.push(seen.attempt);
      }
      const state = population.length === 0 ? 'no-population' as const : counts.failed ? 'failed' as const
        : counts.missing ? 'missing' as const : counts.unavailable ? 'unavailable' as const : 'validated' as const;
      return { boundary: step.step, supervisors: step.supervisors, population: population.length, ...counts, state, references };
    });
    return [pipeline, { failureDirection: declared.failureDirection, owner: declared.owner, rows }];
  }));
}
