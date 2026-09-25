import type { Clock, FactEnvelopeReference, Hash, Result } from '../index.js';
import type { FactEnvelope, FactStorePort } from '../facts/index.js';
import { hashBytes } from '../facts/index.js';
import type { GroundingReadPort } from '../rungraph/index.js';
import type { AssemblyDecodeContext, AssemblyRuntimePort, ContextDeliverySpecification, HarnessLaunchSpec } from './contracts.js';
import { contextDeliveryIdFor } from './context-delivery.js';
import type { ProductionGroundingReaderInput } from './context-delivery.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';

/** R5 bounded grounding: a small provenance-bound source packet selected once,
 * delivered through Ten/Eight/Five, rendered into Seven's canonical request and
 * verified against the bytes the model adapter actually receives. It reuses Two's
 * `rungraph-briefing-material` facts and captures; it is not recall and adds no store. */

/** Preprocessing ceilings for the candidate corpus. They never grant submission size:
 * every provider, delivery and outbound bound is measured separately below. */
export const GROUNDING_CORPUS_LIMITS = freeze({ maxItems: 8, maxItemBytes: 16384, maxCorpusBytes: 65536 });

export type GroundingItemKind = 'purpose' | 'contract' | 'directive' | 'installation-status';
const itemKinds: readonly GroundingItemKind[] = ['purpose', 'contract', 'directive', 'installation-status'];

/** One labelled evidence item. Static documents cite path + immutable revision +
 * preserved source capture; derived status/directives cite their owner facts. The
 * approval is evidence of standing, never an authority flag; `synthetic` labels
 * offline test approvals honestly. */
export interface GroundingSourceItem {
  readonly id: string; readonly kind: GroundingItemKind;
  readonly source: Readonly<{ path: string; revision: string; capture: string; hash: string; selector: string; facts: readonly string[] }>;
  readonly selectedHash: string; readonly content: string;
  readonly scope: string; readonly audience: readonly string[];
  readonly standing: Readonly<{ approval: string; version: string; synthetic: boolean }>;
  readonly observedAt: number; readonly effectiveAt: number;
}
export interface GroundingBriefingBody { readonly class: string; readonly content: string }

const utf8 = (value: string) => new TextEncoder().encode(value).length;
const text = (value: unknown, max = 4096): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const exactKeys = (value: object, keys: string) => Object.keys(value).sort().join(',') === keys;

function checkItem(value: unknown): GroundingSourceItem {
  const item = value as GroundingSourceItem;
  ensure(item && typeof item === 'object' && exactKeys(item,
    'audience,content,effectiveAt,id,kind,observedAt,scope,selectedHash,source,standing'), 'grounding item shape differs');
  ensure(text(item.id, 256) && itemKinds.includes(item.kind) && text(item.scope, 512), 'grounding item identity or scope absent');
  const source = item.source;
  ensure(source && exactKeys(source, 'capture,facts,hash,path,revision,selector') && typeof source.path === 'string'
    && typeof source.revision === 'string' && typeof source.capture === 'string' && typeof source.hash === 'string'
    && typeof source.selector === 'string' && Array.isArray(source.facts) && source.facts.every(fact => text(fact, 512)),
  'grounding item source shape differs');
  // A mutable path alone is insufficient: documents need revision + preserved
  // bytes; derived items need their owner fact references.
  ensure(item.kind === 'purpose' || item.kind === 'contract'
    ? text(source.path, 512) && text(source.revision, 128) && text(source.capture, 512) && text(source.hash, 128) && text(source.selector, 256)
    : source.facts.length > 0, 'grounding item provenance incomplete');
  ensure(typeof item.content === 'string' && item.content.length > 0 && utf8(item.content) <= GROUNDING_CORPUS_LIMITS.maxItemBytes
    && item.selectedHash === hashBytes(item.content), 'grounding item content absent, oversized, or differs from its selected hash');
  ensure(Array.isArray(item.audience) && item.audience.length > 0 && item.audience.every(entry => text(entry, 256)),
    'grounding item audience absent');
  const standing = item.standing;
  ensure(standing && exactKeys(standing, 'approval,synthetic,version') && text(standing.approval, 512)
    && text(standing.version, 256) && typeof standing.synthetic === 'boolean', 'grounding item standing absent');
  ensure(Number.isSafeInteger(item.observedAt) && item.observedAt >= 0 && Number.isSafeInteger(item.effectiveAt)
    && item.effectiveAt >= 0 && item.effectiveAt <= item.observedAt, 'grounding item time invalid');
  return item;
}

/** Construct the one bounded `{ class, content }` briefing body for a class. The
 * caller appends it through Two under a registered schema; nothing here writes. */
export function buildGroundingBriefingBody(className: string, items: readonly GroundingSourceItem[],
  context: AssemblyDecodeContext): Result<GroundingBriefingBody> {
  return boundary('BuildGroundingBriefingBody', null, context, () => {
    ensure(text(className, 256), 'briefing class required');
    ensure(Array.isArray(items) && items.length > 0 && items.length <= GROUNDING_CORPUS_LIMITS.maxItems,
      `grounding corpus must hold 1..${GROUNDING_CORPUS_LIMITS.maxItems} items`);
    // Size checks precede any canonical copy of the candidate content.
    ensure(items.reduce((sum, item) => sum + (typeof item?.content === 'string' ? utf8(item.content) : 0), 0)
      <= GROUNDING_CORPUS_LIMITS.maxCorpusBytes, 'grounding corpus exceeds its preprocessing ceiling');
    items.forEach(checkItem);
    ensure(new Set(items.map(item => item.id)).size === items.length, 'grounding item ids repeat');
    return freeze({ class: className, content: encoded({ items }).bytes });
  });
}

/** Strictly decode a stored briefing body. The content must be the exact
 * canonical encoding of its items, so a re-encoded packet can be compared. */
export function decodeGroundingBriefingBody(body: unknown): readonly GroundingSourceItem[] {
  const value = body as GroundingBriefingBody;
  ensure(value && typeof value === 'object' && exactKeys(value, 'class,content') && text(value.class, 256)
    && typeof value.content === 'string', 'briefing body is not a bounded { class, content } body');
  ensure(utf8(value.content) <= GROUNDING_CORPUS_LIMITS.maxCorpusBytes, 'briefing body exceeds its preprocessing ceiling');
  const parsed = JSON.parse(value.content) as { items?: unknown };
  ensure(parsed && typeof parsed === 'object' && exactKeys(parsed, 'items') && Array.isArray(parsed.items)
    && parsed.items.length > 0 && parsed.items.length <= GROUNDING_CORPUS_LIMITS.maxItems, 'briefing body items differ');
  ensure(encoded(parsed).bytes === value.content, 'briefing body content is not canonical');
  return parsed.items.map(checkItem);
}

/** The owner plan's exact selection for one turn. Every identity is supplied by
 * the owner plan and verified here; nothing is chosen as "latest". */
export interface GroundingSamplerPlan {
  readonly run: string; readonly opening: string; readonly step: string;
  readonly installation: string; readonly generation: string;
  readonly audience: Readonly<{ principal: string; route: string }>;
  readonly launch: string; readonly executionContext: string;
  readonly stimulusKinds: readonly string[];
  /** Exact ordered admitted inputs of this conversation; the last is the current input. */
  readonly frontier: readonly string[];
  /** Accepted replies to earlier inputs, by Seven ProviderAnswerAcceptance fact. */
  readonly replies: readonly Readonly<{ input: string; acceptance: string }>[];
  /** Installed Five briefing classes, each bound to its approved body fact and permitted item kinds. */
  readonly briefing: readonly Readonly<{ class: string; fact: string; digest: string; kinds: readonly GroundingItemKind[] }>[];
  readonly approvals: readonly string[];
  readonly threshold: number; readonly statusMaxAge: number;
  readonly previousActivity: Clock;
}

export interface GroundingSamplerInput {
  readonly store: FactStorePort;
  readonly runtime: AssemblyRuntimePort;
  readonly context: AssemblyDecodeContext;
  /** Read at every invocation, never cached. */
  plan(): GroundingSamplerPlan;
  captures: Readonly<{ read(reference: string): string | null }>;
  /** Eight's admitted context-delivery operation for exactly this input capture. */
  admitDelivery(input: Readonly<{ intake: FactEnvelope; capture: Readonly<{ reference: string; hash: string }> }>):
    Readonly<{ operation: string; claim: string }>;
}

type Row = Readonly<{ fact: FactEnvelope; taint: readonly unknown[]; conflicts: readonly unknown[] }>;
const record = (value: unknown): Readonly<Record<string, unknown>> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {};
const clean = (row: Row | undefined, detail: string): FactEnvelope => {
  ensure(row && row.taint.length === 0 && row.conflicts.length === 0, detail);
  return row.fact;
};
const inputCapture = (fact: FactEnvelope) => {
  const capture = record(record(fact.body).capture);
  ensure(text(capture.reference, 512) && text(capture.hash, 128), 'admitted input carries no capture');
  return { reference: capture.reference as string, hash: capture.hash as string };
};

function resolveBriefing(rows: readonly Row[], plan: GroundingSamplerPlan, at: Clock) {
  return plan.briefing.map(slot => {
    const fact = clean(rows.find(row => row.fact.id === slot.fact),
      `briefing ${slot.class}: approved source unavailable, tainted, or conflicted`);
    ensure(fact.kind === 'rungraph-briefing-material' && fact.contentHash === slot.digest,
      `briefing ${slot.class}: current body differs from its approved selection`);
    ensure(record(fact.body).class === slot.class, `briefing ${slot.class}: body class differs`);
    const items = decodeGroundingBriefingBody(fact.body);
    for (const item of items) {
      // Refusal details name identities only; they never reveal content.
      ensure(slot.kinds.includes(item.kind), `briefing ${slot.class}: item ${item.id} kind is not mapped to this class`);
      ensure(item.scope === plan.installation, `briefing ${slot.class}: item ${item.id} is outside this installation`);
      ensure(item.audience.includes(plan.audience.principal) && item.audience.includes(plan.audience.route),
        `briefing ${slot.class}: item ${item.id} is outside the verified audience or model route`);
      ensure(plan.approvals.includes(item.standing.approval), `briefing ${slot.class}: item ${item.id} lacks current approval`);
      ensure(item.observedAt <= at.value, `briefing ${slot.class}: item ${item.id} observed after this read`);
      if (item.kind === 'installation-status') ensure(at.value - item.observedAt <= plan.statusMaxAge,
        `briefing ${slot.class}: required status ${item.id} is stale`);
      for (const reference of item.source.facts) clean(rows.find(row => row.fact.id === reference),
        `briefing ${slot.class}: item ${item.id} owner evidence unavailable`);
    }
    return fact;
  });
}

/** Build the `ProductionGroundingReaderInput.sample` seam. Delivery, consumption
 * and the final SessionGrounding stay with the existing Ten reader and Five. */
export function createProductionContextSampler(input: GroundingSamplerInput): ProductionGroundingReaderInput['sample'] {
  const configured = Object.freeze({ ...input });
  return (request: Parameters<GroundingReadPort['read']>[0], at: Clock) => boundary('ProductionContextSample', null, configured.context, () => {
    const plan = configured.plan(), view = request.run;
    ensure(view.run.id === plan.run && view.run.opening.id === plan.opening && view.run.generation.id === plan.generation,
      'grounding plan differs from the exact Five Run, opening, or generation');
    ensure(plan.frontier.length > 0 && new Set(plan.frontier).size === plan.frontier.length, 'grounding frontier must be explicit');
    // Over the installed history threshold the work is held until the separately
    // registered continuity path exists; no summary or last-N may stand in.
    ensure(plan.frontier.length <= plan.threshold,
      `grounding history ${plan.frontier.length} exceeds threshold ${plan.threshold}: held for the registered continuity path`);
    const rows = take(configured.store.readForProjection()).entries;
    const inputs = plan.frontier.map(id => clean(rows.find(row => row.fact.id === id), `admitted input ${id} unavailable, tainted, or conflicted`));
    ensure(inputs.every(fact => plan.stimulusKinds.includes(fact.kind)), 'grounding frontier names a non-input fact');
    const lineage = inputs[0]!.machine;
    ensure(inputs.every((fact, index) => fact.machine === lineage && (index === 0
      || fact.segment.epoch > inputs[index - 1]!.segment.epoch || fact.segment.epoch === inputs[index - 1]!.segment.epoch
        && fact.segment.position > inputs[index - 1]!.segment.position)), 'grounding frontier is not one ordered lineage');
    const last = inputs.at(-1)!;
    const covered = rows.filter(row => plan.stimulusKinds.includes(row.fact.kind) && row.fact.machine === lineage
      && (row.fact.segment.epoch < last.segment.epoch || row.fact.segment.epoch === last.segment.epoch
        && row.fact.segment.position <= last.segment.position));
    ensure(covered.length === inputs.length && covered.every(row => plan.frontier.includes(row.fact.id)),
      'grounding frontier omits an admitted input');
    const messages = inputs.map(fact => {
      const capture = inputCapture(fact), bytes = configured.captures.read(capture.reference);
      ensure(bytes !== null && hashBytes(bytes) === capture.hash, `admitted input ${fact.id} capture unavailable or changed`);
      return { fact, capture };
    });
    for (const reply of plan.replies) {
      ensure(plan.frontier.slice(0, -1).includes(reply.input), 'accepted reply is not bound to an earlier input');
      clean(rows.find(row => row.fact.id === reply.acceptance && row.fact.kind === 'judgment-provider-ProviderAnswerAcceptance'),
        `accepted reply ${reply.acceptance} unavailable`);
    }
    const briefing = resolveBriefing(rows, plan, at);
    const launchRow = take(configured.runtime.history!.lookup(plan.launch));
    ensure(launchRow && launchRow.record?.type === 'HarnessLaunchSpec' && launchRow.taint.length === 0
      && launchRow.conflicts.length === 0, 'admitted launch unavailable');
    const launch = launchRow.record as HarnessLaunchSpec;
    const current = messages.at(-1)!;
    const admitted = configured.admitDelivery({ intake: current.fact, capture: current.capture });
    const previous = take(configured.runtime.inspectCurrent()).filter(row =>
      row.record.type === 'ContextDeliverySpecification' && row.record.launch === launchRow.fact.id).at(-1);
    // Branded owner types are minted only by Ten's recordContextDelivery and Five's
    // grounding validation; this is the unminted candidate those owners check.
    const specification = freeze({ type: 'ContextDeliverySpecification' as const, schemaVersion: 1,
      id: contextDeliveryIdFor(launchRow.fact.id, admitted.operation), predecessors: [], dependencyFacts: [],
      launch: launchRow.fact.id, run: plan.run, step: plan.step, input: current.fact.id, inputDigest: current.capture.hash as Hash,
      incarnation: launch.incarnation, harness: launch.harness, artifactDigest: launch.artifactDigest, machine: launch.machine,
      generation: plan.generation, executionContext: plan.executionContext,
      contextManifest: [...messages.map(message => ({ class: 'message', reference: message.capture.reference, digest: message.capture.hash as Hash })),
        ...briefing.map(fact => ({ class: String(record(fact.body).class), reference: fact.id, digest: fact.contentHash }))],
      reason: previous ? 'live-input' as const : 'initial' as const, operation: admitted.operation, claim: admitted.claim,
      previousDelivery: previous?.fact.id ?? '', controlObservation: '' });
    const run = view.run, ref = (fact: FactEnvelope): FactEnvelopeReference => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });
    return freeze({ specification,
      grounding: (consumption: FactEnvelopeReference) => {
        const consumed = take(configured.store.read()).find(fact => fact.id === consumption.id);
        ensure(consumed, 'consumption fact unavailable');
        return freeze({ type: 'SessionGrounding', schemaVersion: 2, id: `ground-r5:${specification.id}`, run: plan.run,
          expected: view.head, worker: request.worker, harness: request.harness, reason: request.reason,
          step: specification.step, incarnation: specification.incarnation, contextDeliveryReason: specification.reason,
          ownership: request.execution.ownership, executionContext: request.execution.context, at,
          previousActivity: plan.previousActivity,
          elapsed: { type: 'Measurement', schemaVersion: 1, subject: { kind: 'elapsed-time', instance: request.worker },
            value: at.value - plan.previousActivity.value, unit: 'ms', at, by: 'probe' },
          principal: run.owner, intake: ref(current.fact), binding: run.resultDestination.binding, directives: run.directives,
          generation: run.generation, frontier: { [consumed.machine]: { epoch: consumed.segment.epoch, position: consumed.segment.position } },
          knownLineages: [consumed.machine], threshold: plan.threshold,
          messages: messages.map(message => ({ fact: ref(message.fact), sequence: message.fact.segment.position,
            capture: message.capture.reference, hash: message.capture.hash as Hash })),
          lastInbound: ref(current.fact), pendingOperations: view.pending.map(step => step.operation.key), children: [], receipts: [],
          briefingClasses: plan.briefing.map(slot => slot.class), consumption });
      } });
  });
}

/** Protocol bindings that let Seven's request name the exact turn it grounds. */
export interface GroundedContextBindings {
  readonly run: string; readonly step: string; readonly delivery: string; readonly consumption: string;
  readonly installation: string; readonly generation: string;
}
export interface GroundedContextInput {
  readonly store: FactStorePort; readonly context: AssemblyDecodeContext;
  captures: Readonly<{ read(reference: string): string | null }>;
  readonly bindings: GroundedContextBindings;
  readonly replies: readonly Readonly<{ input: string; acceptance: string }>[];
}

interface Resolved {
  readonly specification: ContextDeliverySpecification;
  readonly inputs: readonly Readonly<{ fact: string; reference: string; hash: string; bytes: string }>[];
  readonly sources: readonly Readonly<{ class: string; reference: string; digest: string; content: string }>[];
  readonly replies: readonly Readonly<{ input: string; acceptance: string; hash: string; bytes: string }>[];
}

function resolveDelivered(input: GroundedContextInput): Resolved {
  const rows = take(input.store.readForProjection()).entries as readonly Row[];
  const delivery = clean(rows.find(row => row.fact.id === input.bindings.delivery), 'context delivery fact unavailable');
  const specification = record(record(delivery.body).record) as unknown as ContextDeliverySpecification;
  ensure(delivery.kind === 'assembly-ContextDeliverySpecification' && specification.type === 'ContextDeliverySpecification'
    && specification.run === input.bindings.run && specification.generation === input.bindings.generation,
  'context delivery differs from the bound run or generation');
  const consumption = clean(rows.find(row => row.fact.id === input.bindings.consumption), 'context consumption fact unavailable');
  const observation = record(record(consumption.body).record);
  ensure(consumption.kind === 'assembly-HarnessObservation' && observation.contextDelivery === delivery.id
    && observation.phase === 'context-consumed', 'consumption does not witness this exact delivery');
  const facts = rows.map(row => row.fact);
  const inputs = specification.contextManifest.filter(row => row.class === 'message').map(row => {
    const owner = facts.find(fact => record(record(fact.body).capture).reference === row.reference);
    const bytes = input.captures.read(row.reference);
    ensure(owner && bytes !== null && hashBytes(bytes) === row.digest, 'delivered input capture unavailable or changed');
    return { fact: owner.id, reference: row.reference, hash: row.digest, bytes };
  });
  const sources = specification.contextManifest.filter(row => row.class !== 'message').map(row => {
    const fact = clean(rows.find(candidate => candidate.fact.id === row.reference), 'delivered briefing unavailable');
    ensure(fact.kind === 'rungraph-briefing-material' && fact.contentHash === row.digest
      && record(fact.body).class === row.class, 'delivered briefing differs from its manifest row');
    decodeGroundingBriefingBody(fact.body);
    return { class: row.class, reference: row.reference, digest: row.digest, content: String(record(fact.body).content) };
  });
  const replies = input.replies.map(reply => {
    ensure(inputs.slice(0, -1).some(entry => entry.fact === reply.input), 'accepted reply is not bound to an earlier delivered input');
    const fact = clean(rows.find(row => row.fact.id === reply.acceptance), 'accepted reply unavailable');
    const acceptance = record(record(fact.body).record), capture = record(acceptance.capture);
    ensure(fact.kind === 'judgment-provider-ProviderAnswerAcceptance' && text(capture.reference, 512)
      && capture.hash === acceptance.answerDigest, 'accepted reply capture differs');
    const bytes = input.captures.read(capture.reference as string);
    ensure(bytes !== null && hashBytes(bytes) === capture.hash, 'accepted reply bytes unavailable or changed');
    return { input: reply.input, acceptance: fact.id, hash: capture.hash as string, bytes };
  });
  return { specification, inputs, sources, replies };
}

/** Render the data-only provider context from the durable delivery record. Source
 * text travels as quoted canonical data; protocol instructions stay in the
 * admitted system framing and no document becomes a system message. */
export function renderGroundedContext(input: GroundedContextInput): Result<string> {
  return boundary('RenderGroundedContext', null, input.context, () => {
    const resolved = resolveDelivered(input);
    const conversation = resolved.inputs.flatMap(entry => [
      { input: entry.fact, capture: entry.reference, hash: entry.hash, text: entry.bytes },
      ...resolved.replies.filter(reply => reply.input === entry.fact)
        .map(reply => ({ reply: reply.acceptance, hash: reply.hash, text: reply.bytes }))]);
    return encoded({ bindings: { ...input.bindings, manifest: resolved.specification.contextManifest },
      conversation, sources: resolved.sources.map(source => ({ class: source.class, reference: source.reference,
        digest: source.digest, items: (JSON.parse(source.content) as { items: unknown }).items })) }).bytes;
  });
}

/** The fields of Seven's canonical provider submission. This mirrors Seven's
 * prepare() so the Five step digest can be fixed before preparation; the join
 * verifier then proves equality against Seven's actual capture. */
export interface GroundedSubmissionFields {
  readonly provider: string; readonly model: string; readonly route: string;
  readonly question: string; readonly context: string;
  readonly settings: unknown; readonly outputSchema: unknown; readonly floor: unknown;
  readonly evidence: readonly string[]; readonly point: string; readonly generation: string;
}
export function groundedSubmission(fields: GroundedSubmissionFields): Readonly<{ bytes: string; digest: string }> {
  const value = encoded({ provider: fields.provider, model: fields.model, route: fields.route,
    messages: [{ role: 'user', content: fields.question }, { role: 'context', content: fields.context }],
    attachments: [], tools: [], settings: fields.settings, outputSchema: fields.outputSchema, floor: fields.floor,
    evidence: fields.evidence, point: fields.point, generation: fields.generation }).bytes;
  return freeze({ bytes: value, digest: encoded(value).hash });
}

/** Subject-bound UTF-8 byte measurement against the bound that applies there. */
export interface GroundingMeasurement {
  readonly subject: string; readonly unit: 'utf8-bytes'; readonly measured: number; readonly bound: number | null;
}
export interface GroundingEnvelopeBounds {
  /** Bytes of the admitted system framing for the selected route. */
  readonly systemBytes: number; readonly maxPromptBytes: number; readonly maxInputBytes: number;
  readonly maxOutputBytes: number; readonly maxCaptureBytes: number;
  readonly maxDeliveryBytes: number; readonly maxOutboundBytes: number;
}
export interface GroundingEnvelopeInput {
  readonly turn: string; readonly route: string; readonly policy: string;
  readonly question: string; readonly context: string; readonly submitted: string;
  /** Serialized Eight context-delivery payload, when measured. */
  readonly delivery?: string;
  /** Complete canonical outbound reply, when measured before reply dispatch. */
  readonly outbound?: string;
  readonly retained: readonly string[];
  readonly bounds: GroundingEnvelopeBounds;
}
export function groundingEnvelopeMeasurements(input: GroundingEnvelopeInput): readonly GroundingMeasurement[] {
  const b = input.bounds, subject = (name: string) => `${name}:${input.turn}:${input.route}:${input.policy}`;
  const row = (name: string, measured: number, bound: number | null): GroundingMeasurement =>
    ({ subject: subject(name), unit: 'utf8-bytes', measured, bound });
  const context = JSON.parse(input.context) as { bindings?: unknown; conversation?: unknown; sources?: unknown };
  const diagnostic = [
    row('system-framing', b.systemBytes, null), row('question', utf8(input.question), null),
    row('source-bodies', utf8(encoded(context.sources ?? []).bytes), null),
    row('bindings-manifest', utf8(encoded(context.bindings ?? {}).bytes), null),
    row('conversation', utf8(encoded(context.conversation ?? []).bytes), null),
    row('serialized-context', utf8(input.context), null)];
  const enforced = [
    row('canonical-request', utf8(input.submitted), b.maxInputBytes),
    row('combined-prompt', b.systemBytes + utf8(input.submitted), b.maxPromptBytes),
    // Seven's own capture allowance, exercised again by the real owner.
    row('capture-allowance', utf8(input.question + input.context + input.submitted) + 6 * b.maxOutputBytes + 8192, b.maxCaptureBytes),
    ...(input.delivery === undefined ? [] : [row('context-delivery-payload', utf8(input.delivery), b.maxDeliveryBytes)]),
    ...(input.outbound === undefined ? [] : [row('outbound-message', utf8(input.outbound), b.maxOutboundBytes)])];
  return freeze([...diagnostic, ...enforced]);
}

/** Refuse, before any provider or reply dispatch, when any enforced bound is
 * exceeded. The refusal is visible and names bytes, bounds, turn and retained
 * references; nothing is trimmed, retried or re-identified. */
export function checkGroundingEnvelope(input: GroundingEnvelopeInput, context: AssemblyDecodeContext):
  Result<readonly GroundingMeasurement[]> {
  return boundary('CheckGroundingEnvelope', null, context, () => {
    const measured = groundingEnvelopeMeasurements(input);
    const over = measured.filter(row => row.bound !== null && row.measured > row.bound);
    ensure(over.length === 0, `grounding-envelope-held turn=${input.turn} ${over.map(row =>
      `${row.subject.split(':')[0]}=${row.measured}/${row.bound}`).join(' ')} retained=${input.retained.join(',')}`);
    return measured;
  });
}

export interface GroundedJoinInput extends GroundedContextInput {
  /** Seven's prepared request record, as returned by readPrepared/prepare. */
  readonly request: Readonly<{ id: string; run: string; step: string; question: Readonly<{ reference: string; hash: string }>;
    context: Readonly<{ reference: string; hash: string }>; submitted: Readonly<{ reference: string; hash: string }>;
    inputDigest: string; evidence: readonly string[]; generation: string }>;
  /** Seven's durable request fact; its record must equal `request`. */
  readonly requestFact: string;
  /** Bytes the model adapter actually received, when checking at the adapter. */
  readonly received?: string;
}

/** Prove Seven's captured submission contains exactly the delivered manifest's
 * evidence, independently of the renderer, and that the adapter bytes equal it.
 * It checks representation and coverage, never answer quality. */
export function verifyGroundedSubmission(input: GroundedJoinInput): Result<Readonly<{ digest: string; bytes: number; rows: number }>> {
  return boundary('VerifyGroundedSubmission', null, input.context, () => {
    const q = input.request;
    const rows = take(input.store.readForProjection()).entries as readonly Row[];
    const requestFact = clean(rows.find(row => row.fact.id === input.requestFact), 'Seven request fact unavailable');
    ensure(requestFact.kind === 'judgment-provider-ProviderJudgmentRequest'
      && encoded(record(requestFact.body).record).bytes === encoded(q).bytes, 'Seven request differs from its durable record');
    ensure(q.run === input.bindings.run && q.step === input.bindings.step && q.generation === input.bindings.generation,
      'Seven request is bound to a different run, step, or generation');
    const read = (capture: Readonly<{ reference: string; hash: string }>) => {
      const bytes = input.captures.read(capture.reference);
      ensure(bytes !== null && hashBytes(bytes) === capture.hash, 'Seven capture unavailable or changed');
      return bytes;
    };
    const submitted = read(q.submitted);
    ensure(encoded(submitted).hash === q.inputDigest, 'submitted bytes differ from the prepared operation digest');
    const envelope = JSON.parse(submitted) as { messages?: readonly Readonly<{ role: string; content: string }>[]; evidence?: unknown };
    ensure(Array.isArray(envelope.messages) && envelope.messages.length === 2 && envelope.messages[0]!.role === 'user'
      && envelope.messages[1]!.role === 'context' && envelope.messages[0]!.content === read(q.question)
      && envelope.messages[1]!.content === read(q.context), 'submitted messages differ from Seven question/context captures');
    const packet = JSON.parse(envelope.messages[1]!.content) as {
      bindings?: Readonly<Record<string, unknown>>; conversation?: readonly Readonly<Record<string, unknown>>[];
      sources?: readonly Readonly<Record<string, unknown>>[] };
    ensure(packet && typeof packet === 'object' && exactKeys(packet, 'bindings,conversation,sources')
      && Array.isArray(packet.conversation) && Array.isArray(packet.sources), 'submitted context is not a grounded packet');
    const resolved = resolveDelivered(input);
    ensure(encoded(packet.bindings).bytes === encoded({ ...input.bindings, manifest: resolved.specification.contextManifest }).bytes,
      'submitted bindings differ from this turn\'s delivery, consumption, or manifest');
    const expected = resolved.inputs.flatMap(entry => [{ kind: 'input', entry },
      ...resolved.replies.filter(reply => reply.input === entry.fact).map(reply => ({ kind: 'reply', entry: reply }))]);
    ensure(packet.conversation.length === expected.length, 'submitted conversation omits or adds a turn');
    packet.conversation.forEach((turn, index) => {
      const want = expected[index]!;
      if (want.kind === 'input') {
        const entry = want.entry as Resolved['inputs'][number];
        ensure(exactKeys(turn, 'capture,hash,input,text') && turn.input === entry.fact && turn.capture === entry.reference
          && turn.hash === entry.hash && turn.text === entry.bytes, `submitted input ${index} differs from its delivered capture`);
      } else {
        const entry = want.entry as Resolved['replies'][number];
        ensure(exactKeys(turn, 'hash,reply,text') && turn.reply === entry.acceptance && turn.hash === entry.hash
          && turn.text === entry.bytes, `submitted reply ${index} differs from its accepted capture`);
      }
    });
    ensure(packet.sources.length === resolved.sources.length, 'submitted sources omit or add a briefing class');
    packet.sources.forEach((source, index) => {
      const want = resolved.sources[index]!;
      ensure(exactKeys(source, 'class,digest,items,reference') && source.class === want.class && source.reference === want.reference
        && source.digest === want.digest && encoded({ items: source.items }).bytes === want.content,
      `submitted source ${want.class} differs from its delivered body`);
    });
    if (input.received !== undefined) ensure(input.received === submitted, 'model adapter bytes differ from Seven\'s captured submission');
    return freeze({ digest: q.inputDigest, bytes: utf8(submitted), rows: resolved.specification.contextManifest.length });
  });
}
