// @ts-nocheck -- adjudicated fixture translation; assertions remain in the cases.
import { createLiveInputAssemblyFixture, ref } from './live-input-owner-fixture.js';
import { value, json } from '../facts/fixtures.js';
import { canonical } from '../../src/index.js';
export function realTenFixture(storageFactory?: any) {
  const f = createLiveInputAssemblyFixture(storageFactory, { minimal: true });
  const p = f.groundingFor({ scope: 'scope:minimal' });
  const request = { run: { head: 'candidate', pending: [] }, worker: 'w', harness: 'native', reason: 'start',
    execution: value(f.deps.admission.execution(f.id, f.lease)) };
  const first: any = { ...value(p.sample(request, f.deps.clock())).specification, step: 'step:next' };
  const candidates = new Map([[first.operation, first]]);
  let evidence;
  return { ...f, runtime: p.runtime, history: p.history, driver: p.driver, launchFact: f.launchFact,
    spec: (reason = 'initial', operation = first.operation, previousDelivery = '') => ({ ...candidates.get(operation), reason, previousDelivery }),
    recreateDriver: () => {
      f.effects.recreate(f.store);
      return f.groundingFor({ scope: 'scope:minimal' }).driver;
    },
    calls: () => f.owners.events.filter((e: string) => e === 'deliver').length,
    next: (label: string) => {
      const prior: any = [...candidates.values()].at(-1);
      const current = value(f.effects.transport.inspect()).filter((r: any) => r.record.type === 'AdmissionReservation' && r.record.operation === prior.operation).at(-1);
      if (current.record.state === 'dispatch-claimed') {
        const spec = value(p.runtime.recordContextDelivery(prior));
        value(p.driver.deliver(spec, { operation: spec.operation, claim: spec.claim }));
        value(p.driver.observe(spec, spec.operation));
      }
      const message = f.effects.message(f.id, label), capture = value(f.owners.host.capture(value(canonical(message)).bytes));
      f.append('next-inbound', json({ capture }));
      const candidate: any = value(p.sample(request, f.deps.clock())).specification;
      candidates.set(candidate.operation, candidate);
      return { operation: { id: candidate.operation }, claim: { id: candidate.claim } };
    },
    get evidence() {
      if (!evidence) {
        const existing = value(f.effects.api.inspect()).find((r: any) => r.record.type === 'OperationObservation' && r.record.operation === first.operation && r.record.stage === 'response');
        if (existing) return existing.fact;
        const spec = value(p.runtime.recordContextDelivery(first));
        value(p.driver.deliver(spec, { operation: spec.operation, claim: spec.claim }));
        evidence = value(f.effects.api.inspect()).find((r: any) => r.record.type === 'OperationObservation' && r.record.operation === first.operation && r.record.stage === 'response').fact;
      }
      return evidence;
    },
  };
}

import { createProductionGroundingReader } from '../../src/assembly/index.js';
import { createRunGraph } from '../../src/rungraph/index.js';
export function realPairedFixture(options: any = {}): { runtime: import('../../src/assembly/index.js').AssemblyRuntimePort; history: import('../../src/assembly/index.js').AssemblyHistoryReadPort; store: import('../../src/facts/index.js').FactStorePort; graph: import('../../src/rungraph/index.js').RunGraphPort; deps: import('../../src/rungraph/index.js').RunGraphDependencies; [key: string]: any } {
  const f = createLiveInputAssemblyFixture(undefined, { minimal: true, harness: 'h' });
  const p = f.groundingFor({ scope: 'scope:minimal' });
  const reader = createProductionGroundingReader({ scope: 'scope:minimal', runtime: p.runtime, harness: p.harness,
    context: p.context, clock: p.clock, sample: p.sample });
  const deps = { ...p.graphDependencies, store: p.spine.store, assemblyHistory: p.history, grounding: reader };
  const graph = value(createRunGraph(deps)), ready = value(graph.open(f.run));
  const secondMessage = f.effects.message(f.id, 'second distinct live input');
  const secondBytes = value(canonical(secondMessage)).bytes, secondHash = value(canonical(secondMessage)).hash;
  f.ctx.captures['message:2'] = { bytes: secondBytes, hash: secondHash, byteLength: Buffer.byteLength(secondBytes), status: 'available' };
  const last = () => {
    const rows = value(p.runtime.inspectCurrent());
    const delivery = rows.filter((r: any) => r.record.type === 'ContextDeliverySpecification').at(-1);
    const observation = rows.filter((r: any) => r.record.type === 'HarnessObservation' && r.record.contextDelivery === delivery?.fact.id
      && r.record.phase === 'context-consumed').at(-1);
    return { ...f.last(), spec: delivery?.record ?? f.last()?.spec, observation: observation?.record,
      sf: delivery?.fact, of: observation?.fact, witness: observation && value(p.history.lookup(observation.record.boundaryEvidence)).fact };
  };
  return { ...f, ...p, deps, graph, ready, reader, events: f.owners.events, lf: f.launchFact, last,
    read: (request: any) => {
      if (last().of && value(f.store.read()).filter((row: any) => ['stimulus', 'next-inbound'].includes(row.kind)).at(-1)!.id === last().spec.input) {
        const message = f.effects.message(f.id, 'subsequent captured input');
        const capture = value(f.owners.host.capture(value(canonical(message)).bytes));
        f.append('next-inbound', json({ capture }));
      }
      return reader.read(request);
    },
    place: f.place,
  };
}
