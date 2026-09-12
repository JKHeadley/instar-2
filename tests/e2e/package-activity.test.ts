import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import { expect, it } from 'vitest';
import type { PackageTransition } from '../../src/assembly/index.js';
import { value } from '../facts/fixtures.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';

const clone = <T>(input: T): T => JSON.parse(JSON.stringify(input)) as T;

function seedBundle(directory: string) {
  const f = assemblyRuntimeFixture(undefined, { verifiedProbes: true });
  const baseCount = f.raw.length;
  const pkg = value(f.runtime.record('LocalCapabilityPackage', clone(assemblyInput('LocalCapabilityPackage'))));
  const packageFact = value(f.runtime.inspect()).find(row => row.record.id === pkg.id)!.fact;
  const steps: { name: string; fact: unknown }[] = [{ name: 'package', fact: clone(packageFact) }];
  let prior: { record: PackageTransition; fact: typeof packageFact } | undefined;
  const append = (name: string, from: PackageTransition['from'], to: PackageTransition['to']) => {
    const record = value(f.runtime.record('PackageTransition', { ...clone(assemblyInput('PackageTransition')), id: `transition:${name}`,
      from, to, operation: `operation:${name}`, claim: `claim:${name}`,
      predecessors: prior ? [prior.fact.id] : [], dependencyFacts: prior ? [packageFact.id, prior.fact.id] : [packageFact.id] }));
    const fact = value(f.runtime.inspect()).find(row => row.record.id === record.id)!.fact;
    prior = { record, fact }; steps.push({ name, fact: clone(fact) });
  };
  append('staged', 'none', 'staged');
  append('inhibited', 'staged', 'inhibited');
  append('recovered', 'inhibited', 'staged');
  append('validated', 'staged', 'validated');
  append('eligible', 'validated', 'eligible');
  append('activating', 'eligible', 'activating');
  append('active', 'activating', 'active');
  append('retired', 'active', 'retired');
  const { ownedBodies: _ownedBodies, ...serializableContext } = f.context;
  const seed = { context: clone(serializableContext), machine: f.host.machine, principal: clone(f.host.principal), scope: clone(f.host.scope),
    generation: f.host.current().generation, clock: clone(f.host.current().clock), namespace: pkg.namespace,
    steps: [...f.raw.slice(0, baseCount).map((fact, index) => ({ name: `foundation-${index}`, fact: clone(fact) })), ...steps] };
  const path = join(directory, 'seed.json'); writeFileSync(path, JSON.stringify(seed), { mode: 0o600 });
  return { path, seed };
}

const expected: Readonly<Record<string, string>> = {
  'before:package': 'unresolved:absent', 'after:package': 'unresolved:incomplete',
  'before:staged': 'unresolved:incomplete', 'after:staged': 'unresolved:nonterminal-head',
  'before:inhibited': 'unresolved:nonterminal-head', 'after:inhibited': 'inactive:inhibited',
  'before:recovered': 'inactive:inhibited', 'after:recovered': 'unresolved:nonterminal-head',
  'before:validated': 'unresolved:nonterminal-head', 'after:validated': 'unresolved:nonterminal-head',
  'before:eligible': 'unresolved:nonterminal-head', 'after:eligible': 'unresolved:nonterminal-head',
  'before:activating': 'unresolved:nonterminal-head', 'after:activating': 'unresolved:nonterminal-head',
  'before:active': 'unresolved:nonterminal-head', 'after:active': 'active',
  'before:retired': 'active', 'after:retired': 'inactive:retired',
};

function label(result: { outcome: { status: string; reason?: string; disposition?: string } }): string {
  return [result.outcome.status, result.outcome.reason ?? result.outcome.disposition].filter(Boolean).join(':');
}

async function runCut(cut: string) {
  const home = mkdtempSync(join(tmpdir(), 'p10-package-activity-'));
  const { path } = seedBundle(home); const store = join(home, 'store');
  const args = [resolvePath('tests/fixtures/package-activity-worker.mjs'), path, store];
  const child = spawn(process.execPath, [...args, 'start', cut], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', bytes => { stderr += String(bytes); });
  try {
    const ready = await new Promise<{ ready: true; witnessed: { identity: { bytes: string }; outcome: { status: string; reason?: string; disposition?: string } } }>((resolveReady, reject) => {
      let stdout = '';
      child.stdout.on('data', bytes => { stdout += String(bytes); if (stdout.includes('\n')) resolveReady(JSON.parse(stdout.trim())); });
      child.once('exit', code => reject(new Error(`package activity cut worker exited ${code}: ${stderr}`)));
    });
    const exited = new Promise(resolveExit => child.once('exit', (_code, signal) => resolveExit(signal))); child.kill('SIGKILL');
    expect(await exited).toBe('SIGKILL');
    const recovered = spawnSync(process.execPath, [...args, 'recover', cut], { encoding: 'utf8', timeout: 30_000 });
    expect(recovered.status, recovered.stderr).toBe(0);
    const output = JSON.parse(recovered.stdout) as { result: typeof ready.witnessed };
    expect(label(ready.witnessed), cut).toBe(expected[cut]);
    expect(output.result, cut).toEqual(ready.witnessed);
    return { home, path, store };
  } catch (error) {
    rmSync(home, { recursive: true, force: true }); throw error;
  } finally { child.kill('SIGKILL'); }
}

it('P10-NF-08 P10-NF-30 P10-NF-43 P10-NF-44 real SIGKILL before and after every durable package boundary reconstructs the same witnessed activity', async () => {
  for (const cut of Object.keys(expected)) {
    const run = await runCut(cut);
    rmSync(run.home, { recursive: true, force: true });
  }
}, 120_000);

it('P10-NF-08 P10-NF-43 missing prefixes and changed signed bytes refuse after durable restart rather than becoming inactive', async () => {
  const missing = await runCut('after:active');
  try {
    const file = join(missing.store, 'facts.json'); const facts = JSON.parse(readFileSync(file, 'utf8')) as unknown[];
    writeFileSync(file, JSON.stringify(facts.slice(1)));
    const worker = resolvePath('tests/fixtures/package-activity-worker.mjs');
    const resumed = spawnSync(process.execPath, [worker, missing.path, missing.store, 'recover', 'missing-prefix'], { encoding: 'utf8', timeout: 30_000 });
    expect(resumed.status, resumed.stderr).toBe(0);
    expect(JSON.parse(resumed.stdout).refusal).toMatch(/genesis|prefix|chain|link/);
  } finally { rmSync(missing.home, { recursive: true, force: true }); }

  const changed = await runCut('after:active');
  try {
    const file = join(changed.store, 'facts.json'); const facts = JSON.parse(readFileSync(file, 'utf8')) as { body?: { record?: { cause?: string } } }[];
    const target = facts.find(fact => fact.body?.record?.cause === 'install')!; target.body!.record!.cause = 'tampered';
    writeFileSync(file, JSON.stringify(facts));
    const worker = resolvePath('tests/fixtures/package-activity-worker.mjs');
    const resumed = spawnSync(process.execPath, [worker, changed.path, changed.store, 'recover', 'changed-byte'], { encoding: 'utf8', timeout: 30_000 });
    expect(resumed.status, resumed.stderr).toBe(0);
    expect(JSON.parse(resumed.stdout).refusal).toMatch(/hash|signature|changed|integrity/);
  } finally { rmSync(changed.home, { recursive: true, force: true }); }
}, 60_000);
