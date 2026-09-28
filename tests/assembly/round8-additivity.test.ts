import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { assemblyShapes, decodeAssemblyRecord } from '../../src/assembly/index.js';
import { consumeResult } from '../../src/index.js';
import { assemblyInput } from './fixture.js';
import { assemblyRuntimeFixture } from './round8-extended-fixture.js';
// @ts-expect-error The shared first-landing baseline checker is plain ESM.
import { firstLanding } from '../../scripts/first-landing.mjs';

type Decode = typeof decodeAssemblyRecord;
type Outcome = { accepted: true; value: unknown } | { accepted: false; reason: string; detail: string };
const result = (value: unknown): Outcome => consumeResult(value as never, {
  Success: (accepted): Outcome => ({ accepted: true, value: accepted }),
  Refused: (refusal): Outcome => ({ accepted: false, reason: refusal.reason, detail: refusal.detail }),
}) as Outcome;

async function mainDecoder(): Promise<Decode> {
  const root = process.cwd();
  let main = 'main';
  try { execFileSync('git', ['rev-parse', '--verify', 'main'], { cwd: root, stdio: 'ignore' }); }
  catch { main = 'origin/main'; }
  const base = execFileSync('git', ['merge-base', 'HEAD', main], { cwd: root, encoding: 'utf8' }).trim();
  let source = execFileSync('git', ['show', `${base}:src/assembly/records.ts`], { cwd: root, encoding: 'utf8' });
  // Every relative import the base decoder carries is re-pointed at this tree's built output. The rewrite is
  // generic on purpose: an owner that later gains an additive import (Part Eleven added '../operator/index.js')
  // must not break the main-versus-HEAD comparison, which would otherwise fail on module resolution, not on outcome.
  source = source.replace(/from '(\.\.?\/[^']+\.js)'/g, (_match, specifier: string) =>
    `from '${resolve(root, 'dist', specifier.startsWith('./') ? join('assembly', specifier) : specifier.slice('../'.length))}'`);
  const directory = mkdtempSync(join(tmpdir(), 'p10-main-decoder-'));
  const file = join(directory, 'records.ts');
  writeFileSync(file, source);
  return (await import(`${pathToFileURL(file).href}?base=${base}`)).decodeAssemblyRecord as Decode;
}

// Rule 37 quarantine: see docs/defects/stale-main-baseline-additivity.md
it.skip('R8-F1 compares pre-existing Part Ten fixture outcomes on P11 first landing', async () => {
  const scope = firstLanding(process.cwd(), ['src/operator/seams.ts']);
  if (!scope.applicable) {
    console.log(`P11 assembly R8-F1 first-landing comparison inapplicable: operator seams unit already present on current-main baseline ${scope.mainTip}.`);
    return;
  }
  const legacy = await mainDecoder();
  const names = Object.keys(assemblyShapes) as (keyof typeof assemblyShapes)[];
  const base = assemblyRuntimeFixture();
  for (const name of names) {
    const original = assemblyInput(name);
    for (const candidate of [original, { ...original, id: ' \t ' }, { ...original, schemaVersion: 2 }, { ...original, surprise: true }]) {
      const before = JSON.stringify(result(legacy(name, candidate, base.c)));
      const after = JSON.stringify(result(decodeAssemblyRecord(name, candidate, base.c)));
      expect(after, `${name}:${JSON.stringify(candidate)}`).toBe(before);
    }
  }
});

// Rule 37 quarantine: see docs/defects/stale-main-baseline-additivity.md
it.skip('V72 compares Part Ten decoder field deletions on P11 first landing', async () => {
  const scope = firstLanding(process.cwd(), ['src/operator/seams.ts']);
  if (!scope.applicable) {
    console.log(`P11 assembly V72 first-landing comparison inapplicable: operator seams unit already present on current-main baseline ${scope.mainTip}.`);
    return;
  }
  const legacy = await mainDecoder();
  const base = assemblyRuntimeFixture();
  let compared = 0, accepted = 0, refused = 0;
  for (const name of Object.keys(assemblyShapes) as (keyof typeof assemblyShapes)[]) {
    const original = assemblyInput(name);
    const candidates = [original, { ...original, id: ' \t ' }, { ...original, schemaVersion: 2 },
      { ...original, surprise: true },
      ...Object.keys(original).map(key => Object.fromEntries(Object.entries(original).filter(([field]) => field !== key)))];
    for (const candidate of candidates) {
      const before = result(legacy(name, candidate, base.c));
      const after = result(decodeAssemblyRecord(name, candidate, base.c));
      expect(after, `${name}:${JSON.stringify(candidate)}`).toEqual(before);
      compared++;
      if (before.accepted) accepted++;
      else refused++;
    }
  }
  expect({ compared, accepted, refused }).toEqual({ compared: 322, accepted: 11, refused: 311 });
});

it.each([
  ['V87', 'GrowthPolicy', 'GrowthObservation', (id: string) => ({ policy: id })],
  ['V88', 'Measurement', 'GrowthObservation', (id: string) => ({ measurements: [id] })],
  ['V89', 'CheckRunRecord', 'AdapterConformance', (id: string) => ({
    stageChecks: [{ stage: 'context', checkRun: id, positive: ['positive'], negative: ['negative'] }],
  })],
] as const)('R8-F1 rereview6 %s legacy %s label cannot substitute for owned %s data', async (_id, kind, type, patch) => {
  const f = assemblyRuntimeFixture();
  const raw = f.appendReference(kind, { id: `raw-label:${kind}` }).fact;
  const input = { ...assemblyInput(type), id: `round8:${type}:${kind}`, ...patch(raw.id) };
  const decoded = result(decodeAssemblyRecord(type, input, f.c));
  const recorded = result(f.runtime.record(type, input));
  expect(decoded.accepted).toBe(false);
  expect(recorded.accepted).toBe(false);
});

it('R8-F1 rereview6 V90 authentic owned GrowthPolicy remains accepted by the current decoder', async () => {
  const f = assemblyRuntimeFixture();
  const input = { ...assemblyInput('GrowthObservation'), id: 'round8:clean-growth-observation' };
  expect(result(decodeAssemblyRecord('GrowthObservation', input, f.c)).accepted).toBe(true);
  expect(result(f.runtime.record('GrowthObservation', input)).accepted).toBe(true);
});
