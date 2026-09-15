import { expect, it } from 'vitest';
import { createRunGraph } from '../../src/rungraph/index.js';
import type { AssemblyHistoryReadPort, ContextDeliverySpecification, HarnessLaunchSpec, HarnessObservation } from '../../src/assembly/index.js';
import { setup, json, ref, refused, value, digest } from './fixtures.js';

function production(reason: 'initial' | 'live-input' | 'compaction' = 'initial') {
  const events: string[] = [];
  const f = setup(undefined, undefined, {
    fields: { intent: { kind: 'constitutional', type: 'Intent' }, owner: { kind: 'constitutional', type: 'VerifiedPrincipal' }, capture: { kind: 'capture' } },
    extra: { 'assembly-HarnessObservation': { marker: { kind: 'text', maxLength: 80 } } },
    body: ({ intent, owner, hash }) => json({ intent, owner, capture: { reference: 'message:1', hash } }),
  });
  const ready = value(f.graph.open(f.run));
  const messageHash = f.ctx.captures['message:1']!.hash;
  const step = 'step:operation:1', incarnation = 'incarnation:live:1';
  const launch = { type: 'HarnessLaunchSpec', schemaVersion: 1, id: 'assembly-launch:1', predecessors: [], dependencyFacts: [],
    run: f.id, step: 'original-launch-step', principal: 'w', incarnation, harness: 'h', artifactDigest: digest('harness-artifact'),
    machine: 'machine-a', workingScope: 'workspace', processOperation: 'effect:launch', resourceReferences: [], portHandles: ['worker'],
    environment: [], contextManifest: [{ class: 'original', reference: 'original', digest: digest('original') }],
    input: 'original-intake', inputDigest: digest('original-intake'), consumptionMode: 'model-context-boundary' } as unknown as HarnessLaunchSpec;
  const manifest = [{ class: 'message', reference: 'message:1', digest: messageHash },
    ...f.deps.groundingPolicy.briefingClasses.map(name => ({ class: name, reference: `briefing:${name}`, digest: digest(name) }))];
  const specification = { type: 'ContextDeliverySpecification', schemaVersion: 1, id: 'assembly-delivery:1', predecessors: [], dependencyFacts: [],
    launch: launch.id, run: f.id, step, input: f.opening.id, inputDigest: digest('current-intake'), incarnation,
    harness: 'h', artifactDigest: launch.artifactDigest, machine: launch.machine, generation: f.run.generation.id,
    executionContext: f.opening.id, contextManifest: manifest, reason, operation: 'effect:delivery:1', claim: 'claim:delivery:1',
    previousDelivery: reason === 'initial' ? '' : 'assembly-delivery:0', controlObservation: reason === 'compaction' ? 'control:compaction' : '' } as unknown as ContextDeliverySpecification;
  let observationFact: ReturnType<typeof f.append>['fact'] | undefined;
  let observation = { type: 'HarnessObservation', schemaVersion: 1, id: 'assembly-observation:1', predecessors: [], dependencyFacts: [],
    launch: launch.id, run: f.id, step, input: f.opening.id, incarnation, contextDelivery: specification.id,
    sourceEvidence: [], contextDigests: manifest.map(row => row.digest), generation: f.run.generation.id,
    causalReferences: [], observedAt: f.now.value, freshFor: 1000, phase: 'context-consumed', boundaryEvidence: '', detail: 'instrumented boundary' } as unknown as HarnessObservation;
  let mode: 'ok' | 'partial' | 'conflicted' | 'wrong-kind' | 'copied' = 'ok';
  const verdict = { admitted: true, completeness: 'complete' as const, facts: [], conflicts: [], missing: [] };
  const history: AssemblyHistoryReadPort = { owner: 'part-ten', current: () => { events.push('history'); return f.success([]); },
    lookup: reference => {
      events.push(`resolve:${reference}`);
      const row = reference === observationFact?.id ? { fact: mode === 'wrong-kind' ? { ...observationFact, kind: 'consumption' }
        : mode === 'copied' ? { ...observationFact, id: 'copied-fact' } : observationFact, record: mode === 'copied' ? { ...observation, id: 'copied' } : observation }
        : reference === specification.id ? { fact: { ...observationFact!, id: specification.id, kind: 'assembly-ContextDeliverySpecification' }, record: specification }
          : reference === launch.id ? { fact: { ...observationFact!, id: launch.id, kind: 'assembly-HarnessLaunchSpec' }, record: launch }
            : reference === observation.boundaryEvidence ? { fact: observationFact } : undefined;
      return f.success(row ? { ...row, taint: [], conflicts: mode === 'conflicted' ? [{ key: 'conflict', kind: 'immutable-disagreement' as const, facts: ['a', 'b'], detail: 'conflict' }] : [],
        completeness: mode === 'partial' ? 'partial' as const : 'complete' as const } : null);
    }, resolve: () => { events.push('admit'); return f.success(verdict); },
    resolveContextDelivery: () => { events.push('admit-delivery'); return f.success(verdict); } };
  const grounding = { owner: 'part-ten' as const, production: true as const, read: ({ run: view, worker, harness, reason: runReason, execution }: Parameters<typeof f.deps.grounding.read>[0]) => {
    events.push('reader'); value(history.current()); events.push('deliver');
    observationFact = f.append('assembly-HarnessObservation', json({ marker: 'consumed' }), [f.opening.id]).fact;
    observation = { ...observation, boundaryEvidence: observationFact.id };
    events.push('consume'); value(history.lookup(observationFact.id));
    const messages = [{ fact: ref(f.opening), sequence: f.opening.segment.position, capture: 'message:1', hash: messageHash }];
    return f.success({ type: 'SessionGrounding', schemaVersion: 2, id: 'production-ground:1', run: f.id, expected: view.head,
      worker, harness, reason: runReason, step, incarnation, contextDeliveryReason: reason, ownership: execution.ownership,
      executionContext: execution.context, at: f.now, previousActivity: f.now,
      elapsed: { type: 'Measurement', schemaVersion: 1, subject: { kind: 'elapsed-time', instance: worker }, value: 0, unit: 'ms', at: f.now, by: 'probe' },
      principal: f.owner, intake: ref(f.opening), binding: f.run.resultDestination.binding, directives: [], generation: f.run.generation,
      frontier: { 'machine-a': { epoch: 0, position: observationFact.segment.position } }, knownLineages: ['machine-a'], threshold: 20,
      messages, lastInbound: ref(f.opening), pendingOperations: [], children: [], receipts: [],
      briefingClasses: f.deps.groundingPolicy.briefingClasses, consumption: ref(observationFact) });
  } };
  const graph = value(createRunGraph({ ...f.deps, grounding, assemblyHistory: history,
    clock: () => { events.push('clock'); return f.now; } }));
  return { ...f, ready, graph, events, history, specification, launch, step,
    setMode: (next: typeof mode) => { mode = next; }, setObservation: (next: HarnessObservation) => { observation = next; },
    observation: () => observation, observationFact: () => observationFact! };
}

it('PRODUCTION-GROUNDING P5-SG-01 P5-SG-02 ground invokes fresh read, history, delivery and consumption; start re-resolves without a pending-step cut', () => {
  const f = production();
  const grounding = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  const reader = f.events.indexOf('reader'), history = f.events.indexOf('history'), delivered = f.events.indexOf('deliver'), consumed = f.events.indexOf('consume');
  expect(f.events.slice(0, reader).every(event => event === 'clock')).toBe(true);
  expect(reader).toBeLessThan(history); expect(history).toBeLessThan(delivered); expect(delivered).toBeLessThan(consumed);
  expect(f.events.slice(consumed + 1)).toContain(`resolve:${f.observationFact().id}`);
  expect(value(f.graph.read(f.id)).pending).toHaveLength(0);
  const resolutions = f.events.filter(event => event.startsWith('resolve:')).length;
  const running = value(f.graph.transition(f.start(f.ready, grounding)));
  expect(running.state).toBe('running'); expect(running.pending.map(item => item.id)).toEqual([f.step]);
  expect(f.events.filter(event => event.startsWith('resolve:')).length).toBeGreaterThan(resolutions);
});

it('PRODUCTION-GROUNDING P5-SG-03 P5-SG-04 refuses held compaction and excludes the flat compatibility receipt from production', () => {
  const held = production('compaction');
  refused(held.graph.ground(held.id, 'w', 'h', 'start', held.lease), 'NON-EXECUTABLE-UNTIL-live-path-unit-compaction');
  const flat = setup(), ready = value(flat.graph.open(flat.run)), receipt = value(flat.graph.ground(flat.id, 'w', 'h', 'start', flat.lease));
  const graph = value(createRunGraph({ ...flat.deps, grounding: { ...flat.deps.grounding, production: true }, assemblyHistory: held.history }));
  refused(graph.transition(flat.start(ready, receipt)), 'context-delivery identity');
});

it('PRODUCTION-GROUNDING P5-SG-05 refuses wrong-kind, partial, conflicted, copied, stale, manifest, launch and candidate-step mismatches', () => {
  for (const mode of ['wrong-kind', 'partial', 'conflicted', 'copied'] as const) {
    const f = production(); f.setMode(mode); refused(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  }
  for (const mutate of [
    (f: ReturnType<typeof production>) => f.setObservation({ ...f.observation(), observedAt: 0 }),
    (f: ReturnType<typeof production>) => { (f.specification.contextManifest as any[]).pop(); },
    (f: ReturnType<typeof production>) => { (f.specification as any).incarnation = 'different'; },
  ]) { const f = production(); mutate(f); refused(f.graph.ground(f.id, 'w', 'h', 'start', f.lease)); }
  const step = production(), grounding = value(step.graph.ground(step.id, 'w', 'h', 'start', step.lease));
  refused(step.graph.transition({ ...step.start(step.ready, grounding), step: { ...step.start(step.ready, grounding).step!, id: 'step:different' } }), 'candidate RunStep');
});
