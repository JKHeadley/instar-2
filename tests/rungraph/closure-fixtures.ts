import { decode } from '../../src/index.js';
import type { FactEnvelopeReference, Json } from '../../src/index.js';
import { createRunClosureGraph, createRunGraph } from '../../src/rungraph/index.js';
import type { RunView } from '../../src/rungraph/index.js';
import { factId, signEnvelope } from '../../src/facts/index.js';
import type { FactSchema, SegmentStoragePort } from '../../src/facts/index.js';
import { privateKey } from '../facts/fixtures.js';
import { digest, json, ref, value } from './fixtures.js';
import { closureGovernanceFixture } from './closure-governance-fixture.js';
import { setupClosure } from './closure-fixture-base.js';

const text = { kind: 'text', maxLength: 65_536 } as const;
const semanticFields: Readonly<Record<string, FactSchema['fields']>> = {
  'decision-record': { decision: { kind: 'constitutional', type: 'Decision' } },
  'grant-record': { grant: { kind: 'constitutional', type: 'StandingGrant' } },
  'run-exit-evaluation': { run: text, check: text, version: text, subject: text, acceptance: text, clauses: text, status: text },
  'run-capability-read': { run: text, subject: text, capability: text, status: text },
  'run-owned-identity-read': { run: text, principal: text, status: text },
  'run-dependency-observation': { run: text, blocker: text, status: text },
  'run-standing-constraint': { run: text, avenue: text, status: text },
  'run-observation-obligation': { run: text, blocker: text, due: text, owner: text },
  'run-pressure-event': { run: text, budget: text, basis: text, status: text },
};

function closureSetup(storageFactory?: (fallback: SegmentStoragePort) => SegmentStoragePort) {
  const f = setupClosure(semanticFields, storageFactory);
  const replicate = (kind: string, body: Json, required: readonly string[] = [],
    author: Readonly<{ principal: unknown; provenance: unknown }> = { principal: f.bob, provenance: f.bob.provenance }) => {
    const persisted = value(f.store.read()), previous = persisted.filter(row => row.machine === 'machine-a').at(-1)!;
    const segment = { machine: 'machine-a', epoch: previous.segment.epoch, position: previous.segment.position + 1 };
    const input = signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment), kind, schemaVersion: 1,
      at: f.deps.clock(), machine: 'machine-a', principal: author.principal, provenance: author.provenance, segment,
      prevInSegment: previous.contentHash, predecessors: { inSegment: previous.id, frontier: {}, required }, body }, privateKey);
    return value(f.store.append(input, { peer: 'machine-a' }));
  };
  const deps = { ...f.deps, governance: closureGovernanceFixture(f.c),
    control: { owner: 'part-four' as const, verify: () => f.success(ref(f.opening)) },
  };
  return { ...f, deps, graph: value(createRunClosureGraph(deps)), replicate };
}

type Fixture = ReturnType<typeof closureSetup>;

const decisionReference = (id: string, fact: ReturnType<Fixture['append']>['fact']) =>
  ({ type: 'Decision' as const, id, fact: ref(fact), field: 'decision' as const });

export function avenueSetDecision(f: Fixture, avenues: readonly string[], id: string, exactGoal?: string) {
  const goal = exactGoal ?? ('exhaustion' in f ? String((f as Fixture & { exhaustion: { goal: string } }).exhaustion.goal)
    : 'satisfy the immutable exit test');
  const decision = value(decode('Decision', f.decisionInput({ id,
    conclusion: { subject: f.id, predicate: 'exhaustion-avenue-set',
      value: digest({ run: f.id, exitTest: f.run.exitTest, goal, avenues: [...avenues].sort() }), evidence: ['e1'] },
    reason: { subject: f.id, predicate: 'exhaustion-avenue-set-supported', value: true, evidence: ['e1', 'e2'] },
  }), f.ctx.decode));
  const fact = f.append('decision-record', json({ decision })).fact;
  return decisionReference(decision.id, fact);
}

export function exhaustionFixture(storageFactory?: (fallback: SegmentStoragePort) => SegmentStoragePort) {
  const f = closureSetup(storageFactory), ready = value(f.graph.open(f.run));
  const evidenceFacts = f.ctx.decode.evidence!.map(evidence => f.append('evidence-record', json({ evidence })).fact);
  const goal = 'satisfy the immutable exit test', avenueIds = ['avenue:outside-standing'];
  const decisions = ['avenue-set', 'exhaustion-conclusion', 'exhaustion-reason'].map((id, index) => {
    const predicate = index === 0 ? 'exhaustion-avenue-set' : index === 1 ? 'exhaustion-conclusion' : 'exhaustion-reason';
    const decision = value(decode('Decision', f.decisionInput({ id,
      conclusion: { subject: f.id, predicate, value: index === 0
        ? digest({ run: f.id, exitTest: f.run.exitTest, goal, avenues: avenueIds }) : true, evidence: ['e1'] },
      reason: { subject: f.id, predicate: `${predicate}-supported`, value: true, evidence: ['e1', 'e2'] },
    }), f.ctx.decode));
    const fact = f.append('decision-record', json({ decision }), evidenceFacts.map(fact => fact.id)).fact;
    return { decision, fact, reference: decisionReference(decision.id, fact), index };
  });
  const clauses = ['artifact proof absent'];
  const blocker = f.append('run-exit-evaluation', json({ run: f.id, check: f.run.exitTest.check, version: f.run.exitTest.version,
    subject: f.run.exitTest.subject, acceptance: f.run.exitTest.acceptance, clauses: JSON.stringify(clauses), status: 'unsatisfied' })).fact;
  const constraint = f.append('run-standing-constraint', json({ run: f.id, avenue: 'avenue:outside-standing', status: 'outside-standing' })).fact;
  const capabilityRead = f.append('run-capability-read', json({ run: f.id, subject: f.id, capability: 'dependency-access', status: 'current' })).fact;
  const identityRead = f.append('run-owned-identity-read', json({ run: f.id, principal: f.owner.id, status: 'current' })).fact;
  const dependency = f.append('run-dependency-observation', json({ run: f.id, blocker: blocker.id, status: 'blocked' })).fact;
  const outsideAction = { owner: f.owner, action: 'supply missing dependency', scope: f.scope } as const;
  const recheckAt = f.clock(1000);
  const obligation = f.append('run-observation-obligation', json({ run: f.id, blocker: blocker.id,
    due: digest(recheckAt), owner: f.owner.id })).fact;
  const recheck = { at: recheckAt, owner: f.owner, obligation: ref(obligation) } as const;
  const exhaustion = {
    type: 'ExhaustionRecord', schemaVersion: 1, id: 'exhaustion:1', run: f.id, expected: ready.head,
    blocker: ref(blocker), at: f.now, basis: 'bounded-investigation', scope: f.scope, grants: [],
    capabilityReads: [ref(capabilityRead)], identityReads: [ref(identityRead)], goal,
    avenues: [{ id: 'avenue:outside-standing', disposition: 'outside-standing', evidence: [ref(constraint)], constraint: ref(constraint) }],
    avenueSetDecisions: [decisions[0]!.reference], resources: f.run.budget.resources, dependencies: [ref(dependency)],
    outsideAction, conclusion: decisions[1]!.reference, reason: decisions[2]!.reference, recheck,
  } as const;
  const exhaustionFact = value(f.graph.recordExhaustion(exhaustion, f.lease));
  const closureFrontier = value(f.graph.read(f.id)).source.foldedThrough;
  const exit = {
    type: 'UnreachableRunExit', schemaVersion: 1, id: 'exit:unreachable:proposal', run: f.id, expected: ready.head,
    kind: 'unreachable',
    proposer: f.owner, standing: ref(f.opening), frontier: closureFrontier, at: f.now, phase: 'proposal',
    settledOperations: [], exhaustion: { owner: 'part-five', name: 'ExhaustionRecord', id: exhaustion.id, fact: ref(exhaustionFact) },
    unsatisfiedClauses: clauses, externalDependency: outsideAction, recheck,
  } as const;
  const transition = exit;
  return { ...f, ready, evidenceFacts, decisions, blocker, constraint, capabilityRead, identityRead, dependency,
    obligation, exhaustion, exhaustionFact, exit, transition };
}

export function closeUnreachable(storageFactory?: (fallback: SegmentStoragePort) => SegmentStoragePort) {
  const f = exhaustionFixture(storageFactory);
  const proposalFact = value(f.graph.recordUnreachableExit(f.transition, f.lease));
  const closing = value(f.graph.read(f.id));
  const terminalExit = { ...f.exit, id: 'exit:unreachable:terminal', expected: f.exit.id, phase: 'close',
    frontier: closing.source.foldedThrough,
    proposal: { owner: 'part-five', name: 'UnreachableRunExit', id: f.exit.id, fact: ref(proposalFact) } } as const;
  const close = terminalExit;
  const closeFact = value(f.graph.recordUnreachableExit(close, f.lease));
  const terminal = value(f.graph.readExitAny({ owner: 'part-five', name: 'Run', id: f.id }));
  return { ...f, closing, terminalExit, close, terminal, closeFact };
}

/** Use the unchanged public legacy writer to append a supported completion from
 * the run's original predecessor. This is deliberately separate from the
 * additive closure writer so mixed signed successor histories remain testable. */
export function appendLegacyCompletion(f: ReturnType<typeof exhaustionFixture>) {
  const legacy = value(createRunGraph(f.deps));
  const ready = value(legacy.read(f.id));
  const check = value(decode('Evidence', f.evidenceInput({ id: 'review18:completed-check',
    claim: { subject: f.run.exitTest.subject,
      predicate: `exit:${f.run.exitTest.check}:${f.run.exitTest.version}`,
      value: f.run.exitTest.acceptance }, freshFor: 1000 }), f.ctx.decode));
  const checkFact = f.append('evidence-record', json({ evidence: check })).fact;
  const result = value(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success',
    value: 'completed by legacy writer', capacity: { kind: 'none' } }, f.ctx.decode));
  const resultFact = f.append('result-record', json({ result })).fact;
  const exit = { type: 'RunExit', schemaVersion: 1, id: 'review18:completed', run: f.id,
    expected: ready.head, proposer: f.owner, standing: ref(f.opening),
    frontier: ready.source.foldedThrough, at: f.now, kind: 'completed', exitTest: f.run.exitTest,
    check: ref(checkFact), evidence: [{ type: 'Evidence', id: check.id, fact: ref(checkFact),
      field: 'evidence' }], result: { type: 'Result', id: 'review18:completed-result',
      fact: ref(resultFact), field: 'result' }, settledOperations: [] } as const;
  const proposal = { type: 'RunTransition', schemaVersion: 1, id: 'review18:completed-proposal',
    run: f.id, expected: ready.head, trigger: ref(checkFact), kind: 'propose-exit',
    from: 'ready', to: 'closing', responsible: f.owner, standing: ref(f.opening),
    ownership: f.lease, generation: f.run.generation, at: f.now, blockedOn: { kind: 'nothing' },
    nextWake: f.run.nextWake, exit } as const;
  value(legacy.transition(proposal));
  const close = { ...proposal, id: 'review18:completed-close', expected: proposal.id,
    kind: 'close', from: 'closing', to: 'completed',
    exit: { ...exit, id: 'review18:completed-terminal', expected: proposal.id } } as const;
  value(legacy.transition(close));
  return { legacy, ready, checkFact, resultFact, proposal, close };
}

export function completedFixture(storageFactory?: (fallback: SegmentStoragePort) => SegmentStoragePort) {
  const f = closureSetup(storageFactory), ready = value(f.graph.open(f.run));
  const check = value(decode('Evidence', f.evidenceInput({ id: 'exit-read-check', claim: { subject: f.run.exitTest.subject,
    predicate: `exit:${f.run.exitTest.check}:${f.run.exitTest.version}`, value: f.run.exitTest.acceptance }, freshFor: 1000 }), f.ctx.decode));
  const checkFact = f.append('evidence-record', json({ evidence: check })).fact;
  const result = value(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success', value: 'terminal artifact', capacity: { kind: 'none' } }, f.ctx.decode));
  const resultFact = f.append('result-record', json({ result })).fact;
  const exit = { type: 'RunExit', schemaVersion: 1, id: 'exit-read-proposal', run: f.id, expected: ready.head, proposer: f.owner,
    standing: ref(f.opening), frontier: ready.source.foldedThrough, at: f.now, kind: 'completed', exitTest: f.run.exitTest,
    check: ref(checkFact), evidence: [{ type: 'Evidence', id: check.id, fact: ref(checkFact), field: 'evidence' }],
    result: { type: 'Result', id: 'result:exit-read', fact: ref(resultFact), field: 'result' }, settledOperations: [] } as const;
  const proposal = { type: 'RunTransition', schemaVersion: 1, id: 'exit-read-propose', run: f.id, expected: ready.head,
    trigger: ref(checkFact), kind: 'propose-exit', from: 'ready', to: 'closing', responsible: f.owner, standing: ref(f.opening), ownership: f.lease,
    generation: f.run.generation, at: f.now, blockedOn: { kind: 'nothing' }, nextWake: f.run.nextWake, exit } as const;
  return { ...f, ready, exit, proposal };
}

export function pressureFixture(basis: 'queue-full' | 'quota-wall' | 'safety-ceiling' | 'open-breaker',
  storageFactory?: (fallback: SegmentStoragePort) => SegmentStoragePort) {
  const f = closureSetup(storageFactory), opened = value(f.graph.open(f.run));
  const halted = basis === 'safety-ceiling';
  const running = halted ? undefined : value(f.graph.transition(f.start(opened,
    value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease)))));
  const observation = halted ? undefined : f.observe(running!, 'uncertain');
  const event = f.append('run-pressure-event', json({ run: f.id, budget: f.run.budget.id, basis, status: 'applied' })).fact;
  const current = running ?? opened;
  const transition = { type: 'RunTransition', schemaVersion: 1, id: `inhibit:${basis}`, run: f.id, expected: current.head,
    trigger: ref(event), kind: halted ? 'stop' : 'observe', from: current.state, to: halted ? 'halted' : 'waiting', responsible: f.owner,
    standing: ref(f.opening), ownership: f.lease, generation: f.run.generation, at: f.now,
    blockedOn: halted ? { kind: 'stop', reference: basis, owner: f.owner, nextObservation: f.clock(1000) }
      : current.blockedOn,
    nextWake: f.run.nextWake, ...(observation ? { affectedStep: current.pending[0]!.id, outcome: observation.outcome } : {}) } as const;
  return { ...f, ready: current, opened, running, event, transition };
}

export function attemptedAvenue(f: ReturnType<typeof exhaustionFixture>, view: RunView) {
  const step = view.pending[0]!;
  const input = f.evidenceInput({ id: `attempt:${step.id}`,
    claim: { subject: step.operation.key, predicate: 'operation-outcome', value: { digest: step.operation.digest, kind: 'did-not-happen' } },
    freshFor: 1000 });
  const capture = (input as { capture: { reference: string } }).capture.reference;
  const bytes = f.captures[capture]!;
  Object.assign(f.ctx.captures, { [capture]: { bytes, hash: (input as { capture: { hash: string } }).capture.hash,
    status: 'available', byteLength: Buffer.byteLength(bytes) } });
  const evidence = value(decode('Evidence', input, f.ctx.decode));
  f.evidence.push(evidence);
  const outcome = value(decode('Outcome', f.raw('Outcome', { kind: 'did-not-happen', evidence: [evidence.id] }),
    { ...f.ctx.decode, evidence: [evidence] }));
  const fact = f.append('outcome-record', json({ evidence, outcome })).fact;
  return { fact, trigger: ref(fact), outcome: { type: 'Outcome' as const, id: `outcome:${fact.id}`, fact: ref(fact), field: 'outcome' as const } };
}

export function rebuild(f: Fixture): RunView {
  return value(value(createRunClosureGraph(f.deps)).read(f.id));
}

export const reference = (fact: { id: string }): FactEnvelopeReference => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });
