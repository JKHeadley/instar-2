import type { Clock, DecodeContext, Result } from '../index.js';
import { hashBytes } from '../facts/index.js';
import type { CapturedContent, FactEnvelope } from '../facts/index.js';
import type { TypedEffectPayload } from './payloads.js';
import { encoded, ensure, freeze, take } from './boundary.js';

type EffectReferenceHost = Readonly<{
  current(): { readonly clock: Clock; readonly decode?: DecodeContext & { readonly captureStatuses?: Readonly<Record<string, string>> } };
  referenceFacts?(): Result<readonly FactEnvelope[]>;
  historical?: boolean;
  historicalCaptures?: Readonly<Record<string, CapturedContent>>;
}>;

const object = (value: unknown, detail: string): Readonly<Record<string, unknown>> => {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), detail);
  return value as Readonly<Record<string, unknown>>;
};
const body = (fact: FactEnvelope): Readonly<Record<string, unknown>> => {
  const value = object(fact.body, 'reference witness body missing');
  if (typeof value.witness !== 'string') return value;
  try { return object(JSON.parse(value.witness), 'reference witness value malformed'); }
  catch { throw new Error('reference witness value malformed'); }
};
const record = (fact: FactEnvelope): Readonly<Record<string, unknown>> => {
  const value = body(fact); return value.record === undefined ? value : object(value.record, 'reference owner record missing');
};
const same = (left: unknown, right: unknown): boolean => encoded(left).bytes === encoded(right).bytes;
const captureReferences = (value: unknown, into: Map<string, string>): void => {
  if (Array.isArray(value)) { value.forEach(item => captureReferences(item, into)); return; }
  if (!value || typeof value !== 'object') return;
  const candidate = value as Readonly<Record<string, unknown>>;
  if (typeof candidate.reference === 'string' && typeof candidate.hash === 'string') {
    const prior = into.get(candidate.reference);
    ensure(prior === undefined || prior === candidate.hash, 'capture reference names conflicting hashes');
    into.set(candidate.reference, candidate.hash);
  }
  Object.values(candidate).forEach(item => captureReferences(item, into));
};
const usable = (fact: FactEnvelope, facts: readonly FactEnvelope[], host: EffectReferenceHost | undefined, detail: string): void => {
  const byId = new Map(facts.map(candidate => [candidate.id, candidate]));
  const captures = new Map<string, string>(), visited = new Set<string>(), visit = (candidate: FactEnvelope): void => {
    if (visited.has(candidate.id)) return;
    visited.add(candidate.id); captureReferences(body(candidate), captures);
    candidate.predecessors.required.forEach(id => {
      const dependency = byId.get(id);
      ensure(dependency, `${detail}: required dependency ${id} is absent`);
      visit(dependency);
    });
  };
  visit(fact);
  for (const [reference, digest] of captures) capture(facts, reference, digest, host, detail);
};
const capture = (_facts: readonly FactEnvelope[], reference: string, hash: string, host: EffectReferenceHost | undefined,
  detail: string): undefined => {
  const decode = host?.current().decode;
  const bytes = decode?.captures[reference];
  const status = decode?.captureStatuses?.[reference];
  if (host?.historical) {
    const recorded = host.historicalCaptures?.[reference];
    ensure(recorded && recorded.hash === hash, detail);
    if (recorded.status === 'available') ensure(bytes !== undefined && hashBytes(bytes) === hash, detail);
    return undefined;
  }
  ensure(bytes !== undefined && hashBytes(bytes) === hash && (status === undefined || status === 'available'), detail);
  return undefined;
};
const current = (fact: FactEnvelope, clock: Clock, detail: string): void => {
  const value = body(fact);
  ensure(value.status === 'current' && Number.isSafeInteger(value.validFrom) && Number.isSafeInteger(value.validUntil)
    && Number(value.validFrom) <= clock.value && Number(value.validUntil) >= clock.value, detail);
};
const exact = (facts: readonly FactEnvelope[], id: string, kind: string, detail: string): FactEnvelope => {
  const matches = facts.filter(fact => fact.kind === kind
    && (fact.id === id || body(fact).id === id || record(fact).id === id));
  ensure(matches.length === 1, detail); return matches[0]!;
};
const one = (facts: readonly FactEnvelope[], kind: string, predicate: (value: Readonly<Record<string, unknown>>) => boolean,
  detail: string): FactEnvelope => {
  const matches = facts.filter(fact => fact.kind === kind && predicate(record(fact)));
  ensure(matches.length === 1, detail); return matches[0]!;
};
const intakeRoute = (fact: FactEnvelope, facts: readonly FactEnvelope[], detail: string) => {
  const value = body(fact);
  ensure(typeof value.adapter === 'string' && typeof value.channel === 'string' && typeof value.receipt === 'string', detail);
  const receipt = exact(facts, value.receipt, 'intake-receipt', `${detail}: receipt missing or wrong kind`), receiptValue = body(receipt);
  ensure(receiptValue.adapter === value.adapter, `${detail}: receipt adapter mismatch`);
  const ingress = typeof receiptValue.ingress === 'string' ? object(JSON.parse(receiptValue.ingress), `${detail}: receipt ingress malformed`) : undefined;
  ensure(!ingress || ingress.channel === value.channel, `${detail}: receipt channel mismatch`);
  return { value, receipt, receiptValue };
};

/** Resolve every typed-payload reference against its signed P2 history. */
export function resolveEffectPayloadReferences(payload: TypedEffectPayload, facts: readonly FactEnvelope[], clock: Clock,
  host?: EffectReferenceHost): readonly string[] {
  const resolved: FactEnvelope[] = [];
  const opening = one(facts, 'run-opening', value => value.run === payload.run
    || value.type === 'Run' && value.id === payload.run, 'typed run is absent or ambiguous');
  resolved.push(opening);
  const semantic = exact(facts, payload.semanticMessage, 'semantic-message-admission',
    'typed semantic parent is missing or wrong kind');
  const semanticValue = body(semantic); current(semantic, clock, 'typed semantic parent stale');
  ensure(semanticValue.id === payload.semanticMessage && semanticValue.run === payload.run
    && semanticValue.sourceLineage === payload.run, 'typed semantic parent subject/lineage mismatch');
  resolved.push(semantic);
  resolved.push(one(facts, 'run-transition', value => {
    const candidate = value.step === undefined ? value : object(value.step, 'run step witness malformed');
    const operation = candidate.operation === undefined ? candidate : object(candidate.operation, 'run operation witness malformed');
    const evidence = Array.isArray(candidate.evidence) ? candidate.evidence.map(item => {
      if (typeof item === 'string') return item;
      return item && typeof item === 'object' && 'id' in item ? String((item as { id: unknown }).id) : '';
    }) : [];
    return (value.run === payload.run || candidate.run === payload.run) && candidate.id === payload.step
      && (operation.key === payload.logicalEffect || value.logicalEffect === payload.logicalEffect)
      && (value.sourceResult === payload.sourceResult || evidence.includes(payload.sourceResult));
  }, 'typed step/logical/source lineage is absent, ambiguous, or belongs to another run'));
  const source = exact(facts, payload.sourceResult, 'result-record', 'typed source result is missing or wrong kind');
  const sourceBody = body(source), result = object(sourceBody.result, 'typed source result body missing');
  const subjects = Array.isArray(sourceBody.subjects) ? sourceBody.subjects : [];
  const subject = subjects.some(item => item !== null && typeof item === 'object'
    && (item as { run?: unknown }).run === payload.run && (item as { step?: unknown }).step === payload.step
    && (item as { logicalEffect?: unknown }).logicalEffect === payload.logicalEffect);
  ensure(result.type === 'Result' && (subject || sourceBody.run === payload.run && sourceBody.step === payload.step
    && sourceBody.logicalEffect === payload.logicalEffect), 'typed source result subject mismatch');
  usable(source, facts, host, 'typed source result dependency is unavailable');
  resolved.push(source);

  const routeConversation = payload.kind === 'create-topic' ? payload.parentConversation : payload.conversation;
  const route = exact(facts, payload.routeGeneration, 'conversation-route-generation',
    'conversation route generation missing or wrong kind');
  const routeValue = body(route); current(route, clock, 'conversation route generation stale');
  ensure(routeValue.id === payload.routeGeneration && routeValue.account === payload.account
    && routeValue.conversation === routeConversation, 'conversation route generation subject mismatch');
  const applicableRoutes = facts.filter(candidate => candidate.kind === 'conversation-route-generation'
    && body(candidate).account === payload.account && body(candidate).conversation === routeConversation
    && body(candidate).status === 'current' && Number(body(candidate).validFrom) <= clock.value
    && Number(body(candidate).validUntil) >= clock.value);
  ensure(applicableRoutes.length === 1 && applicableRoutes[0]!.id === route.id,
    'conversation route generation is superseded or conflicted');
  resolved.push(route);

  if (payload.kind === 'post-media') {
    for (const item of payload.attachments) {
      const bytes = host?.current().decode?.captures[item.capture.reference];
      capture(facts, item.capture.reference, item.capture.hash, host, 'attachment capture is absent, unavailable, or changed');
      if (!host?.historical || bytes !== undefined) ensure(typeof bytes === 'string'
        && new TextEncoder().encode(bytes).length === item.bytes, 'attachment byte count differs from captured bytes');
    }
  } else if (payload.kind === 'edit-message' || payload.kind === 'react') {
    const fact = exact(facts, payload.targetMessage, 'conversation-message', 'conversation target message missing or wrong kind');
    const value = body(fact); current(fact, clock, 'conversation target message stale');
    ensure(value.account === payload.account && value.conversation === payload.conversation
      && (value.message === payload.targetMessage || value.id === payload.targetMessage), 'conversation target message subject mismatch');
    resolved.push(fact);
  } else if (payload.kind === 'acknowledge') {
    const fact = exact(facts, payload.inboundFact, 'intake-admitted', 'acknowledgment intake fact missing or wrong kind');
    const value = body(fact);
    if (typeof value.adapter === 'string' && typeof value.channel === 'string') {
      const linked = intakeRoute(fact, facts, 'acknowledgment intake subject mismatch');
      ensure(value.adapter === payload.account && value.channel === payload.conversation,
        'acknowledgment intake subject mismatch');
      resolved.push(linked.receipt);
      if (value.binding !== 'none') {
        const binding = exact(facts, String(value.binding), 'conversation-binding', 'acknowledgment conversation binding missing or wrong kind');
        const bindingValue = body(binding);
        ensure(bindingValue.adapter === value.adapter && bindingValue.channel === value.channel,
          'acknowledgment conversation binding subject mismatch');
        resolved.push(binding);
      }
    } else ensure(false, 'acknowledgment intake must use the Part Four admitted/receipt contract');
    resolved.push(fact);
  } else if (payload.kind === 'fetch-inbound-media') {
    const fact = exact(facts, payload.inboundReceipt, 'intake-receipt', 'media intake receipt missing or wrong kind');
    const value = body(fact);
    if (typeof value.adapter === 'string' && typeof value.ingress === 'string') {
      const ingress = object(JSON.parse(value.ingress), 'media receipt ingress malformed');
      ensure(value.adapter === payload.account && ingress.channel === payload.conversation, 'media receipt subject mismatch');
    } else ensure(false, 'media receipt must use the Part Four receipt contract');
    const captured = object(value.capture, 'media receipt capture missing');
    ensure(captured.hash === value.rawHash && same(captured, payload.intakeCapture), 'media receipt capture/hash mismatch');
    const bytes = host?.current().decode?.captures[payload.intakeCapture.reference];
    capture(facts, payload.intakeCapture.reference, payload.intakeCapture.hash, host, 'media receipt capture unavailable or changed');
    if (!host?.historical || bytes !== undefined) {
      ensure(typeof bytes === 'string', 'media receipt capture unavailable or changed');
      const incoming = object(JSON.parse(bytes), 'media receipt captured input malformed');
      ensure(incoming.platformFile === payload.platformFile, 'media receipt file subject mismatch');
    }
    resolved.push(fact);
  } else if (payload.kind === 'derive-transcript') {
    const attempt = exact(facts, payload.providerOperation, 'judgment-JudgmentAttemptRecord', 'transcript provider attempt missing or wrong kind');
    const value = record(attempt);
    ensure(value.type === 'JudgmentAttemptRecord' && value.phase === 'response-observed' && typeof value.request === 'string'
      && value.receipt !== undefined, 'transcript provider attempt subject mismatch');
    const request = exact(facts, value.request, 'judgment-JudgmentRequest', 'transcript provider request missing or wrong kind');
    const requestValue = record(request);
    ensure(requestValue.type === 'JudgmentRequest' && requestValue.run === payload.run && requestValue.step === payload.destinationStep
      && (same(requestValue.question, payload.sourceCapture) || same(requestValue.context, payload.sourceCapture)),
    'transcript provider attempt subject mismatch');
    const submitted = object(requestValue.submitted, 'transcript submitted capture missing');
    ensure(same(submitted, payload.submittedCapture), 'transcript submitted capture subject mismatch');
    const submittedBytes = host?.current().decode?.captures[payload.submittedCapture.reference];
    capture(facts, payload.submittedCapture.reference, payload.submittedCapture.hash, host,
      'transcript submitted capture unavailable or changed');
    if (!host?.historical || submittedBytes !== undefined) {
      ensure(typeof submittedBytes === 'string', 'transcript submitted capture unavailable or changed');
      const wire = object(JSON.parse(submittedBytes), 'transcript submitted request malformed');
      ensure(wire.model === payload.model, 'transcript provider attempt subject mismatch');
    }
    const receipt = object(value.receipt, 'transcript response receipt missing');
    ensure(same(receipt, payload.responseCapture), 'transcript response receipt subject mismatch');
    capture(facts, payload.responseCapture.reference, payload.responseCapture.hash, host, 'transcript response receipt unavailable or changed');
    resolved.push(attempt, request);
    const intake = exact(facts, payload.originatingIntake, 'intake-admitted', 'transcript originating intake missing or wrong kind');
    const linked = intakeRoute(intake, facts, 'transcript intake lineage subject mismatch');
    const intakeCapture = object(linked.receiptValue.capture, 'transcript intake capture missing');
    ensure(linked.value.adapter === payload.account && linked.value.channel === payload.conversation
      && intakeCapture.hash === payload.sourceCapture.hash, 'transcript intake lineage subject mismatch');
    capture(facts, payload.sourceCapture.reference, payload.sourceCapture.hash, host,
      'transcript source capture unavailable or changed');
    resolved.push(intake, linked.receipt);
    resolved.push(one(facts, 'run-transition', item => {
      const candidate = item.step === undefined ? item : object(item.step, 'destination step witness malformed');
      return (item.run === payload.run || candidate.run === payload.run) && candidate.id === payload.destinationStep;
    }, 'transcript destination step missing or belongs to another run'));
  }
  for (const fact of resolved) usable(fact, facts, host, `${fact.kind} reference dependency is unavailable`);
  return freeze([...new Set(resolved.map(fact => fact.id))]);
}

export function referencedPayloadFacts(payload: TypedEffectPayload, host: EffectReferenceHost,
  supplied?: readonly FactEnvelope[], clock = host.current().clock): readonly string[] {
  let facts = supplied;
  if (!facts) {
    const read = host.referenceFacts;
    ensure(read, 'typed reference history unavailable');
    facts = take(read.call(host));
  }
  return resolveEffectPayloadReferences(payload, facts, clock, host);
}
