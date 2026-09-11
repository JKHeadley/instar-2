import { expect, it } from 'vitest';
import { bootProductionAssembly } from '../../src/assembly/index.js';
import { refused, value } from '../facts/fixtures.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { installProduction, productionBindingSet, productionComposition } from './production-fixture.js';

const requiredMethods = [
  ['run', 'open', 'RunGraphPort.open'],
  ['run', 'read', 'RunGraphPort.read'],
  ['run', 'ground', 'RunGraphPort.ground'],
  ['run', 'transition', 'RunGraphPort.transition'],
  ['run', 'readExit', 'RunGraphPort.readExit'],
  ['lease', 'inspect', 'TransportAuthority.inspect'],
  ['lease', 'acquire', 'TransportAuthority.acquire'],
  ['lease', 'renew', 'TransportAuthority.renew'],
  ['lease', 'release', 'TransportAuthority.release'],
  ['lease', 'admitWrite', 'TransportAuthority.admitWrite'],
  ['lease', 'schedule', 'TransportAuthority.schedule'],
  ['lease', 'reserve', 'TransportAuthority.reserve'],
  ['lease', 'claim', 'TransportAuthority.claim'],
  ['lease', 'consume', 'TransportAuthority.consume'],
  ['lease', 'recover', 'TransportAuthority.recover'],
  ['lease', 'close', 'TransportAuthority.close'],
  ['lease', 'settle', 'TransportAuthority.settle'],
  ['judgment', 'judge', 'JudgmentDoorway.judge'],
  ['judgment', 'resumeRecording', 'JudgmentDoorway.resumeRecording'],
  ['judgment', 'readAnswer', 'JudgmentDoorway.readAnswer'],
  ['judgment', 'inspect', 'JudgmentDoorway.inspect'],
  ['effect', 'prepare', 'EffectDoorway.prepare'],
  ['effect', 'dispatch', 'EffectDoorway.dispatch'],
  ['effect', 'handoff', 'EffectDoorway.handoff'],
  ['effect', 'observe', 'EffectDoorway.observe'],
  ['effect', 'settle', 'EffectDoorway.settle'],
  ['effect', 'inspect', 'EffectDoorway.inspect'],
  ['verification', 'record', 'VerificationRuntimePort.record'],
  ['verification', 'inspect', 'VerificationRuntimePort.inspect'],
  ['verification', 'inspectCurrent', 'VerificationRuntimePort.inspectCurrent'],
  ['verification', 'due', 'VerificationRuntimePort.due'],
  ['verification', 'posture', 'VerificationRuntimePort.posture'],
] as const;

it('P11-NF-43 P11-NF-49 R10-F1 every required production method must be callable before boot returns a coordinator', () => {
  const f = assemblyRuntimeFixture(), binding = productionBindingSet(), installed = installProduction(f, binding);
  const production = productionComposition(f, binding);
  for (const [role, method, expected] of requiredMethods) {
    const original = production[role].port[method as keyof typeof production[typeof role]['port']];
    (production[role].port as unknown as Record<string, unknown>)[method] = undefined;
    refused(bootProductionAssembly({ ...f.composition, production }, installed.manifest.id, binding.scope), expected);
    (production[role].port as unknown as Record<string, unknown>)[method] = original;
  }
}, 30_000);

it('P11-NF-43 P11-NF-49 R10-F1 V49 complete required production ports still return the active coordinator', () => {
  const f = assemblyRuntimeFixture(), binding = productionBindingSet(), installed = installProduction(f, binding);
  const production = productionComposition(f, binding);
  expect(value(bootProductionAssembly({ ...f.composition, production }, installed.manifest.id, binding.scope)).owner).toBe('part-ten');
});
