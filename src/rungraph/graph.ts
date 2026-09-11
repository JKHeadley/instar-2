import { consumeOutcome, consumeResult, decode, compareMeasurements, readHistoricalEvidence } from '../index.js';
import type { Clock, Evidence, FactEnvelopeReference, Inventory, Json, Outcome, Result } from '../index.js';
import { causalCone, causalStanding, decodeHistoricalBody, hashBytes } from '../facts/index.js';
import type { ConflictClass, FactEnvelope, FactSnapshot } from '../facts/index.js';
import { foldProjection, readProjection } from '../projections/index.js';
import type { ProjectionDefinition, ProjectionGeneration } from '../projections/index.js';
import { boundary, encoded, freeze, json, need, object, same, take } from './boundary.js';
import { constitutional, decodeRun, decodeRunExit, decodeRunTransition, decodeSessionGrounding, factReference, recordFromWire, runKinds } from './records.js';
import type { CompletedRunExit, Run, RunDecodeContext, RunStep, RunTransition, RunView, SessionGrounding, RunReplayPort } from './types.js';
import { checkIdentities, identityIndex } from './identity.js';

export const clockDifference = (left: Clock, right: Clock, c: RunDecodeContext): number => take(compareMeasurements<'clock'>(left, right, c.preserved));

export const statePairs: Readonly<Record<string, readonly string[]>> = freeze({
  ready: ['running', 'waiting', 'halted', 'closing'], running: ['ready', 'waiting', 'recovering', 'halted', 'closing'],
  waiting: ['ready', 'recovering', 'halted', 'closing'], recovering: ['ready', 'waiting', 'halted', 'closing'],
  halted: ['ready', 'waiting', 'recovering', 'closing'], closing: ['completed', 'unreachable', 'cancelled', 'waiting', 'halted'],
  completed: [], unreachable: [], cancelled: [],
});
export function runProjection(generation: ProjectionGeneration): ProjectionDefinition {
  return { id: 'run-view', class: 'authority-answering', retention: 'all-identities', stalenessBound: 60_000,
    decisions: Object.fromEntries(generation.kinds.map(kind => [kind, Object.values(runKinds).includes(kind as typeof runKinds[keyof typeof runKinds])
      ? { kind: 'folds' as const, merge: kind === runKinds.Run ? 'exclusive-singleton' as const : 'set-union' as const, identity: 'run', value: 'record' }
      : { kind: 'ignores' as const, reason: 'other owner body; P2 source status and causal coverage remain mandatory' }])) };
}
export function readRecordFact(fact: FactEnvelope): Json { return recordFromWire(object(fact.body).record!); }
export const factRef = (fact: FactEnvelope): FactEnvelopeReference => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });
export function outcomeAt(t: RunTransition, c: RunDecodeContext): Outcome {
  need(t.outcome, 'recorded outcome required');
  const read = constitutional(t.outcome, 'Outcome', c);
  // Evidence is non-authorizing. Rehydrate it through P1's public decoder; never
  // cast historical values into live authority to consume an Outcome.
  const evidence: Evidence[] = [];
  for (const fact of c.facts.facts) {
    const schema = c.facts.schemas.find(s => s.kind === fact.kind && s.version === fact.schemaVersion);
    if (!schema || !Object.values(schema.fields).some(s => s.kind === 'constitutional' && s.type === 'Evidence')) continue;
    const body = take(decodeHistoricalBody(fact, c.facts, causalStanding(fact, c.facts, false).decode));
    for (const record of body.records) if (record.view.type === 'Evidence' && record.captureStatus === 'available') evidence.push(take(decode('Evidence', record.view, c.types)));
  }
  return take(decode('Outcome', read.view, { ...c.types, evidence: [...c.types.evidence ?? [], ...evidence] }));
}
function evidenceClaims(ref: FactEnvelopeReference, source: string, now: Clock, c: RunDecodeContext) {
  const fact = factReference(json(ref), c);
  const body = take(decodeHistoricalBody(fact, c.facts, causalStanding(fact, c.facts, false).decode));
  return body.records.filter(r => r.view.type === 'Evidence').map(r => {
    const read = r as import('../index.js').HistoricalRead<Evidence>;
    need(read.view.source === source, 'evidence did not come from the registered seam producer');
    return take(readHistoricalEvidence(read, now, c.preserved));
  });
}
export function settled(t: RunTransition, step: RunStep, c: RunDecodeContext): boolean {
  if (!t.settlement) return false;
  return evidenceClaims(t.settlement, c.evidenceSources.settlement, t.at, c).some(claim => {
    if (claim.subject !== step.operation.key || claim.predicate !== 'operation-settled') return false;
    const v = object(claim.value); return v.digest === step.operation.digest && v.chargeSettled === true && v.claimClosed === true;
  });
}
export function validateExit(exit: CompletedRunExit, run: Run, head: string, pending: readonly RunStep[], settledKeys: readonly string[], now: Clock, c: RunDecodeContext): void {
  need(exit.run === run.id && exit.expected === head && same(exit.proposer, run.owner), 'exit run/head/proposer mismatch');
  need(pending.length === 0 && same([...exit.settledOperations].sort(), [...settledKeys].sort()), 'exit has unsettled operations or incomplete settlement manifest');
  need(same(exit.exitTest, run.exitTest), 'exit test changed; cannot lower the completion bar');
  const age = clockDifference(now, exit.at, c); need(age >= 0 && age <= run.exitTest.freshFor, 'exit evidence is stale');
  need(evidenceClaims(exit.check, c.evidenceSources.exit, now, c).some(claim => claim.subject === run.exitTest.subject
    && claim.predicate === `exit:${run.exitTest.check}:${run.exitTest.version}` && claim.value === run.exitTest.acceptance), 'registered exact exit check has not passed');
  need(exit.evidence.length > 0, 'completion requires subject-matching fresh evidence');
  const kinds = new Set<string>();
  for (const ref of exit.evidence) {
    const read = constitutional(ref, 'Evidence', c), claim = take(readHistoricalEvidence(read, now, c.preserved));
    need(claim.subject === run.exitTest.subject, 'exit evidence subject differs'); kinds.add(read.view.strength);
  }
  need(run.exitTest.evidenceKinds.every(kind => kinds.has(kind)), 'required exit evidence kind absent');
  const result = constitutional(exit.result, 'Result', c);
  const decoded = take(decode('Result', result.view, c.types));
  need(consumeResult(decoded, { Success: () => true, Refused: () => false }), 'refused work cannot become a completed run');
}
/** Owner decision (slice-five-gap option 1, 2026-09-06): a stimulus whose own schema
 * declares a capture field keeps the primary direct binding, unchanged. Only when the
 * schema declares NO capture field may the binding be carried by EXACTLY ONE
 * reference-policy field whose target — an admitted fact inside the stimulus fact's
 * own causal cone — declares the capture field (for intake-admitted: its receipt).
 * Ambiguity refuses rather than guesses; a missing/unverified target refuses. */
function captureBindingFact(fact: FactEnvelope, c: RunDecodeContext): FactEnvelope {
  const schema = c.facts.schemas.find(s => s.kind === fact.kind && s.version === fact.schemaVersion);
  need(schema, 'grounding capture not bound to the signed message capture field');
  if (Object.values(schema.fields).some(policy => policy.kind === 'capture')) return fact;
  const bearers = Object.entries(schema.fields).filter(([, policy]) => policy.kind === 'reference').map(([field]) => {
    const id = object(fact.body)[field];
    const ancestor = typeof id === 'string' ? c.facts.facts.find(f => f.id === id) : undefined;
    const ancestorSchema = ancestor && c.facts.schemas.find(s => s.kind === ancestor.kind && s.version === ancestor.schemaVersion);
    need(ancestor && ancestorSchema, 'grounding capture ancestor missing or unverified');
    return { ancestor, captureBearing: Object.values(ancestorSchema.fields).some(policy => policy.kind === 'capture') };
  }).filter(candidate => candidate.captureBearing);
  need(bearers.length <= 1, 'ambiguous grounding capture ancestors');
  const selected = bearers[0]; need(selected, 'grounding capture not bound to the signed message capture field');
  need(causalCone(fact, c.facts.facts).some(f => f.id === selected.ancestor.id), 'grounding capture ancestor missing or unverified');
  return selected.ancestor;
}
export function validateGrounding(g: SessionGrounding, run: Run, head: string, pending: readonly RunStep[], c: RunDecodeContext): void {
  need(g.run === run.id && g.expected === head && same(g.principal, run.owner) && same(g.binding, run.resultDestination.binding), 'grounding run/head/principal/binding mismatch');
  need(same(g.directives, run.directives) && same(g.generation, run.generation), 'grounding directives or generation differ');
  need(same([...g.pendingOperations].sort(), pending.map(s => s.operation.key).sort()) && g.children.length === 0, 'grounding omitted pending work');
  const receipt = factReference(json(g.consumption), c), body = object(receipt.body);
  const consumedCone = [...causalCone(receipt, c.facts.facts), receipt];
  for (const [machine, position] of Object.entries(g.frontier)) need(consumedCone.some(f => f.machine === machine
    && f.segment.epoch === position.epoch && f.segment.position === position.position), 'grounding frontier claims unseen history');
  const history = c.facts.facts.filter(f => c.stimulusKinds.includes(f.kind) && g.frontier[f.machine]
    && (f.segment.epoch < g.frontier[f.machine]!.epoch || f.segment.epoch === g.frontier[f.machine]!.epoch && f.segment.position <= g.frontier[f.machine]!.position));
  need(new Set(history.map(f => f.machine)).size === 1, 'out of slice scope: multi-lineage conversation ordering');
  history.sort((a, b) => a.segment.epoch - b.segment.epoch || a.segment.position - b.segment.position);
  need(history.length <= g.threshold, 'out of slice scope: history requires summaries; no skim permitted');
  need(g.messages.length === history.length && new Set(g.messages.map(m => m.fact.id)).size === history.length, 'grounding history coverage gap or overlap');
  const expected = new Set(history.map(f => f.id));
  for (const message of g.messages) {
    const fact = factReference(json(message.fact), c);
    need(expected.has(fact.id) && message.sequence === fact.segment.position, 'grounding claims an absent/post-frontier message');
    const capture = c.facts.captures[message.capture];
    need(capture?.status === 'available' && capture.hash === message.hash && capture.bytes !== null
      && hashBytes(capture.bytes) === message.hash, 'grounding capture unavailable or changed');
    const carrier = captureBindingFact(fact, c);
    const carrierSchema = c.facts.schemas.find(s => s.kind === carrier.kind && s.version === carrier.schemaVersion);
    need(carrierSchema && Object.entries(carrierSchema.fields).some(([field, policy]) => policy.kind === 'capture'
      && same(object(carrier.body)[field], { reference: message.capture, hash: message.hash })),
      carrier.id === fact.id ? 'grounding capture not bound to the signed message capture field'
        : 'grounding capture not bound by the capture-bearing stimulus ancestor');
  }
  need(g.knownLineages.length === Object.keys(g.frontier).length && g.knownLineages.every(k => Object.hasOwn(g.frontier, k)), 'grounding lineage coverage differs');
  const latest = history.at(-1); need(latest && latest.id === g.lastInbound.id, 'grounding last inbound differs');
  // Ten's consumption fact is independent evidence of delivery to the named
  // worker. A history-index enumeration alone cannot satisfy actual grounding.
  need(body.worker === g.worker && body.harness === g.harness && typeof body.hashes === 'string' && typeof body.classes === 'string'
    && same(JSON.parse(body.hashes), g.messages.map(m => m.hash))
    && same(JSON.parse(body.classes), g.briefingClasses), 'harness consumption receipt does not bind delivered context');
}
export function validateTransition(t: RunTransition, view: RunView, c: RunDecodeContext): void {
  const run = view.run;
  checkIdentities(json(t), view.identities);
  need(t.run === run.id && t.expected === view.head && t.from === view.state, 'transition expected predecessor/state differs');
  need(statePairs[t.from]?.includes(t.to), 'state pair is not permitted');
  need(same(t.responsible, run.owner) && same(t.generation, run.generation), 'transition owner/generation differs');
  if (t.kind === 'start') {
    need(t.from === 'ready' && t.to === 'running' && t.step && t.grounding && !t.outcome && !t.exit, 'start requires admitted step and actual-start grounding');
    need(view.pending.length === 0, 'uncertain predecessor forbids same-key or new-key work');
    const s = t.step; need(s.run === run.id && s.expected === view.head && same(s.ownership, t.ownership) && same(s.generation, run.generation), 'step identity/predecessor/ownership differs');
    need(!view.usedKeys.includes(s.operation.key), 'operation key is already admitted; no resubmission');
    need(s.allocation.budget === run.budget.id && run.budget.maxWorkers > 0 && run.budget.maxProcesses > 0
      && view.pending.length < run.budget.maxOutstanding && clockDifference(t.at, run.budget.safetyCeiling, c) <= 0, 'budget ceiling or zero capacity forbids work');
    need(same(s.directives, run.directives) && same(s.resultDestination, run.resultDestination), 'step changed directives/destination');
    const fact = factReference(json(t.grounding), c); need(fact.kind === runKinds.SessionGrounding, 'grounding reference has wrong schema');
    const grounding = take(decodeSessionGrounding(readRecordFact(fact), c)); validateGrounding(grounding, run, view.head, view.pending, c);
    need(same(grounding.ownership, t.ownership), 'grounding belongs to another ownership context');
    need(clockDifference(t.at, grounding.at, c) >= 0, 'grounding clock is in the future');
    need(t.blockedOn.kind === 'step' && t.blockedOn.reference === s.id, 'running step must retain an owned pending obligation');
  } else if (t.kind === 'observe') {
    need(['running', 'waiting', 'recovering'].includes(t.from) && ['ready', 'waiting'].includes(t.to) && t.affectedStep && t.outcome && !t.step, 'outcome transition requires pending step');
    const step = view.pending.find(s => s.id === t.affectedStep); need(step, 'outcome already consumed or wrong step');
    const outcome = outcomeAt(t, c), terminal = consumeOutcome(outcome, { happened: () => true, 'did-not-happen': () => true, uncertain: () => false });
    const complete = terminal && settled(t, step, c);
    need(t.to === (complete ? 'ready' : 'waiting'), 'uncertain execution/charge remains waiting; no fresh work');
    need(complete ? t.blockedOn.kind === 'nothing' : t.blockedOn.kind === 'step' && t.blockedOn.reference === step.id, 'outcome lost its pending obligation');
  } else if (t.kind === 'recover') {
    need(['running', 'waiting'].includes(t.from) && t.to === 'recovering' && t.blockedOn.kind === 'recovery', 'recovery does not complete or retry the assignment');
    need(!t.step && !t.outcome && !t.exit, 'recovery preserves the exact pending operation');
  } else if (t.kind === 'stop') {
    need(t.to === 'halted' && t.blockedOn.kind === 'stop' && !t.step && !t.outcome && !t.exit, 'stop only inhibits; it does not settle work');
  } else if (t.kind === 'resume') {
    need(t.from === 'halted' && t.to === (view.pending.length ? 'recovering' : 'ready') && !t.step && !t.outcome, 'resume cannot bypass unresolved work');
  } else if (t.kind === 'propose-exit') {
    need(t.from !== 'halted', 'stopped run cannot acquire new completion authority without authorized resume');
    need(t.to === 'closing' && t.exit && !t.step && !t.outcome, 'closure requires exit proposal'); validateExit(t.exit, run, view.head, view.pending, view.settled, t.at, c);
  } else {
    need(t.kind === 'close' && t.from === 'closing' && t.to === 'completed' && t.exit && !t.step && !t.outcome, 'only checked completed exit is in slice scope');
    validateExit(t.exit, run, view.head, view.pending, view.settled, t.at, c);
  }
}
export function foldRun(runId: string, snapshot: FactSnapshot, generation: ProjectionGeneration, c: RunDecodeContext, now: Clock, witnesses: RunReplayPort): Result<RunView> {
  return boundary('RunFold', null, c, () => {
    need(witnesses && typeof witnesses.verify === 'function', 'durable owner witness consumer required');
    const source = take(foldProjection(runProjection(generation), snapshot, generation, c));
    take(readProjection(source, runProjection(generation), now, c));
    const opening = source.values[`${runKinds.Run}:${runId}`]; need(opening && !Array.isArray(opening), 'run opening missing or conflicted');
    const run = take(decodeRun(recordFromWire(opening), c));
    const root = snapshot.entries.find(e => e.fact.kind === runKinds.Run && object(e.fact.body).run === runId)!.fact;
    need(same(take(witnesses.verify(root, run, null)), factRef(root)), 'root admission witness mismatch');
    const facts = snapshot.entries.map(e => e.fact).filter(f => f.kind === runKinds.RunTransition && object(f.body).run === runId);
    const transitions = facts.map(fact => ({ fact, record: take(decodeRunTransition(readRecordFact(fact), c)) }));
    const identities = identityIndex(snapshot.entries.map(e => e.fact)), conflicts: ConflictClass[] = [];
    const localFacts = new Set(snapshot.entries.filter(e => object(e.fact.body).run === runId).map(e => e.fact.id));
    for (const row of identities) {
      const peers = identities.filter(r => r.type === row.type && r.id === row.id);
      if (peers.length > 1 && peers.some(r => r.facts.some(id => localFacts.has(id))) && !conflicts.some(c => c.key === `${row.type}:${row.id}`))
        conflicts.push({ key: `${row.type}:${row.id}`, kind: 'immutable-disagreement', facts: [...new Set(peers.flatMap(r => r.facts))].sort(), detail: 'immutable owned identity disagreement' });
    }
    let view: RunView = { run, head: run.id, state: 'ready', pending: [], settled: [], usedKeys: [], blockedOn: run.blockedOn, nextWake: run.nextWake, source, conflicts, identities };
    const remaining = new Map(transitions.map(t => [encoded(t.record).bytes, t]));
    while (remaining.size && !conflicts.length) {
      const successors = [...remaining.values()].filter(t => t.record.expected === view.head);
      if (successors.length !== 1) {
        conflicts.push({ key: `run-head:${runId}:${view.head}`, kind: 'immutable-disagreement', facts: [...remaining.values()].map(t => t.fact.id).sort(), detail: successors.length ? 'incompatible concurrent run successors' : 'missing predecessor or cycle' }); break;
      }
      const { record: t, fact } = successors[0]!;
      const predecessor = facts.find(f => object(readRecordFact(f)).id === t.expected)
        ?? snapshot.entries.find(e => e.fact.kind === runKinds.Run && object(e.fact.body).run === runId)?.fact;
      need(predecessor && causalCone(fact, c.facts.facts).some(f => f.id === predecessor.id), 'transition is not causally linked to predecessor');
      validateTransition(t, view, c);
      if (t.grounding) {
        const groundingFact = factReference(json(t.grounding), c), grounding = take(decodeSessionGrounding(readRecordFact(groundingFact), c));
        need(same(take(witnesses.verify(groundingFact, grounding, view)), factRef(groundingFact)), 'grounding admission witness mismatch');
      }
      need(same(take(witnesses.verify(fact, t, view)), factRef(fact)), 'transition admission witness mismatch');
      let pending = [...view.pending], settledKeys = [...view.settled], used = [...view.usedKeys];
      if (t.kind === 'start') { pending.push(t.step!); used.push(t.step!.operation.key); }
      if (t.kind === 'observe' && t.to === 'ready') { const s = pending.find(s => s.id === t.affectedStep)!; settledKeys.push(s.operation.key); pending = pending.filter(p => p.id !== s.id); }
      view = { ...view, state: t.to, head: t.id, pending, settled: settledKeys, usedKeys: used, blockedOn: t.blockedOn, nextWake: t.nextWake };
      remaining.delete(encoded(t).bytes);
    }
    if (conflicts.length) view = { ...view, state: 'halted', conflicts: [...conflicts].sort((a, b) => a.key.localeCompare(b.key)),
      blockedOn: { kind: 'evidence', reference: conflicts[0]!.key, owner: run.owner, nextObservation: run.nextWake.at } };
    return freeze(view);
  });
}
