import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { value } from '../fixtures.js';
import { operatorFixture } from '../operator/fixture.js';
import { productionOperatorSlice } from '../operator/production-slice-fixture.js';
import { acrossExecutions } from '../slice/acceptance.js';
import type { SliceReport } from '../slice/acceptance.js';
import { loadPair } from '../slice/kill-schedule-artifacts.js';
import { runExecution } from '../slice/harness.js';

it('P11-NF-43 P11-NF-49 the public slice boot plus a fresh operator process revalidate durable signed history rather than serialized status fields', async () => {
  const control = productionOperatorSlice();
  const report = await control.runtime.drive() as { preservedInput: string | null; externalApplications: unknown[]; rebuilds: { equal: string }[];
    assemblyBoot: { owner: string; references: { completeness: string }[] }; authorityCompletion: { owner: string; disposition: string };
    independentlyWitnessedResult: { owner: string; administration: string; probe: { id: string } }; verificationRecords: string[] };
  expect(report.preservedInput).toBeTruthy();
  expect(report.externalApplications).toHaveLength(1);
  expect(report.rebuilds.every(row => row.equal === 'equal')).toBe(true);
  expect(report.assemblyBoot.owner).toBe('part-ten');
  expect(report.assemblyBoot.references.every(row => row.completeness === 'complete')).toBe(true);
  expect(report.authorityCompletion).toMatchObject({ owner: 'part-two', disposition: expect.any(String) });
  expect(report.independentlyWitnessedResult).toMatchObject({ owner: 'part-nine', administration: 'independent',
    probe: { id: expect.stringContaining('delivery:') } });
  expect(report.verificationRecords).toContain(report.independentlyWitnessedResult.probe.id);
}, 120000);

it('P11-NF-44 P11-NF-45 P11-NF-46 P11-NF-47 P11-NF-48 P11-NF-50 the durable vertical-slice lifecycle retains its actual history, witness stage, ownership and accounting', async () => {
  const a = productionOperatorSlice();
  const report = await a.runtime.drive() as { boundariesReached: string[]; deliveryEvidence: unknown[]; obligations: { owner: string }[];
    accounting: { durationMs: number; peakRssBytes: number }; rebuilds: { equal: string }[];
    assemblyBoot: { admission: string }; authorityCompletion: { disposition: string }; independentlyWitnessedResult: { stage: string } };
  expect(report.boundariesReached.length).toBeGreaterThan(8);
  expect(report.deliveryEvidence.length).toBeGreaterThan(0);
  expect(report.obligations.every(row => row.owner.length > 0)).toBe(true);
  expect(report.accounting.durationMs).toBeGreaterThanOrEqual(0);
  expect(report.accounting.peakRssBytes).toBeGreaterThan(0);
  expect(report.rebuilds.every(row => row.equal === 'equal')).toBe(true);
  expect(report.assemblyBoot.admission).toBe('admission:production');
  expect(report.authorityCompletion.disposition).toBeTruthy();
  expect(report.independentlyWitnessedResult.stage).toBe('application');
}, 120000);

it('P11-NF-43 P11-NF-44 P11-NF-47 P11-NF-49 a process cut between send and evidence recovers to the same independently witnessed semantic outcome', async () => {
  const pair = ['external-send', 'delivery-evidence'] as const;
  const cached = loadPair('reply', pair);
  const execution = cached ?? await runExecution({ profile: 'reply', cuts: pair, maxBoots: 12 });
  const recovered = 'report' in execution ? execution.report : execution;
  const boots = 'boots' in execution ? execution.boots : recovered.accounting.boots;
  expect(boots).toBeGreaterThanOrEqual(3);
  expect(recovered.externalApplications).toHaveLength(1);
  expect(recovered.rebuilds.every(row => row.equal === 'equal')).toBe(true);

  const production = productionOperatorSlice();
  const control = await production.runtime.drive() as SliceReport & { independentlyWitnessedResult: { operation: string } };
  expect(acrossExecutions(control, recovered)).toEqual([]);
  const operation = recovered.externalApplications[0]!.operation;
  const witnessed = value(production.runtime.coordinator.handles.deliveryWitness.observe(operation)) as { owner: string; administration: string; operation: string };
  expect(witnessed).toMatchObject({ owner: 'part-nine', administration: 'independent', operation });
  expect(control.independentlyWitnessedResult.operation).toBe(operation);
}, 240000);

it('P11-NF-51 P11-NF-52 P11-NF-53 activation remains dark until the real provider/witness and objective phone floor produce executed evidence', () => {
  const x = operatorFixture();
  const surface = x.surface();
  const protection = value(surface.protection('operation:activation', '/operator/phone'));
  expect(protection).toMatchObject({ posture: 'unprotected', witnessFresh: false, isolationLive: false });
  expect(protection.brokerReceipt).toBeNull();
  const declarations = [...JSON.parse(readFileSync('src/operator/operator.declarations.json', 'utf8')),
    ...JSON.parse(readFileSync('src/operator/surface.declarations.json', 'utf8'))] as
    { id: string; status: string; requiredFacts: Record<string, unknown>; holds: unknown[] }[];
  const source = declarations.find(row => row.id === 'operator-surfaces.source');
  const phone = declarations.find(row => row.id === 'phone-surface');
  expect(source).toMatchObject({ status: 'dark', holds: [] });
  expect(phone).toMatchObject({ status: 'dark', holds: [] });
  expect(source?.requiredFacts).not.toHaveProperty('liveProof');
  expect(phone?.requiredFacts).not.toHaveProperty('liveProof');
  expect(Object.keys(surface)).not.toContain('activate');
});
