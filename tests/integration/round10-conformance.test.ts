import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { bootProductionAssembly } from '../../src/assembly/index.js';
import { assemblyRuntimeFixture } from '../assembly/round8-extended-fixture.js';
import { installProduction, productionBindingSet, productionComposition } from '../assembly/production-fixture.js';
import { operatorFixture } from '../operator/fixture.js';
import { refused, value } from '../intake/fixtures.js';

const unavailableCases = [
  ['V65', 'run', 'open', 'RunGraphPort.open'],
  ['V66', 'run', 'ground', 'RunGraphPort.ground'],
  ['V67', 'judgment', 'readAnswer', 'JudgmentDoorway.readAnswer'],
  ['V68', 'effect', 'prepare', 'EffectDoorway.prepare'],
  ['V69', 'effect', 'settle', 'EffectDoorway.settle'],
  ['V70', 'verification', 'record', 'VerificationRuntimePort.record'],
  ['V71', 'verification', 'inspectCurrent', 'VerificationRuntimePort.inspectCurrent'],
  ['V72', 'verification', 'posture', 'VerificationRuntimePort.posture'],
] as const;

it('P11-NF-43 P11-NF-49 R10-F1 rereview8 V65-V72 assembly refuses each unavailable required method', () => {
  const f = assemblyRuntimeFixture(), binding = productionBindingSet(), installed = installProduction(f, binding);
  const production = productionComposition(f, binding);
  for (const [_id, role, method, expected] of unavailableCases) {
    const original = production[role].port[method as keyof typeof production[typeof role]['port']];
    (production[role].port as unknown as Record<string, unknown>)[method] = undefined;
    refused(bootProductionAssembly({ ...f.composition, production }, installed.manifest.id, binding.scope), expected);
    (production[role].port as unknown as Record<string, unknown>)[method] = original;
  }
});

it('P11-NF-05 P11-NF-14 R10-F2 rereview8 V90/V91 Part Four admission and Part Eleven rendering agree for empty and nonempty blocked work', () => {
  const empty = operatorFixture();
  const verified = empty.verifiedAct({ surface: 'phone-surface', request: { requestId: 'nothing-blocked', blockedWork: '' } });
  expect(value(empty.port().admitVerifiedAct(verified.input)).kind).toBe('approved');
  expect(value(empty.surface().render(verified.request.id)).blockedWork).toBe('');

  const nonempty = operatorFixture();
  expect(value(nonempty.surface().render(nonempty.request.id)).blockedWork).toBe('operator-authorized work');
});

it('P11-NF-13 R10-F3 rereview8 V92/V93 unavailable and available-unprotected broker posture both retain diagnosis', () => {
  const unavailable = operatorFixture();
  unavailable.composition.broker.posture = () => decode('Scope',
    { type: 'Scope', schemaVersion: 1, kind: 'project', members: [] }, unavailable.context.decode) as never;
  const uncertain = value(unavailable.surface().protection('op', '/policy'));
  expect(uncertain.posture).toBe('unprotected');
  expect(uncertain.uncertainty).toContain('broker-posture-unavailable:scope.members: empty or duplicate members');

  const available = operatorFixture();
  expect(value(available.surface().protection('op', '/policy')).posture).toBe('unprotected');
});
