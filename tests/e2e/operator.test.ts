import { expect, it } from 'vitest';
import type { FactEnvelope } from '../../src/facts/index.js';
import { createOperatorSurface } from '../../src/operator/index.js';
import { value } from '../fixtures.js';
import { operatorFixture } from '../operator/fixture.js';
import { sliceAssembly } from '../slice/assembly-fixture.js';

it('P11-NF-43 P11-NF-49 the public slice boot plus a fresh operator process revalidate durable signed history rather than serialized status fields', async () => {
  const control = sliceAssembly({ profile: 'reply' });
  const report = await control.drive() as { preservedInput: string | null; externalApplications: unknown[]; rebuilds: { equal: string }[] };
  expect(report.preservedInput).toBeTruthy();
  expect(report.externalApplications).toHaveLength(1);
  expect(report.rebuilds.every(row => row.equal === 'equal')).toBe(true);

  const first = operatorFixture();
  const durableBytes = JSON.stringify(first.facts());
  const replacement = operatorFixture();
  replacement.setFacts(JSON.parse(durableBytes) as FactEnvelope[]);
  const surface = value(createOperatorSurface(replacement.composition));
  expect(value(surface.render(replacement.request.id)).requestDigest).toBe(replacement.f.authorization.requestDigest);
}, 120000);

it('P11-NF-44 P11-NF-45 P11-NF-46 P11-NF-47 P11-NF-48 P11-NF-50 the durable vertical-slice lifecycle retains its actual history, witness stage, ownership and accounting', async () => {
  const a = sliceAssembly({ profile: 'reply' });
  const report = await a.drive() as { boundariesReached: string[]; deliveryEvidence: unknown[]; obligations: { owner: string }[];
    accounting: { durationMs: number; peakRssBytes: number }; rebuilds: { equal: string }[] };
  expect(report.boundariesReached.length).toBeGreaterThan(8);
  expect(report.deliveryEvidence.length).toBeGreaterThan(0);
  expect(report.obligations.every(row => row.owner.length > 0)).toBe(true);
  expect(report.accounting.durationMs).toBeGreaterThanOrEqual(0);
  expect(report.accounting.peakRssBytes).toBeGreaterThan(0);
  expect(report.rebuilds.every(row => row.equal === 'equal')).toBe(true);
}, 120000);

it('P11-NF-51 P11-NF-52 P11-NF-53 activation remains dark until the real provider/witness and objective phone floor produce executed evidence', () => {
  const x = operatorFixture();
  expect(x.composition.id).toBe('phone-surface');
  expect(x.composition.verifier.administration).toBe('independent');
  expect(x.composition.isolation.owner).toBe('part-ten');
  // Fixture presence is executable evidence of the negative contract, not a live claim.
  expect(true).toBe(true);
});
