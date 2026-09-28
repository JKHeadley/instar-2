/** Due verification plans for the live journal runner, and the probes that execute them
 * (Rules 9, 26, 38, 39, 43, 73). A plan is a declared check with a cadence and freshness
 * window; a probe observes the underlying state through the ports it is handed and returns
 * what it saw. This module never touches the filesystem, the process or the clock itself:
 * the architecture check (NF-26) holds it to its observation ports, so a flag, a filename,
 * a process's existence or a loop tick cannot stand in for the outcome.
 *
 * Due items and posture are Nine's own derivations (`deriveVerificationDue`,
 * `deriveGuardPosture`); step coverage is Nine's `supervisionCoverage`. The preview does not
 * run the production fact store, so its records cross that decoder boundary by the one
 * documented cast in `corePlan`/`coreProbe` and map field-for-field when it does. */
import { deriveGuardPosture, deriveVerificationDue, supervisionCoverage } from '../../src/verification/index.js';
import type { GuardPosture, ProbeRecord, SupervisionCoverageRow, SupervisionObservation, VerificationPlan } from '../../src/verification/index.js';
import type { Clock } from '../../src/index.js';
import { isStatusCommand } from './status-command.js';
import { loopHealth } from './obligations.js';
import type { JournalView } from './journal.js';

const MINUTE = 60_000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;

export type ProofDisposition = 'passed' | 'failed' | 'unknown';
export type Observed = Readonly<Record<string, string | number | boolean | null>>;
/** One executed attempt, as written to the durable proof log. */
export interface ProofRecord {
  v: 1; plan: string; planVersion: string; generation: string; startedAt: number; completedAt: number;
  disposition: ProofDisposition; observed: Observed; detail: string;
}
/** What a live-surface proof observed in the journal: an operator message whose reply Telegram accepted, one whose
 * hold notice Telegram accepted, or an operator stop that latched with nothing sent after it. */
export type LiveFact = 'reply-accepted' | 'held-notice-accepted' | 'stop-latched';
/** A live-surface proof bound to the capability version the running launch declared. */
export interface LiveProofRecord {
  v: 1; liveProof: string; capability: string; version: string; fact: LiveFact; update: number; messageId: number | null; recordedAt: number;
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
}
export interface ProofOutcome { disposition: ProofDisposition; observed: Observed; detail: string }

export type PlanKind = 'startup' | 'critical-outcome' | 'restore' | 'agreement' | 'duty';
export interface ProofPlan {
  id: string; kind: PlanKind; rules: readonly number[]; capability: string;
  /** What underlying state the probe reads (the evidence source, not a symbol of it). */
  observes: string;
  cadenceMs: number; freshnessMs: number;
  /** Launch plans run once per start; cadence plans run when due. */
  trigger: 'launch' | 'cadence';
  /** False only for an optional port that is off in this launch: its posture is inactive, never healthy. */
  required(ports: Pick<ProofPorts, 'supervisors'>): boolean;
  probe(ports: ProofPorts): ProofOutcome;
}

/** Rule 26: the journal's content fingerprint, compared field by field between two replays. */
export function journalFingerprint(view: JournalView): Observed {
  return { cursor: view.cursor, turns: view.order.length, accepted: view.order.filter(turn => turn.accepted).length,
    intents: view.order.filter(turn => turn.intent !== undefined).length, sent: view.order.filter(turn => turn.sent !== undefined).length,
    calls: view.calls, replies: view.replies, commitments: view.commitments.length, closed: view.closed.size,
    memory: view.memory.length, summaries: view.summaries.length, stop: view.stop, expires: view.expires };
}
/** Sent model answers and whether each reached its before-send reviewer (fixed projections excluded). */
function sentAnswers(view: JournalView) {
  const answers = view.order.filter(turn => turn.sent !== undefined && turn.answer !== undefined && !turn.noticeClass
    && !isStatusCommand(turn.text));
  return { answers, reviewed: answers.filter(turn => turn.replyChecks?.some(check => check.verdict === 'pass')) };
}
const answerCalls = (view: JournalView) => view.callOutcomes.filter(row => row.role === 'model');
const completedCall = (row: JournalView['callOutcomes'][number]) => row.outcome.subtype === 'success' && row.outcome.isError !== true && row.outcome.localLimit === null;

export const PREVIEW_PROOF_PLANS: readonly ProofPlan[] = Object.freeze([
  { id: 'startup', kind: 'startup', rules: [9, 26, 43], capability: 'preview.durable-intake', trigger: 'launch',
    observes: 'authenticated bot identity answer and the replayed journal at launch', cadenceMs: 30 * DAY, freshnessMs: 30 * DAY,
    required: () => true,
    probe: ports => {
      const identity = ports.botIdentity(), view = ports.liveView();
      const observed = { identity: identity?.id ?? null, boundBot: ports.boundBot, ...journalFingerprint(view) };
      if (identity === null) return { disposition: 'unknown', observed, detail: 'no identity answer observed at launch' };
      return identity.id === ports.boundBot ? { disposition: 'passed', observed, detail: 'launched as the bound bot over the replayed journal' }
        : { disposition: 'failed', observed, detail: 'the platform answered with a different bot identity' };
    } },
  { id: 'telegram-identity', kind: 'critical-outcome', rules: [26, 43], capability: 'preview.reply', trigger: 'cadence',
    observes: 'an authenticated getMe answer bound to the recorded bot id', cadenceMs: 6 * HOUR, freshnessMs: 12 * HOUR,
    required: () => true,
    probe: ports => {
      const identity = ports.botIdentity();
      const observed = { identity: identity?.id ?? null, boundBot: ports.boundBot };
      if (identity === null) return { disposition: 'unknown', observed, detail: 'the identity request received no authenticated answer' };
      return identity.id === ports.boundBot ? { disposition: 'passed', observed, detail: 'the chat platform authenticates the bound bot' }
        : { disposition: 'failed', observed, detail: 'the chat platform answered for a different bot' };
    } },
  { id: 'journal-restore', kind: 'restore', rules: [9, 26, 43], capability: 'preview.durable-intake', trigger: 'cadence',
    observes: 'a fresh read-only replay of the encrypted journal compared with the live projection',
    cadenceMs: 6 * HOUR, freshnessMs: 12 * HOUR, required: () => true,
    probe: ports => {
      const live = journalFingerprint(ports.liveView());
      let durable: Observed;
      try { durable = journalFingerprint(ports.durableView()); }
      catch { return { disposition: 'failed', observed: { ...live, restored: false }, detail: 'the durable journal could not be replayed' }; }
      const differing = Object.keys(live).filter(field => live[field] !== durable[field]);
      return differing.length === 0 ? { disposition: 'passed', observed: { ...live, restored: true }, detail: 'the durable replay equals the live projection' }
        : { disposition: 'failed', observed: { ...live, restored: true, differing: differing.join(',') },
          detail: `the durable replay differs from the live projection in ${differing.join(', ')}` };
    } },
  { id: 'reply-drain', kind: 'critical-outcome', rules: [9, 43], capability: 'preview.reply', trigger: 'cadence',
    observes: 'accepted operator messages in the journal and whether each was settled', cadenceMs: 15 * MINUTE, freshnessMs: HOUR,
    required: () => true,
    probe: ports => {
      const health = loopHealth(ports.liveView(), ports.now());
      const observed = { unfinished: health.unfinished, oldestUnfinishedAgeMs: health.oldestUnfinishedAgeMs,
        backlogOverdue: health.backlogOverdue, inhibition: health.inhibition };
      if (health.backlogOverdue && health.inhibition === null)
        return { disposition: 'failed', observed, detail: 'accepted work is past its drain limit with nothing inhibiting it' };
      return { disposition: 'passed', observed, detail: health.backlogOverdue
        ? `accepted work waits on a recorded inhibition: ${health.inhibition}` : 'accepted work is settled or within its drain limit' };
    } },
  { id: 'reply-review-reached', kind: 'duty', rules: [9, 38, 73], capability: 'preview.reply-review', trigger: 'cadence',
    observes: 'each sent model answer and the passing review recorded for it before the send', cadenceMs: HOUR, freshnessMs: 6 * HOUR,
    // Required whatever is wired: an absent reviewer makes this probe fail, it never hides the duty.
    required: () => true,
    probe: ports => {
      const { answers, reviewed } = sentAnswers(ports.liveView());
      const observed = { sentAnswers: answers.length, reviewed: reviewed.length, unreviewed: answers.length - reviewed.length };
      if (answers.length === 0) return { disposition: 'unknown', observed, detail: 'no sent answer yet to observe' };
      return reviewed.length === answers.length ? { disposition: 'passed', observed, detail: 'every sent answer passed its review first' }
        : { disposition: 'failed', observed, detail: `${answers.length - reviewed.length} sent answers have no passing review` };
    } },
  { id: 'provider-outcomes', kind: 'critical-outcome', rules: [39, 43], capability: 'preview.reply', trigger: 'cadence',
    observes: 'the recorded outcomes of the latest answer calls to the model provider', cadenceMs: HOUR, freshnessMs: 6 * HOUR,
    required: () => true,
    probe: ports => {
      const recent = answerCalls(ports.liveView()).slice(-3);
      const completed = recent.filter(completedCall).length;
      const observed = { observedCalls: recent.length, completed };
      if (recent.length === 0) return { disposition: 'unknown', observed, detail: 'no answer call observed yet' };
      return completed > 0 ? { disposition: 'passed', observed, detail: 'recent answer calls completed' }
        : { disposition: 'failed', observed, detail: 'the latest answer calls all failed' };
    } },
  { id: 'summary-checked', kind: 'duty', rules: [9, 38], capability: 'preview.rolling-summary', trigger: 'cadence',
    observes: 'each committed rolling summary and the faithfulness verdict recorded with it', cadenceMs: 6 * HOUR, freshnessMs: DAY,
    required: () => true,
    probe: ports => {
      const summaries = ports.liveView().summaries, checked = summaries.filter(summary => summary.faithfulness !== undefined).length;
      const observed = { summaries: summaries.length, checked };
      if (summaries.length === 0) return { disposition: 'unknown', observed, detail: 'no rolling summary committed yet' };
      return { disposition: checked > 0 ? 'passed' : 'failed', observed,
        detail: checked > 0 ? `${checked} of ${summaries.length} summaries carry a faithfulness verdict` : 'no committed summary carries a faithfulness verdict' };
    } },
  { id: 'step-check-reached', kind: 'duty', rules: [9, 38, 73], capability: 'preview.step-check', trigger: 'cadence',
    observes: 'completed answer and summary steps and the step verdicts recorded for them', cadenceMs: 6 * HOUR, freshnessMs: DAY,
    required: ports => ports.supervisors.stepCheck,
    probe: ports => {
      const checks = [...ports.liveView().stepChecks.values()], done = checks.filter(item => item.result !== undefined).length;
      const observed = { steps: checks.length, verdicts: done };
      if (checks.length === 0) return { disposition: 'unknown', observed, detail: 'no completed step observed yet' };
      return { disposition: done > 0 ? 'passed' : 'failed', observed, detail: `${done} of ${checks.length} steps carry a verdict` };
    } },
]);

/** Plan version is the declared plan itself: changing what a plan observes or how often voids its old records. */
export const planVersion = (plan: ProofPlan) => `v1:${plan.observes}:${plan.cadenceMs}:${plan.freshnessMs}`;

const clock = (value: number) => ({ type: 'Measurement', schemaVersion: 1, subject: { kind: 'clock', instance: 'preview' },
  value, unit: 'ms', at: value, by: 'preview-runner' }) as unknown as Clock;
/** The one decoder-boundary cast: the fields Nine's pure derivations read, filled from the preview's declared plan. */
function corePlan(plan: ProofPlan, generation: string, required: boolean): VerificationPlan {
  return { type: 'VerificationPlan', schemaVersion: 1, id: plan.id, predecessors: [],
    subject: { rules: plan.rules, holder: plan.capability, governed: plan.capability, scope: 'preview', generation },
    arms: [{ id: 'probe', kind: 'probe', executable: plan.id, fixture: '', outputContract: plan.observes, canFail: plan.observes, required }],
    bar: { version: planVersion(plan), predicates: [], sources: [plan.observes], minimumStrength: 'observation', subjectDigest: '',
      captureRequired: false, freshness: plan.freshnessMs, complete: true },
    scheduling: { owner: 'preview-runner', run: 'journal-cycle', loopPolicy: 'one due probe per cycle', cadence: plan.cadenceMs,
      freshnessWindow: plan.freshnessMs, dueAction: 'run', recoveryBudget: 'next cycle' } } as unknown as VerificationPlan;
}
function coreProbe(record: ProofRecord, index: number): ProbeRecord {
  return { type: 'ProbeRecord', schemaVersion: 1, id: `${record.plan}:${record.startedAt}:${index}`, predecessors: [], plan: record.plan,
    planVersion: record.planVersion, arm: 'probe', startedAt: record.startedAt, completedAt: record.completedAt,
    disposition: record.disposition === 'unknown' ? 'inconclusive' : record.disposition,
    missingPhases: record.disposition === 'unknown' ? ['observation'] : [], captureStatus: 'available' } as unknown as ProbeRecord;
}

export interface PlanPosture {
  plan: string; kind: PlanKind; capability: string; rules: readonly number[]; required: boolean; posture: GuardPosture;
  last: { at: number; disposition: ProofDisposition; detail: string; generation: string } | null;
  lastSuccessAt: number | null; dueAt: number; overdueBy: number;
}
/** Posture per plan from the durable records: healthy, failed, stale, unknown (never run or not current), or inactive. */
export function proofPosture(plans: readonly ProofPlan[], records: readonly ProofRecord[], generation: string,
  ports: Pick<ProofPorts, 'supervisors'>, now: number): PlanPosture[] {
  return plans.map(plan => {
    const required = plan.required(ports), core = corePlan(plan, generation, required);
    const own = records.map((record, index) => ({ record, index })).filter(({ record }) => record.plan === plan.id && record.planVersion === planVersion(plan));
    const current = own.filter(({ record }) => record.generation === generation);
    const probes = current.map(({ record, index }) => ({ probe: coreProbe(record, index), sourceStatus: 'available' as const, bound: true }));
    const posture = deriveGuardPosture(core, probes, clock(now), generation, true).posture;
    const [due] = deriveVerificationDue([core], current.map(({ record, index }) => coreProbe(record, index)), clock(now));
    const last = own.at(-1)?.record, success = current.filter(({ record }) => record.disposition === 'passed').at(-1)?.record;
    return { plan: plan.id, kind: plan.kind, capability: plan.capability, rules: plan.rules, required, posture,
      last: last ? { at: last.completedAt, disposition: last.disposition, detail: last.detail, generation: last.generation } : null,
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
  let outcome: ProofOutcome;
  try { outcome = plan.probe(ports); }
  catch { outcome = { disposition: 'unknown', observed: {}, detail: 'the probe could not observe its state' }; }
  return { v: 1, plan: plan.id, planVersion: planVersion(plan), generation, startedAt,
    completedAt: Math.max(startedAt, ports.now(), startedAt + Math.round(elapsed() - began)),
    disposition: outcome.disposition, observed: outcome.observed, detail: outcome.detail };
}

/** Rule 38: every business step of each critical pipeline, and the supervisor that reaches it. */
export interface PipelineStep { step: string; supervisors: readonly ('reply-review' | 'summary-review' | 'step-check')[];
  /** A narrow deterministic exception, stated; only exact tests on recorded state qualify. */
  deterministic?: string; consequential: boolean }
export const CRITICAL_PIPELINES: Readonly<Record<string, readonly PipelineStep[]>> = Object.freeze({
  'operator-reply': [
    { step: 'intake', supervisors: [], deterministic: 'exact verified-operator sender and chat binding; refused input is preserved', consequential: false },
    { step: 'prepare-packet', supervisors: ['step-check'], consequential: false },
    { step: 'answer', supervisors: ['reply-review', 'step-check'], consequential: false },
    { step: 'interpret', supervisors: ['reply-review'], consequential: false },
    { step: 'send', supervisors: ['reply-review'], deterministic: 'exact credential wall and exact API-acceptance comparison', consequential: true },
    { step: 'cleanup', supervisors: ['step-check'], deterministic: 'deterministic coherence check of the recorded reply', consequential: false },
  ],
  'rolling-summary': [
    { step: 'summarize', supervisors: ['summary-review', 'step-check'], consequential: false },
    { step: 'commit-summary', supervisors: ['summary-review'], consequential: true },
  ],
  'requested-reminder': [
    { step: 'select-due', supervisors: [], deterministic: 'exact due time and grant from the operator request', consequential: false },
    { step: 'send', supervisors: [], deterministic: 'fixed template around the operator’s own redacted quote', consequential: true },
  ],
});

/** Observed supervision per pipeline step from the journal, through Nine's coverage function. Off supervisors
 * contribute nothing: a dark port is `missing`, not validated (Rule 73). */
export function stepCoverage(view: JournalView, supervisors: ProofPorts['supervisors']): Record<string, SupervisionCoverageRow[]> {
  const { answers, reviewed } = sentAnswers(view);
  const observed: Record<'reply-review' | 'summary-review' | 'step-check', 'validated' | 'unavailable' | 'none'> = {
    'reply-review': !supervisors.replyReview ? 'none' : reviewed.length ? 'validated' : answers.length ? 'unavailable' : 'none',
    'summary-review': !supervisors.summaryReview ? 'none' : view.summaries.some(summary => summary.faithfulness !== undefined) ? 'validated'
      : view.summaries.length ? 'unavailable' : 'none',
    'step-check': !supervisors.stepCheck ? 'none' : [...view.stepChecks.values()].some(item => item.result?.verdict === 'pass') ? 'validated'
      : view.stepChecks.size ? 'unavailable' : 'none',
  };
  return Object.fromEntries(Object.entries(CRITICAL_PIPELINES).map(([pipeline, steps]) => {
    const observations: SupervisionObservation[] = steps.flatMap(step => [
      ...step.supervisors.filter(name => observed[name] !== 'none').map(name => ({ boundary: step.step,
        state: observed[name] as 'validated' | 'unavailable', attempt: name, resolution: '', operation: pipeline, recursivelySupervisesOwnCall: false })),
      // A deterministic exception validates a step alone only when no model supervisor is declared for a
      // consequential step: before a consequential effect the model's validation must be reached (Rule 38).
      ...(step.deterministic && (!step.consequential || step.supervisors.length === 0) ? [{ boundary: step.step, state: 'validated' as const, attempt: 'deterministic', resolution: step.deterministic,
        operation: pipeline, recursivelySupervisesOwnCall: false }] : [])]);
    return [pipeline, [...supervisionCoverage(steps.map(step => step.step), observations)]];
  }));
}
