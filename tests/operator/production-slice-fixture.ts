// @ts-expect-error Executed assertion audit is ESM owner tooling.
import { groundingCheckpoint } from '../assembly/production-grounding-evidence.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AssemblyProductionBindingSet, AssemblyProductionComposition } from '../../src/assembly/index.js';
import type { ProbeRecord } from '../../src/verification/index.js';
import { decode } from '../../src/index.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { operatorFixture } from './fixture.js';
import { value } from '../facts/fixtures.js';
// @ts-expect-error Production section-7 assembly is an executable JavaScript boundary.
import { bootProductionSliceAssembly, prepareProductionSliceAssembly, sliceConfig } from '../../scripts/slice-assembly.mjs';

export function productionOperatorSlice(options: {
  home?: string;
} = {}) {
  const home = options.home ?? mkdtempSync(join(tmpdir(), 'p11-production-slice-'));
  const operator = operatorFixture({ directory: join(home, 'operator') });
  const unavailable = new Set<string>();
  const config = sliceConfig({ profile: 'reply' });
  const prepared = prepareProductionSliceAssembly(join(home, 'slice'), config, {
    beforeProjectionRead() {
      if (unavailable.size) throw Error(`signed required fact unavailable: ${[...unavailable].join(',')}`);
    },
    onContextEvent(event: { phase: string; operation?: string; fact?: string; digest?: string; generation?: string }) {
      if (event.phase === 'sample') groundingCheckpoint('current-read-sample', { generation: event.generation });
      if (event.phase === 'consumed-before-invoke') groundingCheckpoint('six-consumed-before-physical-invoke', event);
      if (event.phase === 'context-consumed') groundingCheckpoint('signed-ten-consumption', event);
    },
  });
  groundingCheckpoint('same-store-native-factory-graph', { scope: prepared.scope,
    sameStore: prepared.assembly.spine.store === prepared.slice.store });
  const raw = new Proxy([] as any[], { get(_target, key) {
    const current = prepared.slice.facts().filter((row: { id: string }) => !unavailable.has(row.id));
    if (key === 'splice') return (start: number, count: number) => {
      const removed = current.slice(start, start + count);
      for (const row of removed) unavailable.add(row.id);
      return removed;
    };
    const member = Reflect.get(current, key);
    return typeof member === 'function' ? member.bind(current) : member;
  } });
  const assembly = { composition: prepared.assembly, runtime: prepared.runtime, spine: prepared.spine,
    host: prepared.assembly.host, raw, context: prepared.slice.factContext,
    success: <T>(value: T) => prepared.slice.result(() => value) };
  const verification = verificationRuntimeFixture();
  const binding: AssemblyProductionBindingSet = prepared.binding;
  const installed = { binding, manifest: { id: prepared.manifest } };
  const fixtureComposition: AssemblyProductionComposition = prepared.assembly.production;
  let runtime: ReturnType<typeof bootProductionSliceAssembly> | null = null;
  const witness: AssemblyProductionComposition['deliveryWitness'] = {
    ...fixtureComposition.deliveryWitness,
    observe(operation) {
      const application = runtime?.service.journal().applications.find((row: { operation: string }) => row.operation === operation);
      if (!application) return decode('Scope', { type: 'Scope', schemaVersion: 1, kind: 'project', members: [] },
        operator.context.decode) as ReturnType<AssemblyProductionComposition['deliveryWitness']['observe']>;
      value(verification.runtime.record('VerificationPlan', verificationInput('VerificationPlan')));
      const probe = { ...verificationInput('ProbeRecord'), id: `delivery:${operation}`, operation,
        witnesses: [`evidence:${operation}`], comparison: `application:${application.messageId}` } as unknown as ProbeRecord;
      verification.setEvidence([verification.witnessFor(probe, `evidence:${operation}`)]);
      const recorded = value(verification.runtime.record('ProbeRecord', probe));
      return assembly.success({ owner: 'part-nine', administration: 'independent', operation,
        platform: binding.deliveryWitness.platform, stage: runtime!.declaredStage(), probe: recorded });
    },
  };
  const production: AssemblyProductionComposition = { ...fixtureComposition,
    surface: { ...operator.surface(), id: binding.surface.adapter.implementation },
    challengeVerifier: { id: binding.surface.challengeVerifier.implementation, port: operator.verifier },
    verifiedActIntake: { owner: 'part-four', id: binding.verifiedActIntake.implementation,
      operation: 'admitVerifiedAct', port: operator.composition.intake!.port as never },
    verification: { id: fixtureComposition.verification.id, port: verification.runtime },
    verificationClock: { owner: 'part-nine', administration: 'independent', id: 'verification:clock',
      current: () => assembly.success(verification.host.current().clock) },
    replay: { ...fixtureComposition.replay, rebuild: () => assembly.success(runtime!.rebuildAll()) },
    deliveryWitness: witness,
  };
  runtime = bootProductionSliceAssembly({ assembly: { ...assembly.composition, production }, manifest: installed.manifest.id,
    scope: binding.scope, prepared, home: join(home, 'slice'), config,
    authorizationRequest: operator.request.id });
  return { home, operator, assembly, verification, binding, installed, production, runtime };
}
