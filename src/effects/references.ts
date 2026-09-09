import type { Clock, Result } from '../index.js';
import type { FactEnvelope } from '../facts/index.js';
import type { TypedEffectPayload } from './payloads.js';
import { encoded, ensure, freeze, take } from './boundary.js';

type EffectReferenceHost = Readonly<{
  current(): { readonly clock: Clock };
  referenceFacts?(): Result<readonly FactEnvelope[]>;
  resolvePath?(path: string): Result<string>;
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

/** Resolve every typed-payload reference against its signed P2 history. */
export function resolveEffectPayloadReferences(payload: TypedEffectPayload, facts: readonly FactEnvelope[], clock: Clock,
  host?: Pick<EffectReferenceHost, 'resolvePath'>): readonly string[] {
  const resolved: FactEnvelope[] = [];
  resolved.push(one(facts, 'run-opening', value => value.run === payload.run
    || value.type === 'Run' && value.id === payload.run, 'typed run is absent or ambiguous'));
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
  resolved.push(source);

  if (payload.kind === 'acknowledge') {
    const fact = exact(facts, payload.inboundFact, 'intake-admitted', 'acknowledgment intake fact missing or wrong kind');
    const value = body(fact); ensure(value.account === payload.account && value.conversation === payload.conversation,
      'acknowledgment intake subject mismatch'); resolved.push(fact);
  } else if (payload.kind === 'fetch-inbound-media') {
    const fact = exact(facts, payload.inboundReceipt, 'intake-receipt', 'media intake receipt missing or wrong kind');
    const value = body(fact); ensure(value.account === payload.account && value.conversation === payload.conversation
      && value.platformFile === payload.platformFile, 'media receipt subject mismatch'); resolved.push(fact);
  } else if (payload.kind === 'derive-transcript') {
    const attempt = exact(facts, payload.providerOperation, 'judgment-JudgmentAttemptRecord', 'transcript provider attempt missing or wrong kind');
    const value = record(attempt); ensure(value.type === 'JudgmentAttemptRecord' && value.operation === payload.providerOperation
      && value.run === payload.run && value.step === payload.destinationStep && value.model === payload.model
      && same(value.sourceCapture, payload.sourceCapture) && value.originatingIntake === payload.originatingIntake,
    'transcript provider attempt subject mismatch'); resolved.push(attempt);
    const intake = exact(facts, payload.originatingIntake, 'intake-admitted', 'transcript originating intake missing or wrong kind');
    ensure(body(intake).conversation === payload.conversation, 'transcript intake lineage subject mismatch'); resolved.push(intake);
    resolved.push(one(facts, 'run-transition', item => {
      const candidate = item.step === undefined ? item : object(item.step, 'destination step witness malformed');
      return (item.run === payload.run || candidate.run === payload.run) && candidate.id === payload.destinationStep;
    }, 'transcript destination step missing or belongs to another run'));
  } else if (payload.kind === 'process-control') {
    for (const [id, kind, relation] of [[payload.processIncarnation, 'process-incarnation', 'incarnation'],
      [payload.parentIdentity, 'process-parent', 'parent'], [payload.startIdentity, 'process-start', 'start']] as const) {
      const fact = exact(facts, id, kind, `process ${relation} witness missing or wrong kind`), value = body(fact);
      current(fact, clock, `process ${relation} witness stale`);
      ensure(value.machine === payload.machine && value.processId === payload.processId && value.processIncarnation === payload.processIncarnation
        && value.parentIdentity === payload.parentIdentity && value.startIdentity === payload.startIdentity
        && value.executable === payload.executable && same(value.arguments, payload.arguments), `process ${relation} witness subject mismatch`);
      resolved.push(fact);
    }
  } else if (payload.kind === 'scheduler-control') {
    const fact = exact(facts, payload.jobGeneration, 'scheduler-job-generation', 'scheduler generation missing or wrong kind'), value = body(fact);
    current(fact, clock, 'scheduler generation stale');
    ensure(value.jobId === payload.jobId && value.generation === payload.jobGeneration && value.finiteScope === payload.finiteScope
      && value.undoOperation === payload.undoOperation && value.reviewAt === payload.reviewAt, 'scheduler generation subject mismatch'); resolved.push(fact);
  } else if (payload.kind === 'account-route-change') {
    const fact = exact(facts, payload.sourceGeneration, 'account-route-generation', 'route generation missing or wrong kind'), value = body(fact);
    current(fact, clock, 'route generation stale');
    ensure(value.run === payload.routeRun && value.provider === payload.provider && value.fromAccount === payload.fromAccount
      && value.toAccount === payload.toAccount && value.generation === payload.sourceGeneration
      && value.rollbackRoute === payload.rollbackRoute, 'route generation/account subject mismatch'); resolved.push(fact);
  } else if (payload.kind === 'configuration-change') {
    const fact = exact(facts, payload.undoReference, 'configuration-target-state', 'configuration target/undo witness missing or wrong kind'), value = body(fact);
    current(fact, clock, 'configuration target witness stale');
    ensure(value.canonicalTarget === payload.canonicalTarget && value.priorDigest === payload.expectedPriorDigest
      && value.undoReference === payload.undoReference, 'configuration target/prior state mismatch'); resolved.push(fact);
    ensure(host?.resolvePath && take(host.resolvePath(payload.canonicalTarget)) === payload.canonicalTarget,
      'configuration target does not resolve to its canonical path');
  } else if (payload.kind === 'filesystem-mutation') {
    const fact = exact(facts, payload.protectedTargetPolicy, 'filesystem-target-state', 'protected-target policy/target witness missing or wrong kind'), value = body(fact);
    current(fact, clock, 'filesystem target witness stale');
    ensure(value.policy === payload.protectedTargetPolicy && same(value.targets, payload.fileTargets), 'filesystem ancestry/prior/policy subject mismatch');
    ensure(host?.resolvePath, 'filesystem canonical path resolver unavailable');
    for (const target of payload.fileTargets) ensure(take(host.resolvePath(target.canonicalPath)) === target.resolvedPath
      && target.resolvedPath === target.canonicalPath, 'filesystem target crosses a symlink or differs from canonical path');
    resolved.push(fact);
  } else if (payload.kind === 'git-mutation') {
    const fact = exact(facts, payload.base, 'git-target-state', 'git repository/base witness missing or wrong kind'), value = body(fact);
    current(fact, clock, 'git target witness stale');
    ensure(value.repository === payload.repository && value.worktree === payload.worktree && value.ref === payload.ref
      && value.base === payload.base && same(value.targets, payload.targets) && same(value.expectedHeads, payload.expectedHeads)
      && same(value.rollbackConstraints, payload.rollbackConstraints), 'git repository/base/head/rollback subject mismatch');
    ensure(host?.resolvePath && take(host.resolvePath(payload.repository)) === payload.repository
      && take(host.resolvePath(payload.worktree)) === payload.worktree, 'git repository/worktree is not canonical'); resolved.push(fact);
  }
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
