import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { bootProductionAssembly } from '../../src/assembly/index.js';
import { assemblyRuntimeFixture } from '../assembly/round8-extended-fixture.js';
import { installProduction, productionComposition } from '../assembly/production-fixture.js';
import { operatorFixture } from '../operator/fixture.js';
import { refused, value } from '../intake/fixtures.js';
// @ts-expect-error The physical file adapter is an executable JavaScript boundary.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';

it('P11-NF-43 P11-NF-49 R10-F1 public production boot refuses a missing required method against durable storage', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p11-r10-production-'));
  const f = assemblyRuntimeFixture(runtime => createTransportFileStorage(directory, <T>(run: () => T) => runtime.success(run())));
  const installed = installProduction(f), production = productionComposition(f, installed.binding);
  production.run.port.open = undefined as never;
  refused(bootProductionAssembly({ ...f.composition, production }, installed.manifest.id, installed.binding.scope), 'RunGraphPort.open');
});

it('P11-NF-05 P11-NF-14 R10-F2 phone flow keeps an empty present blocked-work field through owner admission and rendering', () => {
  const f = operatorFixture();
  const verified = f.verifiedAct({ surface: 'phone-surface', request: { requestId: 'nothing-blocked', blockedWork: '' } });
  expect(value(f.port().admitVerifiedAct(verified.input)).kind).toBe('approved');
  expect(value(f.surface().render(verified.request.id)).blockedWork).toBe('');
});

it('P11-NF-13 R10-F3 broker-posture refusal leaves the read-only diagnostic surface reachable and explicitly unprotected', () => {
  const f = operatorFixture();
  f.composition.broker.posture = () => decode('Scope',
    { type: 'Scope', schemaVersion: 1, kind: 'project', members: [] }, f.context.decode) as never;
  const view = value(f.surface().protection('op', '/policy'));
  expect(view.posture).toBe('unprotected');
  expect(view.uncertainty).toContain('broker-posture-unavailable:scope.members: empty or duplicate members');
  expect(value(f.surface().render(f.request.id)).requestId).toBe('request:1');
});
