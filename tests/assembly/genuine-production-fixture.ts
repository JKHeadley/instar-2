// @ts-nocheck -- shared genuine factory composition under GRANT 45-B.
import { groundingCheckpoint } from './production-grounding-evidence.mjs';
import { createProductionGroundingReader } from '../../src/assembly/index.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import { productionComposition } from './production-fixture.js';
import { value } from '../facts/fixtures.js';
import { createLiveInputAssemblyFixture } from './live-input-owner-fixture.js';
export const groundedAssemblyRuntimeFixture = createLiveInputAssemblyFixture;
export function genuineProductionComposition(f, binding, options = {}) {
  // This method supplies owner-admitted runtime/native harness/history over the
  // requested spine, including a real sample->Eight/Six confined execution path.
  const p = f.groundingFor({ spine: options.spine ?? f.spine, scope: binding.scope });
  const reader = createProductionGroundingReader({ scope: binding.scope,
    runtime: p.runtime, harness: p.harness, context: p.context,
    clock: p.clock, sample: p.sample });
  const graph = value(createRunGraph({ ...p.graphDependencies,
    store: p.spine.store, assemblyHistory: p.history, grounding: reader }));
  // Same harness exposed to boot, and same store and source scope as graph/read.
  // Final product provenance must be owner issued and checked at boot; these
  // object-identity checks alone are not that authority.
  if (p.spine !== (options.spine ?? f.spine)
      || !f.composition.harnesses.includes(p.harness)) throw Error('fixture owner composition mismatch');
  groundingCheckpoint('same-store-native-factory-graph', { scope: binding.scope, sameStore: p.spine.store === (options.spine ?? f.spine).store });
  const base = productionComposition(f, binding);
  return { ...base, run: { ...base.run, port: graph } };
}

import { installProduction as installExistingProduction, productionBindingSet } from './production-fixture.js';
/** GRANT 45-B: keep the roster; point its lease reference at the real Six fact. */
export function installProduction(f, binding = productionBindingSet(), options = {}) {
  if (f.effects) binding.dependencies = binding.dependencies.map(row => row.name === 'lease'
    ? { ...row, fact: { ...row.fact, reference: f.effects.leaseFact.id } } : row);
  return installExistingProduction(f, binding, options);
}
