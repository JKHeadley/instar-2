import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { decodeLoopPolicy } from '../../src/transport/index.js';
import { transportFixture } from './fixture.js';

type Snapshot = Readonly<{ policies: Record<string, unknown>; scheduleMalformedPolicy: unknown }>;
const modes = { null: null, empty: '', negative: -1, wrong: 'wrong', zero: 0 } as const;

function resultValue(result: unknown): unknown {
  return consumeResult<unknown, unknown>(result as never, {
    Success: accepted => ({ accepted }),
    Refused: refused => ({ refused }),
  });
}

function snapshot(): Snapshot {
  const fixture = transportFixture();
  const policies: Record<string, unknown> = {};
  const mutate = (key: string, mode: keyof typeof modes | 'delete') => {
    const candidate = structuredClone(fixture.policy) as unknown as Record<string, unknown>;
    if (mode === 'delete') delete candidate[key]; else candidate[key] = modes[mode];
    return candidate;
  };
  for (const key of Object.keys(fixture.policy)) {
    policies[`${key}:delete`] = resultValue(decodeLoopPolicy(mutate(key, 'delete'), fixture.c));
    for (const mode of Object.keys(modes) as (keyof typeof modes)[])
      policies[`${key}:${mode}`] = resultValue(decodeLoopPolicy(mutate(key, mode), fixture.c));
  }
  policies.valid = resultValue(decodeLoopPolicy(fixture.policy, fixture.c));
  policies.extra = resultValue(decodeLoopPolicy({ ...fixture.policy, extra: true }, fixture.c));
  const token = consumeResult(fixture.api.acquire('differential-lease', '', 500), {
    Success: accepted => accepted,
    Refused: refused => { throw new Error(refused.detail); },
  });
  return { policies, scheduleMalformedPolicy: resultValue(fixture.api.schedule('differential-malformed', token,
    fixture.run, { ...fixture.policy, extra: true } as never)) };
}

it('SLB-LEGACY-MUTATION-72 permanently compares public legacy policy and schedule mutations against main 6148c28', () => {
  const directory = mkdtempSync(join(tmpdir(), 'transport-main-differential-'));
  const archive = spawnSync('git', ['archive', '--format=tar', '6148c28', 'src', 'tests/transport/fixture.ts',
    'tests/facts/fixtures.ts', 'tests/fixtures.ts', 'scripts/transport-file-storage.mjs'],
  { cwd: resolve('.'), encoding: null, maxBuffer: 128 * 1024 * 1024 });
  expect(archive.status, archive.stderr?.toString()).toBe(0);
  const extracted = spawnSync('tar', ['-xf', '-', '-C', directory], { input: archive.stdout, encoding: null });
  expect(extracted.status, extracted.stderr?.toString()).toBe(0);
  symlinkSync(resolve('node_modules'), join(directory, 'node_modules'), 'dir');
  const output = join(directory, 'snapshot.json');
  const probe = join(directory, 'probe.test.ts');
  writeFileSync(probe, `
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { consumeResult } from './src/index.js';
import { decodeLoopPolicy } from './src/transport/index.js';
import { transportFixture } from './tests/transport/fixture.js';
const modes = { null: null, empty: '', negative: -1, wrong: 'wrong', zero: 0 };
const resultValue = result => consumeResult(result, { Success: accepted => ({ accepted }), Refused: refused => ({ refused }) });
it('captures main legacy mutation results', () => {
  const fixture = transportFixture(), policies = {};
  const mutate = (key, mode) => { const candidate = structuredClone(fixture.policy);
    if (mode === 'delete') delete candidate[key]; else candidate[key] = modes[mode]; return candidate; };
  for (const key of Object.keys(fixture.policy)) {
    policies[key + ':delete'] = resultValue(decodeLoopPolicy(mutate(key, 'delete'), fixture.c));
    for (const mode of Object.keys(modes)) policies[key + ':' + mode] = resultValue(decodeLoopPolicy(mutate(key, mode), fixture.c));
  }
  policies.valid = resultValue(decodeLoopPolicy(fixture.policy, fixture.c));
  policies.extra = resultValue(decodeLoopPolicy({ ...fixture.policy, extra: true }, fixture.c));
  const token = consumeResult(fixture.api.acquire('differential-lease', '', 500), {
    Success: accepted => accepted, Refused: refused => { throw new Error(refused.detail); } });
  const scheduleMalformedPolicy = resultValue(fixture.api.schedule('differential-malformed', token,
    fixture.run, { ...fixture.policy, extra: true }));
  writeFileSync(${JSON.stringify(output)}, JSON.stringify({ policies, scheduleMalformedPolicy }));
});
`);
  const config = join(directory, 'vitest.config.mjs');
  writeFileSync(config, `export default { test: { include: [${JSON.stringify(probe)}], pool: 'forks',
    fileParallelism: false, maxWorkers: 1, testTimeout: 30000 } };\n`);
  const run = spawnSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', config,
    '--reporter=dot'], { cwd: directory, encoding: 'utf8', timeout: 60_000 });
  expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  expect(snapshot()).toEqual(JSON.parse(readFileSync(output, 'utf8')));
}, 70_000);
