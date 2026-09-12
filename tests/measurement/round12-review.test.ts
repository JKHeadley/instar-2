import { describe, expect, it } from 'vitest';
// @ts-expect-error Repository contract checker is intentionally JavaScript.
import { validateMeasurementPermissionExports } from '../../scripts/check-p16-contract-map.mjs';
import {
  round12ArchitectureCorpus,
  round12BoundaryCorpus,
  round12VerdictTableCases,
  type Round12ArchitectureCase,
} from './round12-architecture-fixtures.js';

const resultByFixture = new Map<Round12ArchitectureCase, ReturnType<typeof validateMeasurementPermissionExports>>();

const resultFor = (fixture: Round12ArchitectureCase) => {
  const existing = resultByFixture.get(fixture);
  if (existing) return existing;
  const result = validateMeasurementPermissionExports(fixture.sources);
  resultByFixture.set(fixture, result);
  return result;
};

const assertCase = (fixture: Round12ArchitectureCase) => {
  const result = resultFor(fixture);
  expect(result).toEqual(expect.objectContaining({
    status: expect.stringMatching(/^(accepted|refused|unanalyzable)$/),
    accepted: expect.any(Boolean),
    reason: expect.any(String),
    violations: expect.any(Array),
  }));
  if (fixture.expected === 'accept') {
    expect(result.status, fixture.id).toBe('accepted');
  } else {
    expect(result.accepted, fixture.id).toBe(false);
    expect(['refused', 'unanalyzable'], fixture.id).toContain(result.status);
    expect(result.path, fixture.id).toEqual(expect.any(String));
    expect(result.violations.length, fixture.id).toBeGreaterThan(0);
  }
};

describe('Part 16 A1 round 12 independent-review source validator corpus', () => {
  it.each(round12ArchitectureCorpus)(
    'P16-NF-23 [behavior:observational-port] architecture-clean10 case $id has one total result',
    assertCase,
  );

  it.each(round12BoundaryCorpus)(
    'P16-NF-23 [behavior:observational-port] export-boundaries10 case $id has one total result',
    assertCase,
  );

  it.each(round12VerdictTableCases)(
    'P16-NF-23 [behavior:observational-port] verdict table form %s is permanently exercised by %s',
    (_form, id) => {
      const fixture = round12ArchitectureCorpus.find(candidate => candidate.id === id);
      expect(fixture, id).toBeDefined();
      assertCase(fixture!);
    },
  );

  const sourceFiles = [...round12ArchitectureCorpus, ...round12BoundaryCorpus]
    .flatMap(fixture => Object.keys(fixture.sources).map(file => ({
      fixture, id: fixture.id, file,
    })));
  it.each(sourceFiles)(
    'P16-NF-23 [behavior:observational-port] source file $id:$file returns exactly one total result',
    ({ fixture, id, file }) => {
      const result = resultFor(fixture);
      expect(result, `${id}:${file}`).toEqual(expect.objectContaining({
        status: expect.stringMatching(/^(accepted|refused|unanalyzable)$/),
        accepted: expect.any(Boolean),
        reason: expect.any(String),
        violations: expect.any(Array),
      }));
    },
  );

  it('P16-NF-23 [behavior:observational-port] distinguishes callable unions, erased values, and harmless names', () => {
    for (const name of ['allow', 'canRun', 'place', 'throttle']) {
      const optional = round12BoundaryCorpus.find(row => row.id === `optional-callable-${name}`)!;
      expect(resultFor(optional)).toMatchObject({
        status: 'refused', accepted: false, reason: 'reachable-callable-permission',
      });
      const erased = round12BoundaryCorpus.find(row => row.id === `erased-callable-${name}`)!;
      expect(resultFor(erased)).toMatchObject({
        status: 'unanalyzable', accepted: false, reason: 'reachable-permission-type-unanalyzable',
      });
      const numeric = round12BoundaryCorpus.find(row => row.id === `numeric-export-${name}`)!;
      expect(resultFor(numeric)).toMatchObject({
        status: 'accepted', accepted: true,
      });
    }
  });
});
