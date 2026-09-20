import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { installedRunGovernanceSchemas, loadInstalledRunGovernance, recordInstalledRunGovernanceReference,
  registerInstalledRunGovernanceBody } from '../../src/rungraph/installed-governance.js';
import { fixedRecordFixture } from '../assembly/fixed-installation-contract.test.js';
import { json, refused, value } from '../facts/fixtures.js';

function governanceFixture() {
  const f = fixedRecordFixture(({ generation }) => {
    const fields = { type: 'InstalledRunGovernanceReference', schemaVersion: 1, installation: 'host', scope: 'project-a', generation,
      contract: 'rungraph.contract', feature: 'rungraph-core', bound: 'rungraph.bound', capture: 'part-two:run-input',
      gates: [['rungraph.admit', 'decodeRun'], ['rungraph.exit', 'decodeRunExit'], ['rungraph.grounding', 'decodeSessionGrounding'],
        ['rungraph.step', 'decodeRunStep'], ['rungraph.stop', 'decodeRunTransition'], ['rungraph.transition', 'decodeRunTransition']]
        .map(([id, decoder]) => ({ id, decoder })),
      groundingPolicy: { entry: 'rungraph.bound', threshold: 10, maxAge: 50, briefingClasses: ['message'] } };
    return [json({ ...fields, id: value(canonical(fields)).hash })];
  });
  Object.assign(f.f.context, { schemas: [...f.f.context.schemas, ...installedRunGovernanceSchemas(f.f.f.scope)],
    ownedBodies: [...f.f.context.ownedBodies!, value(registerInstalledRunGovernanceBody(f.admission))] });
  return f;
}

describe('P10-SI-10/23 Five installed governance', () => {
  it('records approved immutable references once and builds the existing runtime governance', () => {
    const f = governanceFixture(), record = f.records[0];
    const fact = value(recordInstalledRunGovernanceReference(record, f.writer)), count = f.f.frames.length;
    expect(value(recordInstalledRunGovernanceReference(record, f.writer))).toEqual(fact);
    expect(f.f.frames.length).toBe(count);
    const capture = { owner: 'part-two' as const, preserve: () => f.f.f.success('fixture-admitted:capture') };
    const result = value(loadInstalledRunGovernance(record, f.admission.generation.register, f.admission.generation.context,
      capture, { fact, facts: { ...f.f.context, facts: f.f.facts() }, admission: f.admission }));
    expect(result.capture).toBe(capture);
    refused(loadInstalledRunGovernance(record, { ...result.register } as typeof result.register, result.context, capture,
      { fact, facts: { ...f.f.context, facts: f.f.facts() }, admission: f.admission }), 'register consumer');
  });
  it('refuses missing gate, wrong decoder, serialized callback and mutable policy', () => {
    const f = governanceFixture(), record = f.records[0] as Record<string, unknown>, count = f.f.frames.length;
    const gates = record.gates as { id: string; decoder: string }[];
    for (const changed of [
      { ...record, gates: gates.slice(1) }, { ...record, gates: gates.map((gate, i) => i ? gate : { ...gate, decoder: 'decodeOther' }) },
      { ...record, capture: () => 'serialized callback' },
      { ...record, groundingPolicy: { ...(record.groundingPolicy as object), threshold: 11 } },
    ]) refused(recordInstalledRunGovernanceReference(changed, f.writer));
    expect(f.f.frames.length).toBe(count);
  });
});
