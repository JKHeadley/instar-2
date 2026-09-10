import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { decodeEnvelope, decodeHistoricalBody, signEnvelope } from '../../src/facts/index.js';
import { decodeLoopPolicy } from '../../src/transport/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportFixture } from './fixture.js';

type Snapshot = Readonly<{
  policies: Record<string, unknown>;
  scheduleMalformedPolicy: unknown;
  legacyPriority: Record<string, unknown>;
  mutations: Record<string, unknown>;
}>;
const modes = { null: null, empty: '', negative: -1, wrong: 'wrong', zero: 0 } as const;
const policyErrors = [['maxAttempts', -1], ['minDelay', 0], ['timeout', 0], ['concurrency', 2],
  ['failDirection', 'open'], ['type', 'OtherPolicy'], ['id', '']] as const;
const outerErrors = ['valid', 'foreign-issuer', 'wrong-domain', 'wrong-predecessor', 'negative-tick', 'duplicate-command'] as const;

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
  const scheduleMalformedPolicy = resultValue(fixture.api.schedule('differential-malformed', token,
    fixture.run, { ...fixture.policy, extra: true } as never));
  const priorityFixture = transportFixture();
  priorityFixture.prepared();
  const facts = consumeResult(priorityFixture.store.read(), {
    Success: accepted => accepted,
    Refused: refused => { throw new Error(refused.detail); },
  });
  const fact = facts.find(row => row.kind === 'transport-LoopRecord')!;
  const wire = (priorityFixture.storage.read() as any[]).find(row => row.id === fact.id)!;
  const context = { ...priorityFixture.ctx,
    facts: [...priorityFixture.ctx.facts, ...facts.filter(row => row.id !== fact.id)] };
  const legacyPriority: Record<string, unknown> = {};
  for (const outer of outerErrors) for (const [key, changed] of policyErrors) {
    const record = { ...(wire.body as any).record,
      policy: { ...(wire.body as any).record.policy, [key]: changed } };
    if (outer === 'wrong-domain') record.domain = 'different-domain';
    if (outer === 'wrong-predecessor') record.predecessor = 'different-predecessor';
    if (outer === 'negative-tick') record.tick = -1;
    if (outer === 'duplicate-command') record.command = 'acquire';
    const foreign = outer === 'foreign-issuer'
      ? { principal: priorityFixture.bob, provenance: priorityFixture.bob.provenance } : {};
    const altered = signEnvelope({ ...wire, ...foreign, body: { record } }, privateKey);
    legacyPriority[`${outer}:${key}`] = resultValue(decodeHistoricalBody(
      consumeResult(decodeEnvelope(altered, context, 'replication'), {
        Success: accepted => accepted,
        Refused: refused => { throw new Error(refused.detail); },
      }), context, context.decode));
  }
  const mutations: Record<string, unknown> = {};
  const variants: Record<string, Record<string, unknown>> = {
    valid: priorityFixture.policy as unknown as Record<string, unknown>,
  };
  for (const key of Object.keys(priorityFixture.policy)) {
    for (const [mode, changed] of Object.entries({ null: null, empty: '', wrong: 'wrong', zero: 0,
      negative: -1, array: [], object: {}, bool: true }))
      variants[`${key}:${mode}`] = { ...priorityFixture.policy, [key]: changed };
    variants[`${key}:delete`] = { ...priorityFixture.policy };
    delete variants[`${key}:delete`]![key];
  }
  variants.extra = { ...priorityFixture.policy, extra: 1 };
  variants.newField = { ...priorityFixture.policy, initialDelay: 1 };
  const outerVariants: Record<string, Record<string, unknown>> = {
    valid: {}, wrongDomain: { domain: 'wrong' }, badTick: { tick: -1 }, badState: { state: 'invalid' },
    wrongType: { type: 'Lease' }, wrongEpisode: { episode: '' }, extra: { extra: 1 },
    newField: { pressureKey: 'invented' }, missing: {},
  };
  for (const [name, candidatePolicy] of Object.entries(variants))
    for (const [outer, changes] of Object.entries(outerVariants)) {
      const record = { ...(wire.body as any).record, policy: candidatePolicy, ...changes };
      if (outer === 'missing') delete record.pending;
      const altered = signEnvelope({ ...wire, body: { record } }, privateKey);
      mutations[`${name}/${outer}`] = resultValue(decodeHistoricalBody(
        consumeResult(decodeEnvelope(altered, context, 'replication'), {
          Success: accepted => accepted,
          Refused: refused => { throw new Error(refused.detail); },
        }), context, context.decode));
    }
  return { policies, scheduleMalformedPolicy, legacyPriority, mutations };
}

it('SLB-LEGACY-MUTATION-72 SLB-LEGACY-PRIORITY-76 SLB-LEGACY-FULL-837-81 permanently compares all 837 signed legacy mutations against main 6148c28', () => {
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
import { decodeEnvelope, decodeHistoricalBody, signEnvelope } from './src/facts/index.js';
import { decodeLoopPolicy } from './src/transport/index.js';
import { privateKey } from './tests/facts/fixtures.js';
import { transportFixture } from './tests/transport/fixture.js';
const modes = { null: null, empty: '', negative: -1, wrong: 'wrong', zero: 0 };
const policyErrors = [['maxAttempts', -1], ['minDelay', 0], ['timeout', 0], ['concurrency', 2],
  ['failDirection', 'open'], ['type', 'OtherPolicy'], ['id', '']];
const outerErrors = ['valid', 'foreign-issuer', 'wrong-domain', 'wrong-predecessor', 'negative-tick', 'duplicate-command'];
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
  const priorityFixture = transportFixture();
  priorityFixture.prepared();
  const facts = consumeResult(priorityFixture.store.read(), { Success: accepted => accepted,
    Refused: refused => { throw new Error(refused.detail); } });
  const fact = facts.find(row => row.kind === 'transport-LoopRecord');
  const wire = priorityFixture.storage.read().find(row => row.id === fact.id);
  const context = { ...priorityFixture.ctx,
    facts: [...priorityFixture.ctx.facts, ...facts.filter(row => row.id !== fact.id)] };
  const legacyPriority = {};
  for (const outer of outerErrors) for (const [key, changed] of policyErrors) {
    const record = { ...wire.body.record, policy: { ...wire.body.record.policy, [key]: changed } };
    if (outer === 'wrong-domain') record.domain = 'different-domain';
    if (outer === 'wrong-predecessor') record.predecessor = 'different-predecessor';
    if (outer === 'negative-tick') record.tick = -1;
    if (outer === 'duplicate-command') record.command = 'acquire';
    const foreign = outer === 'foreign-issuer'
      ? { principal: priorityFixture.bob, provenance: priorityFixture.bob.provenance } : {};
    const altered = signEnvelope({ ...wire, ...foreign, body: { record } }, privateKey);
    const frame = consumeResult(decodeEnvelope(altered, context, 'replication'), { Success: accepted => accepted,
      Refused: refused => { throw new Error(refused.detail); } });
    legacyPriority[outer + ':' + key] = resultValue(decodeHistoricalBody(frame, context, context.decode));
  }
  const mutations = {}, variants = { valid: priorityFixture.policy };
  for (const key of Object.keys(priorityFixture.policy)) {
    for (const [mode, changed] of Object.entries({ null: null, empty: '', wrong: 'wrong', zero: 0,
      negative: -1, array: [], object: {}, bool: true })) variants[key + ':' + mode] = { ...priorityFixture.policy, [key]: changed };
    variants[key + ':delete'] = { ...priorityFixture.policy }; delete variants[key + ':delete'][key];
  }
  variants.extra = { ...priorityFixture.policy, extra: 1 };
  variants.newField = { ...priorityFixture.policy, initialDelay: 1 };
  const outerVariants = { valid: {}, wrongDomain: { domain: 'wrong' }, badTick: { tick: -1 },
    badState: { state: 'invalid' }, wrongType: { type: 'Lease' }, wrongEpisode: { episode: '' },
    extra: { extra: 1 }, newField: { pressureKey: 'invented' }, missing: {} };
  for (const [name, candidatePolicy] of Object.entries(variants)) for (const [outer, changes] of Object.entries(outerVariants)) {
    const record = { ...wire.body.record, policy: candidatePolicy, ...changes };
    if (outer === 'missing') delete record.pending;
    const altered = signEnvelope({ ...wire, body: { record } }, privateKey);
    const frame = consumeResult(decodeEnvelope(altered, context, 'replication'), { Success: accepted => accepted,
      Refused: refused => { throw new Error(refused.detail); } });
    mutations[name + '/' + outer] = resultValue(decodeHistoricalBody(frame, context, context.decode));
  }
  writeFileSync(${JSON.stringify(output)}, JSON.stringify({ policies, scheduleMalformedPolicy, legacyPriority, mutations }));
});
`);
  const config = join(directory, 'vitest.config.mjs');
  writeFileSync(config, `export default { test: { include: [${JSON.stringify(probe)}], pool: 'forks',
    fileParallelism: false, maxWorkers: 1, testTimeout: 30000 } };\n`);
  const run = spawnSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', config,
    '--reporter=dot'], { cwd: directory, encoding: 'utf8', timeout: 60_000 });
  expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  const head = snapshot(), main = JSON.parse(readFileSync(output, 'utf8')) as Snapshot;
  expect(Object.keys(head.mutations)).toHaveLength(837);
  expect(head).toEqual(main);
}, 70_000);
