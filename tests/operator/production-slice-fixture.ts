import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import type { AssemblyProductionBindingSet, AssemblyProductionComposition } from '../../src/assembly/index.js';
import type { ProbeRecord } from '../../src/verification/index.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { installProduction, productionBindingSet, productionComposition } from '../assembly/production-fixture.js';
import { operatorFixture } from './fixture.js';
import { value } from '../facts/fixtures.js';
// @ts-expect-error Production section-7 assembly is an executable JavaScript boundary.
import { bootProductionSliceAssembly, sliceConfig } from '../../scripts/slice-assembly.mjs';

export function productionOperatorSlice(options: {
  home?: string;
  assemblyStorage?: (f: ReturnType<typeof import('../facts/fixtures.js').factsFixture>) => SegmentStoragePort;
} = {}) {
  const home = options.home ?? mkdtempSync(join(tmpdir(), 'p11-production-slice-'));
  const operator = operatorFixture({ directory: join(home, 'operator') });
  const assembly = assemblyRuntimeFixture(options.assemblyStorage);
  const verification = verificationRuntimeFixture();
  const binding: AssemblyProductionBindingSet = productionBindingSet();
  const installed = installProduction(assembly, binding);
  const fixtureComposition = productionComposition(assembly, binding);
  const witness: AssemblyProductionComposition['deliveryWitness'] = {
    ...fixtureComposition.deliveryWitness,
    observe(operation) {
      const probe = { ...verificationInput('ProbeRecord'), id: `delivery:${operation}`, operation } as ProbeRecord;
      verification.setEvidence([verification.witnessFor(probe, `evidence:${operation}`)]);
      const recorded = value(verification.runtime.record('ProbeRecord', probe));
      return assembly.success({ owner: 'part-nine', administration: 'independent', operation,
        platform: binding.deliveryWitness.platform, stage: 'application', probe: recorded });
    },
  };
  const production: AssemblyProductionComposition = { ...fixtureComposition,
    surface: { ...operator.surface(), id: binding.surface.adapter.implementation },
    challengeVerifier: { id: binding.surface.challengeVerifier.implementation, port: operator.verifier },
    verifiedActIntake: { owner: 'part-four', id: binding.verifiedActIntake.implementation,
      operation: 'admitVerifiedAct', port: operator.composition.intake!.port as never },
    verification: { id: fixtureComposition.verification.id, port: verification.runtime },
    deliveryWitness: witness,
  };
  const runtime = bootProductionSliceAssembly({ assembly: { ...assembly.composition, production }, manifest: installed.manifest.id,
    scope: binding.scope, home: join(home, 'slice'), config: sliceConfig({ profile: 'reply' }),
    authorizationRequest: operator.request.id });
  return { home, operator, assembly, verification, binding, installed, production, runtime };
}
