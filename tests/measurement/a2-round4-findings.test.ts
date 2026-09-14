import { describe, expect, it } from 'vitest';
import {
  bindCurrentMeasurementReadSource, measurementProjectionDefinition,
  renderCurrentMeasurementRead,
} from '../../src/measurement/index.js';
import { value } from '../facts/fixtures.js';
import { measurementA2Fixture } from './a2-fixture.js';
import { closureCases } from './a2-round4-review/closure.js';
import { edgeCases } from './a2-round4-review/edge-cases.js';
import { verifyCases } from './a2-round4-review/verify.js';

const cases = [...verifyCases, ...edgeCases, ...closureCases] as Array<{
  name: string; pass: boolean;
}>;

function passed(names: readonly string[]): void {
  for (const name of names)
    expect(cases.find(candidate => candidate.name === name), name).toMatchObject({ pass: true });
}

describe('Part 16 A2 round-four finding closure', () => {
  it('F1 uses Part Two repair history for reads, peers, restored facts, notes, and attribution', () => {
    passed(['retraction:read-current-source', 'retraction:peer-current-source',
      'unrelated-note:target-field-must-not-suppress-observation',
      'restored-retraction:current-read-accepts-restored-point',
      'attribution:retracted-resolution-no-longer-attributes']);
  });

  it('F2 keeps sample time in every sampled-family identity', () => {
    passed(['sample-clock:cumulative-model-session-successive-points-not-same-quantity',
      'sample-clock:cumulative-model-session-read-retains-both-source-times',
      'sample-clock:quota-successive-points-not-same-quantity',
      'sample-clock:quota-read-retains-both-source-times',
      'sample-clock:package-cost-successive-points-not-same-quantity',
      'sample-clock:package-cost-read-retains-both-source-times']);
  });

  it('F3 selects current signed resolutions without caller hints in resolve and burn', () => {
    passed(['resolution:signed-history-selected-without-caller-hint',
      'resolution:burn-re-resolves-owner-resolution-at-use']);
  });

  it('F4 quarantines an incomparable peer clock while retaining local data', () => {
    passed(['peer:incomparable-clock-keeps-local-partial']);
  });

  it('F5 does not let a relabeled local history discharge a required peer', () => {
    passed(['peer:relabel-history-as-required-peer-needs-owner-binding']);
  });

  it('F6 records each reserved owner arm with its exact dependency', async () => {
    // @ts-expect-error Repository contract checker is intentionally JavaScript.
    const { p16A2Dispositions } = await import('../../scripts/check-p16-contract-map.mjs');
    const rows = p16A2Dispositions() as Array<{
      number: number; status: string; dependencies: string[];
    }>;
    for (const number of [4, 14, 16, 36]) {
      const row = rows.find(candidate => candidate.number === number)!;
      expect(row.status).toMatch(/^MIXED-EXECUTABLE-A2-PLUS-NON-EXECUTABLE-UNTIL-/);
      expect(row.dependencies.length).toBeGreaterThan(0);
    }
    expect(rows.find(row => row.number === 38)).toMatchObject({
      status: 'NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge',
      dependencies: ['slice-A2b-peer-merge'],
    });
    expect(rows.find(row => row.number === 36)?.dependencies)
      .toContain('seam-response-declarations.md #11');
  });

  it('F7 refuses all 13 malformed borrowed-descriptor mutations', () => {
    const f = measurementA2Fixture();
    const observation = f.planObservation({ subject: 'binding:round4',
      sourceEvent: 'binding:round4:e', amount: 4, at: 100 });
    f.persistObservation(observation);
    const sourceHistory = f.snapshot();
    const last = value(f.store.read()).at(-1)!;
    const sourceGeneration = { reference: f.c.register.generation,
      kinds: ['measurement-observation'],
      lineages: { 'machine-a': { head: last.segment, observedAt: null, closed: true } } };
    const sourceDefinition = value(measurementProjectionDefinition(sourceGeneration, {
      'measurement-observation': { identity: 'identity', value: 'measurement', merge: 'set-union' },
    }, f.c));
    const binding = value(bindCurrentMeasurementReadSource({ sourceHistory,
      sourceDefinition, sourceGeneration }, f.c));
    const baseRead = { sourceHistory, sourceDefinition, sourceGeneration,
      query: f.readQuery(binding), producers: [f.producer], attributions: [], timedOut: false };
    const decision = sourceDefinition.decisions['measurement-observation']!;
    const lineage = sourceGeneration.lineages['machine-a'];
    const mutations: Array<readonly [string, () => unknown]> = [
      ['historical definition extra', () => renderCurrentMeasurementRead({ ...baseRead,
        sourceDefinition: { ...sourceDefinition, unexpected: true } } as never, f.c)],
      ['historical decision extra', () => renderCurrentMeasurementRead({ ...baseRead,
        sourceDefinition: { ...sourceDefinition, decisions: { ...sourceDefinition.decisions,
          'measurement-observation': { ...decision, unexpected: true } } } } as never, f.c)],
      ['historical generation extra', () => renderCurrentMeasurementRead({ ...baseRead,
        sourceGeneration: { ...sourceGeneration, unexpected: true } } as never, f.c)],
      ['binding definition extra', () => bindCurrentMeasurementReadSource({ sourceHistory,
        sourceDefinition: { ...sourceDefinition, unexpected: true }, sourceGeneration } as never, f.c)],
      ['binding numeric class', () => bindCurrentMeasurementReadSource({ sourceHistory,
        sourceDefinition: { ...sourceDefinition, class: 42 }, sourceGeneration } as never, f.c)],
      ['binding decision extra', () => bindCurrentMeasurementReadSource({ sourceHistory,
        sourceDefinition: { ...sourceDefinition, decisions: { ...sourceDefinition.decisions,
          'measurement-observation': { ...decision, unexpected: true } } }, sourceGeneration } as never, f.c)],
      ['binding generation extra', () => bindCurrentMeasurementReadSource({ sourceHistory,
        sourceDefinition, sourceGeneration: { ...sourceGeneration, unexpected: true } } as never, f.c)],
      ['binding lineages extra', () => bindCurrentMeasurementReadSource({ sourceHistory,
        sourceDefinition, sourceGeneration: { ...sourceGeneration,
          lineages: { ...sourceGeneration.lineages, unexpected: true } } } as never, f.c)],
      ['binding lineage extra', () => bindCurrentMeasurementReadSource({ sourceHistory,
        sourceDefinition, sourceGeneration: { ...sourceGeneration,
          lineages: { 'machine-a': { ...lineage, unexpected: true } } } } as never, f.c)],
      ['binding head extra', () => bindCurrentMeasurementReadSource({ sourceHistory,
        sourceDefinition, sourceGeneration: { ...sourceGeneration,
          lineages: { 'machine-a': { ...lineage, head: { ...lineage.head!, unexpected: true } } } } } as never, f.c)],
      ['binding wrong head machine', () => bindCurrentMeasurementReadSource({ sourceHistory,
        sourceDefinition, sourceGeneration: { ...sourceGeneration,
          lineages: { 'machine-a': { ...lineage, head: { ...lineage.head!, machine: 42 } } } } } as never, f.c)],
      ['binding wrong observedAt', () => bindCurrentMeasurementReadSource({ sourceHistory,
        sourceDefinition, sourceGeneration: { ...sourceGeneration,
          lineages: { 'machine-a': { ...lineage, observedAt: 'wrong' } } } } as never, f.c)],
      ['binding wrong closed', () => bindCurrentMeasurementReadSource({ sourceHistory,
        sourceDefinition, sourceGeneration: { ...sourceGeneration,
          lineages: { 'machine-a': { ...lineage, closed: 'wrong' } } } } as never, f.c)],
    ];
    expect(mutations).toHaveLength(13);
    for (const [name, run] of mutations)
      expect(run(), name).toMatchObject({ kind: 'Refused', reason: 'decode' });
  });
});
