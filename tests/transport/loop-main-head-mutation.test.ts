import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { decodeLoopPolicy } from '../../src/transport/index.js';
import { transportFixture } from './fixture.js';

const MAIN_TIP = 'db15e137a259e7d56bf39be1b6839a1c56c33155';
const GENERATED_CASE_COUNT = 860;

function resultValue(result: unknown): unknown {
  return consumeResult<unknown, unknown>(result as never, {
    Success: accepted => ({ accepted }) as unknown,
    Refused: refused => ({ refused }) as unknown,
  });
}

const probeSource = String.raw`
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';

const root = process.env.SLB_TARGET_ROOT;
const output = process.env.SLB_OUTPUT;
if (!root || !output) throw new Error('SLB_TARGET_ROOT and SLB_OUTPUT are required');
const load = suffix => import(pathToFileURL(join(root, suffix)).href);
const [{ transportFixture }, { transportShapes }, { createBoundedDueScanPort }, core, facts, keys] = await Promise.all([
  load('tests/transport/fixture.ts'),
  load('src/transport/records.ts'),
  load('src/transport/index.ts'),
  load('src/index.ts'),
  load('src/facts/index.ts'),
  load('tests/facts/fixtures.ts'),
]);
const value = result => core.consumeResult(result, {
  Success: accepted => accepted,
  Refused: refused => { throw new Error(refused.detail); },
});
const result = candidate => core.consumeResult(candidate, {
  Success: accepted => ({ accepted }),
  Refused: refused => ({ refused }),
});
function populate(shape) {
  if (shape.kind === 'text') return 'x';
  if (shape.kind === 'integer') return 1;
  return Object.fromEntries(Object.entries(shape.fields).map(([key, child]) => [key, populate(child)]));
}
function paths(shape, prefix = []) {
  if (shape.kind !== 'object') return [prefix];
  return [
    ...(prefix.length ? [prefix] : []),
    ...Object.entries(shape.fields).flatMap(([key, child]) => paths(child, [...prefix, key])),
  ];
}
it('generates every signed legacy record field mutation', () => {
  const fixture = transportFixture();
  const { token } = fixture.prepared();
  const scan = createBoundedDueScanPort(fixture.host, fixture.spine, fixture.c);
  value(scan.page({ scan: 'scan', generation: 'g', orderedKeys: ['a', 'b'], cursor: null,
    maxItems: 1, maxDuration: 10 }));
  const recorded = value(fixture.store.read());
  const wires = fixture.storage.read();
  const out = {};
  const inventory = {};
  const snapshot = { policy: fixture.policy, token, rows: value(fixture.api.inspect()), wires };
  for (const [kind, shape] of Object.entries(transportShapes)) {
    let body = populate(shape);
    Object.assign(body, { type: kind, schemaVersion: 1 });
    const existing = wires.find(wire => wire.body.record.type === kind);
    if (existing) body = existing.body.record;
    if (kind === 'LoopPolicy') body = fixture.policy;
    if (kind === 'FenceToken') body = token;
    const base = existing ?? wires[0];
    const context = {
      ...fixture.ctx,
      facts: [...fixture.ctx.facts, ...recorded.filter(fact => fact.id !== base.id)],
      schemas: [...fixture.ctx.schemas, { ...fixture.ctx.schemas[0], kind: 'legacy-mutation-carrier',
        fields: { record: { kind: 'owned', owner: 'part-six', name: kind } } }],
    };
    const cases = [['control', body]];
    for (const path of paths(shape)) for (const mode of
      ['missing', 'extra', 'wrong-type', 'negative', 'overflow', 'new-marker']) {
      const candidate = structuredClone(body);
      let parent = candidate;
      for (const key of path.slice(0, -1)) parent = parent[key];
      const key = path.at(-1);
      if (mode === 'missing') delete parent[key];
      if (mode === 'extra') parent['extra:' + key] = true;
      if (mode === 'wrong-type') parent[key] = null;
      if (mode === 'negative') parent[key] = -1;
      if (mode === 'overflow') parent[key] = Number.MAX_SAFE_INTEGER + 1;
      if (mode === 'new-marker') parent[key] = 'shared-circuit-v1';
      cases.push([path.join('.') + ':' + mode, candidate]);
    }
    for (const [label, record] of cases) {
      const wire = facts.signEnvelope({ ...base, kind: 'legacy-mutation-carrier', body: { record } }, keys.privateKey);
      out[kind + '/' + label] = result(facts.decodeHistoricalBody(
        value(facts.decodeEnvelope(wire, context, 'replication')), context, context.decode));
    }
    inventory[kind] = cases.length;
  }
  const data = { inventory, snapshot, out };
  writeFileSync(output, JSON.stringify(data));
  expect(Object.keys(out)).toHaveLength(${GENERATED_CASE_COUNT});
}, 60000);
`;

function runProbe(targetRoot: string, output: string, directory: string): void {
  const label = output.endsWith('main.json') ? 'main' : 'head';
  const probe = join(directory, `probe-${label}.test.ts`);
  const config = join(directory, `probe-${label}.config.mjs`);
  writeFileSync(probe, probeSource);
  writeFileSync(config, `export default { test: { include: [${JSON.stringify(probe)}], pool: 'forks',\n`
    + `fileParallelism: false, maxWorkers: 1, testTimeout: 60000 } };\n`);
  const run = spawnSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', config,
    '--reporter=dot'], {
    cwd: targetRoot,
    encoding: 'utf8',
    timeout: 70_000,
    env: { ...process.env, SLB_TARGET_ROOT: targetRoot, SLB_OUTPUT: output },
  });
  expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
}

it('SLB-LEGACY-ALL-KINDS-93 generates and compares all 860 main-vs-HEAD signed legacy mutations', () => {
  const directory = mkdtempSync(join(tmpdir(), 'transport-full-main-differential-'));
  const mainRoot = join(directory, 'main');
  const archive = spawnSync('git', ['archive', '--format=tar', MAIN_TIP, 'src', 'tests',
    'scripts/transport-file-storage.mjs', 'package.json', 'tsconfig.json', 'vitest.config.ts'], {
    cwd: resolve('.'),
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
  });
  expect(archive.status, archive.stderr?.toString()).toBe(0);
  mkdirSync(mainRoot, { recursive: true });
  const extracted = spawnSync('tar', ['-xf', '-', '-C', mainRoot], { input: archive.stdout, encoding: null });
  expect(extracted.status, extracted.stderr?.toString()).toBe(0);
  symlinkSync(resolve('node_modules'), join(mainRoot, 'node_modules'), 'dir');
  const mainOutput = join(directory, 'main.json');
  const headOutput = join(directory, 'head.json');
  runProbe(mainRoot, mainOutput, directory);
  runProbe(resolve('.'), headOutput, directory);
  const main = JSON.parse(readFileSync(mainOutput, 'utf8'));
  const head = JSON.parse(readFileSync(headOutput, 'utf8'));
  expect(Object.keys(head.out)).toHaveLength(GENERATED_CASE_COUNT);
  expect(head).toEqual(main);
}, 150_000);

it('SLB-LEGACY-V2-94 keeps main dispatch for a legacy breaker marker without an A1 field', () => {
  const fixture = transportFixture();
  const candidate = { ...fixture.policy, breaker: 'shared-circuit-v1' };
  expect(resultValue(decodeLoopPolicy(candidate, fixture.c))).toEqual({
    refused: expect.objectContaining({ detail: 'unsupported loop policy' }),
  });
});

it('SLB-LEGACY-BYTES-100 keeps every main-owned transport source and test byte-identical', () => {
  const listed = spawnSync('git', ['ls-tree', '-r', '--name-only', MAIN_TIP, '--',
    'src/transport', 'tests/transport', 'tests/fixtures'], { encoding: 'utf8' });
  expect(listed.status, listed.stderr).toBe(0);
  const paths = listed.stdout.trim().split('\n').filter(path => path
    && (path.startsWith('src/transport/') || path.startsWith('tests/transport/')
      || path.startsWith('tests/fixtures/transport-')));
  expect(paths.length).toBeGreaterThan(0);
  for (const path of paths) {
    const main = spawnSync('git', ['show', `${MAIN_TIP}:${path}`], { encoding: null });
    expect(main.status, `${path}: ${main.stderr?.toString()}`).toBe(0);
    expect(readFileSync(path), path).toEqual(main.stdout);
  }
});
