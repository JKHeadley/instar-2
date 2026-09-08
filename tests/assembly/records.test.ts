import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { assemblyIdentity, assemblyKindFor, assemblyRecordFrom, assemblyRows, assemblyShapes, compareAssemblyRecords, decodeAssemblyRecord } from '../../src/assembly/index.js';
import type { AssemblyRecordName } from '../../src/assembly/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { assemblyInput, assemblyInputs } from './fixture.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { decodeEnvelope } from '../../src/facts/index.js';

const names = Object.keys(assemblyInputs) as AssemblyRecordName[];
const value = <T>(result: import('../../src/index.js').Result<T>): T => consumeResult(result, { Success: value => value, Refused: refusal => { throw new Error(refusal.detail); } });
const refused = <T>(result: import('../../src/index.js').Result<T>, detail: string) => consumeResult(result, { Success: () => { throw new Error('expected refusal'); }, Refused: refusal => { expect(refusal.detail).toContain(detail); return refusal; } });

it('P10-NF-01 P10-NF-02 exposes twelve closed stored payloads and leaves three ports as interfaces', () => {
  const context = factsFixture().c; expect(names).toHaveLength(12); expect(Object.keys(assemblyShapes)).toEqual(names);
  for (const name of names) {
    const decoded = value(decodeAssemblyRecord(name, assemblyInput(name), context)); expect(decoded.type).toBe(name); expect(Object.isFrozen(decoded)).toBe(true);
    refused(decodeAssemblyRecord(name, { ...assemblyInput(name), surprise: true }, context), 'undeclared field');
    refused(decodeAssemblyRecord(name, { ...assemblyInput(name), schemaVersion: 2 }, context), 'schema version unknown');
  }
});

it('P10-NF-05 P10-NF-07 immutable identity is canonical only after total decoding', () => {
  const context = factsFixture().c; const row = assemblyInput('AssemblyManifest'); const decoded = value(decodeAssemblyRecord('AssemblyManifest', JSON.parse(JSON.stringify(row)), context));
  expect(assemblyIdentity(decoded).canonicalHash).toBe(value(canonical(decoded)).hash);
  const changed = { ...row, generation: 'candidate-self-report' }; const compared = value(compareAssemblyRecords('AssemblyManifest', row, changed, context));
  expect(compared).toMatchObject({ equal: false, conflict: { kind: 'immutable-disagreement' } });
});

it('P10-NF-10 P10-NF-11 P10-NF-13 P10-NF-14 launch and consumption unions cannot fabricate grounding', () => {
  const context = factsFixture().c; const launch = assemblyInput('HarnessLaunchSpec');
  refused(decodeAssemblyRecord('HarnessLaunchSpec', { ...launch, consumptionMode: 'stdin' }, context), 'consumption mode');
  const observed = assemblyInput('HarnessObservation');
  refused(decodeAssemblyRecord('HarnessObservation', { ...observed, boundaryEvidence: '' }, context), 'boundary evidence');
  expect(value(decodeAssemblyRecord('HarnessObservation', { ...observed, phase: 'input-accepted', boundaryEvidence: '' }, context)).phase).toBe('input-accepted');
});

it('P10-NF-15 P10-NF-22 P10-NF-23 P10-NF-24 P10-NF-53 adapter evidence is exhaustive and unsupported means explicit', () => {
  const context = factsFixture().c; const contract = assemblyInput('AdapterEvidenceContract');
  refused(decodeAssemblyRecord('AdapterEvidenceContract', { ...contract, capabilities: contract.capabilities.slice(1) }, context), 'complete adapter capability matrix');
  refused(decodeAssemblyRecord('AdapterEvidenceContract', { ...contract, ackPolicy: 'public-always' }, context), 'ack policy');
  const unsupported = { ...contract, capabilities: contract.capabilities.map((row, index) => index === 0 ? { ...row, support: 'unsupported', source: '', predicate: '', subjectBinding: '', horizon: '', conformance: '', reason: 'provider has no stable lookup' } : row) };
  expect(value(decodeAssemblyRecord('AdapterEvidenceContract', unsupported, context)).capabilities[0]!.support).toBe('unsupported');
});

it('P10-NF-25 P10-NF-27 P10-NF-31 P10-NF-34 P10-NF-37 P10-NF-39 activation evidence and custody policies fail closed', () => {
  const context = factsFixture().c; const conformance = assemblyInput('AdapterConformance');
  refused(decodeAssemblyRecord('AdapterConformance', { ...conformance, stageChecks: [] }, context), 'both neighbors');
  const policy = assemblyInput('StoreCustodyPolicy');
  refused(decodeAssemblyRecord('StoreCustodyPolicy', { ...policy, encryption: { ...policy.encryption, suite: 'plaintext' } }, context), 'AES-256-GCM');
  refused(decodeAssemblyRecord('StoreCustodyPolicy', { ...policy, recoveryCustody: '' }, context), 'complete store custody');
});

it('P10-NF-41 P10-NF-44 local packages reject traversal and require all test tiers', () => {
  const context = factsFixture().c; const pkg = assemblyInput('LocalCapabilityPackage');
  refused(decodeAssemblyRecord('LocalCapabilityPackage', { ...pkg, entrypoints: [{ ...pkg.entrypoints[0]!, path: '../escape.js' }] }, context), 'escapes staging');
  refused(decodeAssemblyRecord('LocalCapabilityPackage', { ...pkg, checks: { ...pkg.checks, lifecycle: [] } }, context), 'three test tiers');
});

it('P10-NF-30 P10-NF-43 package transitions use a closed causal lifecycle', () => {
  const context = factsFixture().c; const transition = assemblyInput('PackageTransition');
  refused(decodeAssemblyRecord('PackageTransition', { ...transition, from: 'staged', to: 'active' }, context), 'lifecycle edge');
  refused(decodeAssemblyRecord('PackageTransition', { ...transition, probeEvidence: [] }, context), 'observed switch');
});

it('P10-NF-46 P10-NF-47 P10-NF-48 P10-NF-49 P10-NF-50 growth keeps the full denominator and zero as a real bound', () => {
  const context = factsFixture().c; const policy = assemblyInput('GrowthPolicy');
  refused(decodeAssemblyRecord('GrowthPolicy', { ...policy, subjects: policy.subjects.slice(1) }, context), 'subject roster');
  expect(value(decodeAssemblyRecord('GrowthPolicy', { ...policy, notificationBudget: 0 }, context)).notificationBudget).toBe(0);
  const observation = assemblyInput('GrowthObservation');
  refused(decodeAssemblyRecord('GrowthObservation', { ...observation, denominator: 2 }, context), 'complete sample cannot omit');
  refused(decodeAssemblyRecord('GrowthObservation', { ...observation, completion: 'incomplete' }, context), 'retained omission');
});

it('repair1 V3-V120 decoders require substantive identifiers and resolve signed semantic references when history is available', () => {
  const context = factsFixture().c;
  for (const name of names) refused(decodeAssemblyRecord(name, { ...assemblyInput(name), id: ' \t ' }, context), 'substantive');
  refused(decodeAssemblyRecord('AssemblyAdmission', { ...assemblyInput('AssemblyAdmission'), manifest: '  ' }, context), 'substantive');
  refused(decodeAssemblyRecord('AdapterConformance', { ...assemblyInput('AdapterConformance'), stageChecks: [{ stage: 'context', checkRun: 'check:1', positive: [''], negative: ['  '] }] }, context), 'substantive');

  const f = assemblyRuntimeFixture();
  const partial = value(f.runtime.record('GrowthObservation', { ...assemblyInput('GrowthObservation'), id: 'partial', completion: 'incomplete', sampleCount: 0, timeouts: 1 }));
  const fact = value(f.runtime.inspect()).find(row => row.record.id === partial.id)!.fact;
  refused(decodeAssemblyRecord('AssemblyManifest', { ...assemblyInput('AssemblyManifest'), custodyPolicies: ['machine-z:0:999'] }, f.c), 'missing from signed history');
  refused(decodeAssemblyRecord('AssemblyManifest', { ...assemblyInput('AssemblyManifest'), custodyPolicies: [fact.id] }, f.c), 'wrong signed record kind');
  expect(value(decodeAssemblyRecord('AssemblyManifest', { ...assemblyInput('AssemblyManifest'), dependencyFacts: [fact.id] }, f.c)).dependencyFacts).toEqual([fact.id]);
});

it('repair1 V121-V168 direct readers independently verify signed envelope kind, origin, and bytes', () => {
  const f = assemblyRuntimeFixture(); const row = value(f.runtime.record('AssemblyManifest', assemblyInput('AssemblyManifest')));
  const fact = value(f.runtime.inspect()).find(candidate => candidate.record.id === row.id)!.fact;
  expect(() => assemblyRecordFrom({ ...fact, body: { record: { ...assemblyInput('AssemblyManifest'), id: 'changed' } } } as typeof fact, f.c)).toThrow(/content hash/);
  const cross = value(decodeEnvelope(f.wire({ kind: assemblyKindFor('GrowthObservation'), body: { record: assemblyInput('AssemblyManifest') } }, f.context), f.context));
  expect(() => assemblyRows([cross], f.c)).toThrow(/kind mismatch/);
});

it('repair1 V204 numeric measurement labels cannot override their measured threshold relation', () => {
  const observation = assemblyInput('GrowthObservation');
  refused(decodeAssemblyRecord('GrowthObservation', { ...observation, comparisons: [{ ...observation.comparisons[0]!, value: 50, result: 'within' }] }, factsFixture().c), 'disagrees');
});
