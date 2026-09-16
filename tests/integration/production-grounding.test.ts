import { expect, it } from 'vitest';
import { createRunGraph } from '../../src/rungraph/index.js';
import { refused, setup, value } from '../rungraph/fixtures.js';
import { paired } from '../rungraph/astra-production-grounding-fixture.js';
import { bootProductionAssembly } from '../../src/assembly/index.js';
import { assemblyRuntimeFixture } from '../assembly/round8-extended-fixture.js';
import { installProduction, productionBindingSet, productionComposition } from '../assembly/production-fixture.js';

it('PG-INTEGRATION-PRODUCTION-BINDING refuses a history-labelled graph until the invocation-owned Ten reader is bound', () => {
  const f = setup();
  expect(value(createRunGraph(f.deps)).owner).toBe('part-five');
  refused(createRunGraph({ ...f.deps, grounding: { ...f.deps.grounding, production: true } }),
    'production grounding requires public Ten assembly history');
  const history = { owner: 'part-ten' as const, current: () => f.success([]), lookup: () => f.success(null),
    resolve: () => f.success({ admitted: true, completeness: 'complete' as const, facts: [], conflicts: [], missing: [] }) };
  refused(createRunGraph({ ...f.deps, grounding: { ...f.deps.grounding, production: true }, assemblyHistory: history }),
    'invocation-bound Ten delivery reader');
  const bound = paired();
  expect(value(bound.graph.ground(bound.id, 'w', 'h', 'start', bound.lease)).kind).toBe('session-grounding');
});

it('PG-INTEGRATION-PRODUCTION-BINDING admits the signed row-45 binding only with a production-grounded graph', () => {
  const f = assemblyRuntimeFixture();
  const binding = { ...productionBindingSet(), productionGrounding: { implementation: 'context-delivery-v1' as const } };
  const installed = installProduction(f, binding), base = productionComposition(f, installed.binding), graph = paired().graph;
  const production = { ...base, productionGrounding: { owner: 'part-ten' as const, implementation: 'context-delivery-v1' as const },
    run: { ...base.run, port: graph } };
  expect(value(bootProductionAssembly({ ...f.composition, production }, installed.manifest.id, installed.binding.scope)).owner)
    .toBe('part-ten');
});
