import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, expect, it } from 'vitest';
import { value } from '../fixtures.js';
import { operatorFixture } from '../operator/fixture.js';
import { productionOperatorSlice } from '../operator/production-slice-fixture.js';
import { runExecution } from '../slice/harness.js';
import { consumeResult } from '../../src/index.js';
// @ts-expect-error executable acceptance harness is JavaScript by design.
import { bootProductionSliceAssembly, sliceConfig } from '../../scripts/slice-assembly.mjs';

// Vitest batches task updates without awaiting their RPC acknowledgements. Each of the
// first three tests below enters another ~22s synchronous production drive immediately;
// without one event-loop turn between tests, the already-sent acknowledgement cannot be
// received before Vitest 3's fixed 60s RPC deadline even though every assertion passes.
beforeEach(() => new Promise<void>(resolve => setImmediate(resolve)));

it('P11-V27 the production delivery witness refuses before the real platform port has observed that operation', () => {
  const x = productionOperatorSlice();
  const observed = consumeResult(x.runtime.coordinator.handles.deliveryWitness.observe('operation:never-submitted'), {
    Success: () => 'accepted', Refused: () => 'refused',
  });
  expect(observed).toBe('refused');
  expect(x.runtime.service.journal().applications).toEqual([]);
  expect(value(x.verification.runtime.inspectCurrent())).toEqual([]);
});

it('P11-V28 the production wrapper refuses a provider result not witnessed for the operation it actually drove', async () => {
  const x = productionOperatorSlice();
  x.production.deliveryWitness.observe = (() => x.assembly.success({ owner: 'part-nine', administration: 'independent',
    operation: 'operation:wrong', platform: 'wrong-platform', stage: 'human-read', probe: { id: 'probe:absent' } })) as never;
  await expect(x.runtime.drive()).rejects.toThrow('unwitnessed');
}, 120000);

it('P11-V44 R1 rereview5 V36 displays the resolved Part Nine probe rather than a provider-mutated matching-id copy', async () => {
  const x = productionOperatorSlice(); const original = x.production.deliveryWitness.observe;
  x.production.deliveryWitness.observe = (operation => {
    const witnessed = value(original(operation)) as { probe: { comparison: string } };
    return x.assembly.success({ ...witnessed, probe: { ...witnessed.probe, comparison: 'CALLER-SUPPLIED-DISPLAY-TEXT' } });
  }) as typeof original;
  const report = await x.runtime.drive() as { independentlyWitnessedResult: { probe: { comparison: string } } };
  expect(report.independentlyWitnessedResult.probe.comparison).toBe('application:service-message:1');
}, 120000);

it('R7-F2 rereview5 V35/V51 refuses an independently witnessed result when the selected stored probe loses its current evidence', async () => {
  const x = productionOperatorSlice(); const original = x.production.deliveryWitness.observe;
  x.production.deliveryWitness.observe = (operation => {
    const witnessed = original(operation);
    x.verification.setEvidence([]);
    return witnessed;
  }) as typeof original;
  await expect(x.runtime.drive()).rejects.toThrow('unwitnessed');
  expect(x.runtime.service.journal().applications).toHaveLength(1);
  expect(value(x.verification.runtime.inspectCurrent()).some(row => row.record.type === 'ProbeRecord')).toBe(true);
}, 120000);

it('R7-F2 rereview5 V37 refuses a witnessed callback whose stage is stronger than the admitted adapter stage', async () => {
  const x = productionOperatorSlice(); const original = x.production.deliveryWitness.observe;
  x.production.deliveryWitness.observe = (operation => {
    const witnessed = value(original(operation)) as Record<string, unknown>;
    return x.assembly.success({ ...witnessed, stage: 'human-read' });
  }) as typeof original;
  await expect(x.runtime.drive()).rejects.toThrow('unwitnessed');
}, 120000);

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
  expect(report.independentlyWitnessedResult.stage).toBe('service-applied');
}, 120000);

it('P11-NF-43 P11-NF-44 P11-NF-47 P11-NF-49 rereview5 V38 a process cut between send and evidence recovers to the same independently witnessed semantic outcome', async () => {
  const pair = ['external-send', 'delivery-evidence'] as const;
  const execution = await runExecution({ profile: 'reply', cuts: pair, maxBoots: 12 });
  const recovered = execution.report as typeof execution.report & {
    authorityCompletion: { owner: string; disposition: string };
    independentlyWitnessedResult: { owner: string; administration: string; operation: string; probe: { id: string } };
    verificationRecords: string[];
  };
  const boots = execution.boots;
  expect(boots).toBeGreaterThanOrEqual(3);
  expect(recovered.externalApplications).toHaveLength(1);
  expect(recovered.rebuilds.every(row => row.equal === 'equal')).toBe(true);
  const operation = recovered.externalApplications[0]!.operation;
  expect(recovered.authorityCompletion).toMatchObject({ owner: 'part-two', disposition: expect.any(String) });
  expect(recovered.independentlyWitnessedResult).toMatchObject({ owner: 'part-nine', administration: 'independent', operation });
  expect(recovered.verificationRecords).toContain(recovered.independentlyWitnessedResult.probe.id);
}, 240000);

it('P11-V49 R3 restart composition retains existing owner schemas and signed owner bodies', () => {
  const runtime = bootProductionSliceAssembly({ home: mkdtempSync(join(tmpdir(), 'p11-owner-schema-')),
    config: sliceConfig({ profile: 'reply' }), restartRecovery: true });
  type Reference = { name: string; fact: { kind: string; body: Record<string, unknown> } };
  type Schema = { kind: string; fields: Record<string, unknown> };
  const references = runtime.coordinator.references as Reference[];
  const schemas = runtime.factContext.schemas as Schema[];
  const lease = references.find(row => row.name === 'dependency:lease')!;
  const conversation = references.find(row => row.name === 'dependency:conversation-binding')!;
  expect(lease.fact.kind).toBe('transport-Lease');
  expect(Object.keys(lease.fact.body)).toEqual(['record']);
  expect(Object.keys(schemas.find(schema => schema.kind === 'transport-Lease')!.fields)).toEqual(['record']);
  expect(conversation.fact.kind).toBe('conversation-binding');
  expect(Object.keys(conversation.fact.body).sort()).toEqual([
    'adapter', 'channel', 'grantId', 'identityEpoch', 'principalId', 'scope', 'sender', 'supersedes',
  ]);
  expect(Object.keys(schemas.find(schema => schema.kind === 'conversation-binding')!.fields).sort())
    .toEqual(Object.keys(conversation.fact.body).sort());
}, 120000);

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
