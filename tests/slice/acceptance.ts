// The part-eleven acceptance predicate (docs/15 section 7), as pure functions over
// an execution report. WITHIN one execution reconstruction must be byte-equal;
// ACROSS the control and cut executions only the SEMANTIC predicate holds. Real
// history is never normalized to look like the control.

export interface RebuildRow {
  readonly projection: string; readonly hash: string; readonly resumedHash: string;
  readonly equal: string; readonly folded: number; readonly resumedFrom: unknown;
  readonly values: Readonly<Record<string, unknown>>; readonly conflicts: readonly string[]; readonly taint: readonly string[];
}
export interface ObligationRow { readonly operation: string; readonly state: string; readonly owner: string; readonly blocker: string; readonly exposure: string }
export interface EvidenceRow { readonly operation: string; readonly stage: string; readonly decisive: string; readonly value: string }
export interface ApplicationRow { readonly operation: string; readonly digest: string; readonly semanticMessage: string; readonly messageId: string }
export interface Capability { readonly status: string; readonly source?: string; readonly predicate?: string; readonly observationBudget?: number }
export interface SliceReport {
  readonly boot: number; readonly profile: string; readonly adapter: string;
  readonly registerChecks: readonly string[];
  readonly steps: readonly { readonly step: string; readonly state: string; readonly detail?: string | null }[];
  readonly identityTrail: Readonly<Record<string, readonly string[]>>;
  readonly boundariesReached: readonly string[];
  readonly cutsFired: readonly { readonly boot: number; readonly boundary: string }[];
  readonly intake: null | { readonly logicalId: string; readonly rawHash: string; readonly receipt: string;
    readonly boundOperator: boolean; readonly arrivalAt: number };
  readonly preservedInput: null | { readonly capture: string; readonly bytes: string | null };
  readonly run: null | { readonly id: string; readonly owner: string; readonly opening: string };
  readonly grounding: string;
  readonly judgment: { readonly request: string | null; readonly logicalKey: string | null; readonly resolution: string | null;
    readonly disposition: string | null; readonly capture: string | null; readonly meter: string | null };
  readonly reply: null | { readonly semanticMessage: string; readonly basis: string; readonly text: string };
  readonly outbound: null | { readonly request: string; readonly digest: string; readonly semanticMessage: string;
    readonly operation: string | null; readonly charge: number | null; readonly observations: readonly string[] };
  readonly settlement: null | { readonly outcome: string; readonly finalCharge: string | null;
    readonly retainedExposure: number; readonly delayedExecutionExcluded: boolean };
  readonly deliveryEvidence: readonly EvidenceRow[];
  readonly obligations: readonly ObligationRow[];
  readonly externalApplications: readonly ApplicationRow[];
  readonly charges: readonly { readonly operation: string; readonly charge: number }[];
  readonly serviceInbound: number;
  readonly operations: readonly string[]; readonly semanticKeys: readonly string[]; readonly routes: readonly string[];
  readonly adapterCapabilities: Readonly<Record<string, Capability>>;
  readonly declaredStage: string;
  readonly rebuilds: readonly RebuildRow[];
  readonly accounting: { readonly facts: number; readonly bytes: number; readonly boots: number; readonly attempts: number;
    readonly notifications: number; readonly tokens: null | Readonly<Record<string, number | null>>;
    readonly money: number; readonly peakRssBytes: number; readonly peakRssSamples: number;
    readonly durationMs: number; readonly measuredBoots: number;
    readonly perBootDurationMs: readonly { readonly boot: number; readonly durationMs: number | null; readonly bounded: boolean }[] };
}

/** Terminal or OWNED-PENDING dispositions. Nothing else may appear in a passing run. */
export const ALLOWED_OBLIGATION_STATES: readonly string[] = [
  'prepared', 'observed-executor-accepted', 'observed-response', 'observed-unknown',
  'recovered-executor-accepted', 'recovered-response', 'recovered-unknown', 'recovered-lookup', 'recovered-none',
  'dispatch-uncertain', 'settled-happened', 'settled-did-not-happen', 'settled-uncertain',
  'owned-uncertain', 'owned-unapplied-unsettled', 'owned-pending-unadmitted', 'owned-pending-no-answer',
  'refused-before-preparation',
];

export interface Bounds {
  readonly maxFacts: number; readonly maxBytes: number; readonly maxBoots: number;
  readonly maxAttempts: number; readonly maxNotifications: number; readonly maxMoney: number;
  readonly maxRssBytes: number; readonly maxTokens: number; readonly maxDurationMs: number;
}
/**
 * DECLARED finite bounds, not measured targets. docs/15 section 7 asks that the
 * recorded quantities fall inside declared finite bounds; it forbids presenting a
 * configured number as a measurement. These are deliberately generous so a slower
 * machine cannot turn a finiteness check into a performance assertion.
 */
export const DECLARED_BOUNDS: Bounds = { maxFacts: 400, maxBytes: 4_000_000, maxBoots: 40,
  maxAttempts: 8, maxNotifications: 1, maxMoney: 64, maxRssBytes: 2_000_000_000, maxTokens: 4096,
  maxDurationMs: 600_000 };

/** States that mean the obligation is still open and must still carry its exposure. */
export const OPEN_OBLIGATION_STATES: readonly string[] = ALLOWED_OBLIGATION_STATES
  .filter(state => state.startsWith('owned-') || state === 'dispatch-uncertain');
/** An obligation naming one of these carries no charge, so it retains no exposure. */
const CHARGE_FREE_PREFIXES = ['grounding:'];

const single = (values: readonly string[] | undefined) => !values || values.length <= 1;

/** Checks that hold WITHIN one execution. Returns the violations, empty when it passes. */
export function withinExecution(report: SliceReport, expectedInput: string, bounds: Bounds = DECLARED_BOUNDS): string[] {
  const bad: string[] = [];

  // input preserved
  if (!report.intake) bad.push('no admitted input');
  if (!report.preservedInput || report.preservedInput.bytes !== expectedInput) bad.push('accepted input was not preserved byte-for-byte');
  if (report.intake && report.preservedInput && report.intake.rawHash !== report.preservedInput.capture)
    bad.push('admitted arrival hash differs from the preserved capture');

  // one admitted input, one durable run identity
  if (!report.run) bad.push('no durable run identity');

  // stable logical identities through takeover, within this execution
  for (const key of ['logicalId', 'run', 'request', 'operation', 'judgmentRequest', 'judgmentResolution', 'logicalKey', 'inputDigest', 'digest', 'semanticMessage'])
    if (!single(report.identityTrail[key])) bad.push(`logical identity ${key} changed through takeover: ${JSON.stringify(report.identityTrail[key])}`);

  // no action outside its floor; at most one semantic key, provider route and operation
  if (report.operations.length > 1) bad.push('more than one six-owned operation for this run');
  if (report.semanticKeys.length > 1) bad.push('more than one semantic message key');
  if (report.routes.length > 1) bad.push('more than one external route');

  // at most one external application per semantic outbound identity
  const bySemantic = new Map<string, number>();
  for (const row of report.externalApplications) bySemantic.set(row.semanticMessage, (bySemantic.get(row.semanticMessage) ?? 0) + 1);
  for (const [key, count] of bySemantic) if (count > 1) bad.push(`${count} external applications for semantic identity ${key}`);
  const byOperation = new Set(report.externalApplications.map(r => r.operation));
  if (byOperation.size !== report.externalApplications.length) bad.push('two applications share one operation identity');

  // ---------------------------------------------------------------- progress floor
  // Without a LOWER bound the predicate cannot tell an honestly owned-pending
  // execution from one that silently did nothing: every other check below is
  // conditional on the thing it checks being present, so an empty report passes
  // them all. Both branches of docs/15 section 7 require something OWNED to exist —
  // the positive slice demands "one attributable outbound operation" and "no open
  // ownerless obligation", the uncertainty neighbour demands that "the same logical
  // operation remains owned and uncertain, its maximum ... exposure remains reserved".
  if (!report.settlement && !report.obligations.length)
    bad.push('no settlement and no owned obligation: the execution recorded neither progress nor a reason for its absence');
  if (report.outbound?.operation && !report.obligations.some(o => o.operation === report.outbound!.operation))
    bad.push('an admitted outbound operation with no recorded obligation');
  if (report.outbound && report.outbound.operation === null
    && !report.obligations.some(o => o.state.startsWith('owned-pending') || o.state === 'refused-before-preparation'))
    bad.push('an outbound operation six never admitted, with no owned-pending obligation naming the blocker');
  if (report.run && !report.reply && !report.obligations.some(o => o.state.startsWith('owned-pending')))
    bad.push('the chain rendered no attributable reply and recorded no owned-pending reason');
  if (report.settlement && !report.deliveryEvidence.length)
    bad.push('a settlement with no independent delivery evidence behind it');

  // every obligation is terminal or owned-pending, owned, and well formed
  for (const row of report.obligations) {
    if (!ALLOWED_OBLIGATION_STATES.includes(row.state)) bad.push(`obligation state outside the allowed set: ${row.state}`);
    if (!row.owner) bad.push(`ownerless obligation for ${row.operation}`);
    if (!row.operation) bad.push('obligation without an operation identity');
    if (!row.blocker) bad.push(`obligation for ${row.operation} names no blocker, not even 'none'`);
    const exposure = Number(row.exposure);
    if (!Number.isFinite(exposure) || exposure < 0) bad.push(`obligation for ${row.operation} has no finite exposure`);
    // An OPEN obligation over a charge-bearing operation must still hold a reservation.
    if (OPEN_OBLIGATION_STATES.includes(row.state) && !CHARGE_FREE_PREFIXES.some(p => row.operation.startsWith(p)) && exposure <= 0)
      bad.push(`open obligation ${row.state} for ${row.operation} released its exposure`);
  }

  // evidence truthful to its source and stage
  for (const row of report.deliveryEvidence) {
    if (row.stage !== report.declaredStage) bad.push(`evidence claims stage ${row.stage} beyond the adapter's declared stage`);
    const applied = report.externalApplications.some(a => a.operation === row.operation);
    if (row.value === 'happened' && !applied) bad.push('evidence claims application with no journal row');
    if (row.value === 'did-not-happen') {
      if (applied) bad.push('evidence claims non-occurrence while the journal records an application');
      if (report.adapterCapabilities.decisiveNonOccurrence?.status !== 'supported')
        bad.push('non-occurrence claimed on an adapter that declares it unsupported');
      if (row.decisive !== 'decisive') bad.push('non-occurrence claimed without a decisive observation');
    }
  }

  // exposure retained wherever the effect is not settled with a known charge
  const latest = new Map<string, ObligationRow>();
  for (const row of report.obligations) latest.set(row.operation, row);
  if (report.outbound && report.outbound.charge !== null) {
    const row = latest.get(report.outbound.operation ?? '');
    if (!report.settlement) {
      if (row && Number(row.exposure) < report.outbound.charge) bad.push('unsettled operation released exposure');
    } else if (report.settlement.finalCharge === null && report.settlement.retainedExposure < report.outbound.charge)
      bad.push('unknown final charge did not retain maximum exposure');
  }
  if (report.settlement && report.settlement.outcome === 'uncertain' && report.settlement.finalCharge !== null)
    bad.push('an uncertain settlement cannot name a final charge');

  // delivery proved only to the declared stage; a supported final charge only when decisive
  if (report.settlement && report.settlement.delayedExecutionExcluded
    && report.adapterCapabilities.exclusionOfDelayedExecution?.status !== 'supported')
    bad.push('delayed execution excluded on an adapter that declares no quiescence evidence');

  // within-execution reconstruction equality at one pinned vector
  if (!report.rebuilds.length) bad.push('no projection was rebuilt');
  for (const row of report.rebuilds) {
    if (row.equal !== 'equal') bad.push(`${row.projection}: checkpoint rebuild differs from genesis rebuild (${row.equal})`);
    if (row.hash !== row.resumedHash) bad.push(`${row.projection}: rebuild hashes differ`);
    if (row.taint.length) bad.push(`${row.projection}: tainted view`);
    if (row.conflicts.length) bad.push(`${row.projection}: conflicted view`);
  }

  // recorded accounting inside declared finite bounds
  const a = report.accounting;
  if (a.durationMs > bounds.maxDurationMs) bad.push('recorded duration beyond the declared bound');
  if (!Number.isSafeInteger(a.durationMs) || a.durationMs < 0) bad.push('accounting durationMs is missing');
  if (a.perBootDurationMs.length !== a.boots) bad.push('a boot of this execution has no recorded duration row');
  if (a.measuredBoots < 1) bad.push('no boot of this execution recorded a completed duration');
  // The RSS figure must be a real high-water mark over samples, not one instant.
  if (a.peakRssSamples < a.boots) bad.push('fewer memory samples than boots: peak memory is not measured across the execution');
  // `notifications` is the external application count under another name; the reply
  // IS this slice's only user-visible notification. Assert the alias rather than
  // presenting it as an independent quantity.
  if (a.notifications !== report.externalApplications.length)
    bad.push('the notification count disagrees with the external application count it aliases');
  if (a.facts > bounds.maxFacts) bad.push('fact count beyond the declared bound');
  if (a.bytes > bounds.maxBytes) bad.push('durable bytes beyond the declared bound');
  if (a.boots > bounds.maxBoots) bad.push('boot count beyond the declared bound');
  if (a.attempts > bounds.maxAttempts) bad.push('attempt count beyond the declared bound');
  if (a.notifications > bounds.maxNotifications) bad.push('notification count beyond the declared bound');
  if (a.money > bounds.maxMoney) bad.push('recorded charge beyond the declared bound');
  if (a.peakRssBytes > bounds.maxRssBytes) bad.push('peak memory beyond the declared bound');
  if (a.tokens) { const total = (a.tokens.inputTokens ?? 0) + (a.tokens.outputTokens ?? 0);
    if (total > bounds.maxTokens) bad.push('token count beyond the declared bound'); }
  for (const key of ['facts', 'bytes', 'boots', 'attempts', 'notifications', 'money', 'peakRssBytes', 'peakRssSamples'] as const)
    if (!Number.isFinite(a[key])) bad.push(`accounting ${key} is missing`);
  // Tokens are required exactly when a judgment resolved, and absent otherwise.
  if (report.judgment.resolution && !a.tokens) bad.push('a resolved judgment recorded no token usage');
  if (!report.judgment.request && a.tokens) bad.push('token usage recorded without a judgment');
  return bad;
}

/**
 * The semantic predicate ACROSS the uninterrupted control and a cut execution.
 *
 * Identity STABILITY is a within-execution property, so this never demands that a
 * position-derived identity (the run id, and the judgment logical key derived from
 * it) match between two separate executions: a redelivery before the durable
 * receipt legitimately changes where the opening fact lands. What must match is
 * what is SEMANTIC: the conversation-event identity, the preserved bytes, and the
 * outbound request/operation/message identities, which are derived from content.
 */
export function acrossExecutions(control: SliceReport, cut: SliceReport): string[] {
  const bad: string[] = [];
  if (!control.intake || !cut.intake) { bad.push('an execution has no admitted input'); return bad; }
  if (control.intake.logicalId !== cut.intake.logicalId) bad.push('intake logical identity differs across executions');
  if (control.intake.rawHash !== cut.intake.rawHash) bad.push('preserved arrival hash differs across executions');
  if (!control.run || !cut.run) bad.push('an execution has no durable run identity');
  if (control.run && cut.run && control.run.owner !== cut.run.owner) bad.push('run accountability differs across executions');
  for (const report of [control, cut]) {
    if (!single(report.identityTrail['run'])) bad.push('run identity changed through takeover');
    if (!single(report.identityTrail['logicalKey'])) bad.push('judgment logical key changed through takeover');
  }
  if (control.outbound && cut.outbound && control.outbound.request !== cut.outbound.request)
    bad.push('outbound operation identity differs across executions');
  // The payload digest covers the rendered message, whose run and source-result
  // references are position-derived; it must be stable WITHIN an execution, not between two.
  for (const report of [control, cut]) if (!single(report.identityTrail['digest'])) bad.push('outbound payload digest changed through takeover');
  if (control.outbound?.operation && cut.outbound?.operation && control.outbound.operation !== cut.outbound.operation)
    bad.push('six-owned operation identity differs across executions');
  if (control.outbound && cut.outbound && control.outbound.semanticMessage !== cut.outbound.semanticMessage)
    bad.push('semantic message identity differs across executions');
  for (const [name, report] of [['control', control], ['cut', cut]] as const) {
    const perSemantic = new Map<string, number>();
    for (const row of report.externalApplications) perSemantic.set(row.semanticMessage, (perSemantic.get(row.semanticMessage) ?? 0) + 1);
    for (const [, count] of perSemantic) if (count > 1) bad.push('more than one external application for a semantic identity');
    for (const row of report.obligations) if (!ALLOWED_OBLIGATION_STATES.includes(row.state)) bad.push(`disallowed obligation ${row.state}`);
    // The same progress floor on BOTH sides: neither execution may be empty.
    if (!report.settlement && !report.obligations.length)
      bad.push(`${name} execution recorded no settlement and no owned obligation`);
  }
  // A cut BEFORE the reply legitimately has no outbound where the control has one, and
  // the judgment profile is REQUIRED to render no reply without a recorded answer — so
  // this never demands outbound parity. What it demands is that the execution which
  // stopped earlier says WHY, in an owned-pending obligation.
  for (const [name, earlier, later] of [['cut', cut, control], ['control', control, cut]] as const) {
    if (later.outbound && !earlier.outbound && !earlier.obligations.some(o => o.state.startsWith('owned-pending')))
      bad.push(`the ${name} execution has no outbound operation and no owned-pending obligation explaining its absence`);
  }
  // Reply CONTENT need not match; identity, disposition and uniqueness must.
  return bad;
}

/** Every adjacent pair of the enumerated durable boundaries. */
export function adjacentPairs(boundaries: readonly string[]): readonly (readonly [string, string])[] {
  const pairs: (readonly [string, string])[] = [];
  for (let i = 0; i + 1 < boundaries.length; i++) pairs.push([boundaries[i]!, boundaries[i + 1]!]);
  return pairs;
}
