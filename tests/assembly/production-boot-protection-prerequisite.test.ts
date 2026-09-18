// @ts-nocheck -- prerequisite diagnostic; this is not a production lifecycle positive.
import { expect, it } from 'vitest';
import { bootProductionAssembly } from '../../src/assembly/index.js';
import { createExternalProtectionBroker } from '../../src/verification/index.js';
import { groundedAssemblyRuntimeFixture, genuineProductionComposition, installProduction } from './genuine-production-fixture.js';
import { productionBindingSet } from './production-fixture.js';
import { value, refused } from '../facts/fixtures.js';

it('public boot refuses actual Nine unprotected posture; U4-C/U4-F peer and admission fixtures do not confer independent worker protection', () => {
  const f = groundedAssemblyRuntimeFixture();
  const binding = productionBindingSet();
  const production = genuineProductionComposition(f, binding);
  const installed = installProduction(f, binding);
  // No independently administered loader/enforcement receipt is installed.
  // These ports refuse mutation and report the absent protections, rather than
  // repeating the landed fixture's unconditional "protected" success value.
  const missing = () => { throw Error('independent protection backend unavailable'); };
  const broker = createExternalProtectionBroker({ ...f.host,
    current: () => ({ ...f.host.current(), decode: f.ctx.decode }) },
  { owner: 'part-ten', administration: 'independent', query: missing, transact: missing },
  { owner: 'part-ten', administration: 'independent', current: missing, install: missing,
    protection: path => f.success({ exactPath: path, parentWriteDenied: false,
      symlinkSwapDenied: false, alternateLoaderDenied: false, debuggerDenied: false, rootPinned: false }) });
  expect(value(broker.posture(binding.scope))).toBe('unprotected');
  expect(refused(bootProductionAssembly({ ...f.composition, production, independentProtection: broker },
    installed.manifest.id, binding.scope))).toBe('independent protection is not admitted');
});
