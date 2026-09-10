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
  for (const [from, to] of [
    ["'../index.js'", `'${resolve(root, 'dist/index.js')}'`],
    ["'../facts/index.js'", `'${resolve(root, 'dist/facts/index.js')}'`],
    ["'./boundary.js'", `'${resolve(root, 'dist/assembly/boundary.js')}'`],
    ["'./types-internal.js'", `'${resolve(root, 'dist/assembly/types-internal.js')}'`],
  ] as const) source = source.replaceAll(from, to);
  const directory = mkdtempSync(join(tmpdir(), 'p10-main-decoder-'));
  const file = join(directory, 'records.ts');
  writeFileSync(file, source);
  return (await import(`${pathToFileURL(file).href}?base=${base}`)).decodeAssemblyRecord as Decode;
}

it('R8-F1 main-vs-HEAD mutation harness preserves byte-identical outcomes for every pre-existing Part Ten fixture input', async () => {
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

it.each([
  ['V87', 'GrowthPolicy', 'GrowthObservation', (id: string) => ({ policy: id })],
  ['V88', 'Measurement', 'GrowthObservation', (id: string) => ({ measurements: [id] })],
  ['V89', 'CheckRunRecord', 'AdapterConformance', (id: string) => ({
    stageChecks: [{ stage: 'context', checkRun: id, positive: ['positive'], negative: ['negative'] }],
  })],
] as const)('R8-F1 rereview6 %s legacy %s label cannot substitute for owned %s data', async (_id, kind, type, patch) => {
  const legacy = await mainDecoder();
  const f = assemblyRuntimeFixture();
  const raw = f.appendReference(kind, { id: `raw-label:${kind}` }).fact;
  const input = { ...assemblyInput(type), id: `round8:${type}:${kind}`, ...patch(raw.id) };
  const before = result(legacy(type, input, f.c));
  const decoded = result(decodeAssemblyRecord(type, input, f.c));
  const recorded = result(f.runtime.record(type, input));
  expect(before.accepted).toBe(false);
  expect(decoded).toEqual(before);
  expect(recorded.accepted).toBe(false);
});

it('R8-F1 rereview6 V90 authentic owned GrowthPolicy remains accepted by main and HEAD', async () => {
  const legacy = await mainDecoder();
  const f = assemblyRuntimeFixture();
  const input = { ...assemblyInput('GrowthObservation'), id: 'round8:clean-growth-observation' };
  expect(result(legacy('GrowthObservation', input, f.c)).accepted).toBe(true);
  expect(result(decodeAssemblyRecord('GrowthObservation', input, f.c)).accepted).toBe(true);
  expect(result(f.runtime.record('GrowthObservation', input)).accepted).toBe(true);
});
