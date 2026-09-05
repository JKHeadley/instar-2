import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { build } from '../../scripts/build-register.mjs';
import { defineDecoder, decode } from '../../src/index.js';
import { generationOf, decodeGenerationRecord } from '../../src/register/index.js';
import type { FactReference, RegisterContext } from '../../src/register/index.js';
import { setup, value, json, hash } from '../register/fixtures.js';
// Emitted runtime is available when tests execute (after build), but a fresh
// checkout must be typecheckable before dist exists.
const emittedModule = '../../dist/index.js';
const { decode: emittedDecode } = await import(emittedModule) as typeof import('../../src/index.js');

describe('compiled register build adapter lifecycle', () => {
  it('P3-NF-21 P3-NF-22 P3-NF-23 P3-NF-24 R1 normal extract and completion workflows invoke the provider and full graph ladder', () => {
    const root = mkdtempSync(join(tmpdir(), 'instar-register-normal-e2e-'));
    try {
      for (const path of ['docs', 'src', 'register-source', 'package.json', 'tsconfig.json']) cpSync(path, join(root, path), { recursive: true });
      const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      git('init'); git('add', '.'); git('commit', '-qm', 'fixture bootstrap');
      const initial = git('rev-parse', 'HEAD').trim();
      const conversion = build(root, initial, { mode: 'bootstrap', now: 100 }).conversion;
      for (const source of conversion.sources) if (source.declaration.requiredFacts.number) Object.assign(source.declaration.requiredFacts, { deadline: 1000, owner: 'fixture-operator', overdueAction: 'surface' });
      const s = setup(); const parent = s.build(); const generation = value(generationOf(parent, s.context));
      const record = value(decodeGenerationRecord(json('GenerationRecord', { generation, at: s.f.now }), s.context));
      const reply = <T,>(payload: T) => value(defineDecoder<T, RegisterContext>({ name: 'NormalWorkflowFixture', owner: 'test-only', currentVersion: 1,
        versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {}, decodeCurrent: () => ({ ok: true, value: payload }) }, s.context.preserved))
        .decode(json('NormalWorkflowFixture', {}), s.context);
      const calls: string[] = [];
      const provider = { owner: 'part-two' as const, verifyExtract: (e: typeof parent.extract) => { calls.push('extract:' + e.vector.id); return reply({ owner: 'part-two', name: 'FactEnvelope', id: 'verified:fixture' } as FactReference); },
        enteringForce: () => { calls.push('force'); return reply(record); }, isCurrent: () => { calls.push('current'); return reply(true); },
        verifyShapeChange: () => { throw new Error('unchanged parent shape must not ask for approval'); } };
      const workflow = { mode: 'normal', branch: 'fixture', conversion, parent: { register: parent, generation },
        extract: { ...s.extract, vector: { owner: 'part-two', name: 'FactPositionVector', id: 'fixture:mirrored' } },
        runs: [], catalog: { fixtures: [], probes: [], sentinels: [], semanticReviews: [] }, landedParts: [], references: [],
        claims: s.context.shape.kinds.map(k => ({ kind: k.name, complete: false })) };
      const commit = () => { writeFileSync(join(root, 'register-source/normal.json'), JSON.stringify(workflow)); git('add', '.'); git('commit', '-qm', 'fixture normal source'); return git('rev-parse', 'HEAD').trim(); };
      const revision = commit();
      expect(() => build(root, revision, { mode: 'normal', workflow, now: 100 })).toThrow('provider');
      const result = build(root, revision, { mode: 'normal', workflow, provider, now: 100 });
      expect(result.graph.prerequisites).toEqual([]); expect(result.graph.loops).toHaveLength(115);
      expect(result.register.extract.vector.id).toBe('fixture:mirrored');
      expect(calls).toContain('extract:fixture:mirrored'); expect(calls).toContain('force'); expect(calls).toContain('current');
      const source = workflow.conversion.sources.find(s => s.declaration.requiredFacts.number === 4)!;
      source.declaration.requiredFacts.deadline = 99;
      expect(() => build(root, commit(), { mode: 'normal', workflow, provider, now: 100 })).toThrow('deadline passed');
      expect(() => build(root, revision, { mode: 'bootstrap', provider: { ...provider, hasEnteredForce: true }, now: 100 })).toThrow('already anchored');
      source.declaration.requiredFacts.deadline = 1000;
      const machine = s.f.principal('landing', 'system');
      // Enter the emitted package's boundary: its nominal decoder session is
      // distinct from the source-module test session, just as for a real provider.
      const compiledDecode = emittedDecode as unknown as typeof decode;
      const identity = s.f.proof({ id: 'landing', kind: 'system' }, { id: 'landing', kind: 'system' }, 'identity');
      const provenance = value(compiledDecode('Provenance', identity.input, s.f.ctx));
      const compiledMachine = value(compiledDecode('VerifiedPrincipal', json('VerifiedPrincipal', { id: 'landing', kind: 'system' }), { ...s.f.ctx, provenance }));
      const actions = ['append:version-chain', 'append:generation-record', 'append:check-run-record'];
      Object.assign(s.f.ctx.register.actions, Object.fromEntries(actions.map(action => [action, { protected: false, repository: false }])));
      s.f.grant({ id: 'landing:grant', grantee: machine, standing: 'delegate', actions, expiresAt: 1000 });
      const completedExtract = { ...workflow.extract, rows: result.register.entries.map(({ declaration }) => {
        const { declaredBy: _site, ...authored } = declaration;
        return { id: declaration.id, version: 'v:' + declaration.id, status: 'live', since: revision, supersedes: [],
          approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'fixture:approval' }, landedIn: revision, base: revision, contentHash: hash(authored) };
      }) };
      const completion = { ...workflow, mode: 'completion', pending: result.register, extract: completedExtract };
      writeFileSync(join(root, 'register-source/completion.json'), JSON.stringify(completion)); git('add', '.'); git('commit', '-qm', 'fixture extract mirror');
      const completed = build(root, git('rev-parse', 'HEAD').trim(), { mode: 'completion', workflow: completion, now: 100,
        provider: { ...provider, types: s.f.ctx, landingStanding: { principal: compiledMachine, grants: s.f.grants, revocations: [], scope: s.f.scope, now: s.f.now } } });
      expect(completed.register.commit).toBe(revision);
      expect(completed.register.entries.every(e => !('state' in e.approvedIn))).toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60_000);
  it('P3-NF-09 P3-NF-13 P3-NF-24 P3-NF-26 R1/R3/R5 shipped CLI rejects invalid holders, deadlines, rungs and unbound shape changes', async () => {
    const root = mkdtempSync(join(tmpdir(), 'instar-register-repair-e2e-'));
    const script = resolve('scripts/build-register.mjs');
    try {
      for (const path of ['docs', 'src', 'register-source', 'package.json', 'tsconfig.json']) cpSync(path, join(root, path), { recursive: true });
      const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      git('init');
      const commit = () => { git('add', '.'); git('commit', '-qm', 'fixture source'); return git('rev-parse', 'HEAD').trim(); };
      writeFileSync(join(root, 'register-source/checks.json'), JSON.stringify({ mode: 'bootstrap', references: [{ provider: 'fixture', id: 'check' }],
        catalog: { fixtures: [{ id: 'check', stage: 'build', artifact: { path: 'src/register/workflow.ts', hash: hash(readFileSync(join(root, 'src/register/workflow.ts'), 'utf8')) } }], probes: [], sentinels: [], semanticReviews: [] } }));
      const declaration = (id: string, kind: string, facts: object, extra: object = {}) => ({ type: 'Declaration', schemaVersion: 1, id, kind, status: 'live', requiredFacts: facts, standards: [], holds: [], ...extra });
      const profile = { type: 'Profile', schemaVersion: 1, consequence: 'none', reversibility: 'reversible', reach: 'internal', surface: 'none', repeats: { kind: 'no' } };
      const rung = { decidesAlone: 'ruled-three', criticality: 'exact fixture', failDirection: 'closed', preservesInput: 'capture' };
      const holder = (rule: number, part: number) => declaration('fixture-holder', 'blocking sites', { authority: 'block', inspectedBy: 'check', ...rung }, {
        profile, holds: [{ rule, class: 'deferred', part, ceiling: 1000, owner: 'fixture-operator', overdueAction: 'surface' }] });
      const cases: [object, string | null][] = [
        [holder(999, 99), 'missing rule 999'],
        [holder(4, 99), 'unknown deferred part 99'],
        [holder(4, 8), null],
        [declaration('fixture-rule', 'rules', { number: 999, name: 'Fixture rule', statement: 'A test-only obligation.', held: 'script', parent: 'root', rootReason: 'fixture', termRefs: [], checkDescription: 'test', deadline: 99, owner: 'fixture-operator', overdueAction: 'surface' }), 'deadline passed'],
        [declaration('fixture-rule', 'rules', { number: 999, name: 'Fixture rule', statement: 'A test-only obligation.', held: 'script', parent: 'root', rootReason: 'fixture', termRefs: [], checkDescription: 'test', deadline: 1000, owner: 'fixture-operator', overdueAction: 'surface' }), null],
        [declaration('fixture-feature', 'features', { metrics: ['counter'], gate: { test: 'check', deadline: 99 } }, { profile, status: 'dark' }), 'graduation overdue'],
        [declaration('fixture-feature', 'features', { metrics: ['counter'], gate: { test: 'check', deadline: 1000 } }, { profile, status: 'dark' }), null],
        [declaration('fixture-holder', 'blocking sites', { authority: 'block', inspectedBy: 'check', ...rung, decidesAlone: 'governed-state', rungs: [] }, { profile }), 'rungs'],
        [declaration('fixture-holder', 'blocking sites', { authority: 'block', inspectedBy: 'check', rungs: [rung, { ...rung, failDirection: 'open' }] }, { profile }), null],
      ];
      for (const [d, error] of cases) {
        writeFileSync(join(root, 'src/repair.declarations.json'), JSON.stringify([d])); const revision = commit();
        const result = spawnSync(process.execPath, [script, '--bootstrap', '--checks', 'register-source/checks.json', '--now', '100', '--commit', revision, '--out', join(root, 'out')], { cwd: root, encoding: 'utf8' });
        if (error) { expect(result.status, result.stderr).not.toBe(0); expect(result.stderr).toContain(error); }
        else { expect(result.status, result.stderr).toBe(0); expect(JSON.parse(result.stdout).prerequisites).toBeGreaterThan(0); }
        await new Promise<void>(done => setImmediate(done));
      }
      const shapePath = join(root, 'register-source/bootstrap-shape.json');
      const shape = JSON.parse(readFileSync(shapePath, 'utf8')) as { kinds: { name: string; invariants: string[]; fields: { name: string; values: string[] }[] }[] };
      const stores = shape.kinds.find(k => k.name === 'stores')!;
      for (const mutation of [() => { stores.invariants = []; }, () => { stores.fields.find(f => f.name === 'growth')!.values.push('invented'); }]) {
        mutation(); writeFileSync(shapePath, JSON.stringify(shape)); const revision = commit();
        const result = spawnSync(process.execPath, [script, '--bootstrap', '--commit', revision, '--out', join(root, 'out')], { cwd: root, encoding: 'utf8' });
        expect(result.status).not.toBe(0); expect(result.stderr).toContain('P3-NF-09');
        await new Promise<void>(done => setImmediate(done));
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60_000);
  it('P3-NF-01 P3-NF-07 P3-NF-09 actual CLI reproduces committed outputs and rejects edited output', () => {
    const root = mkdtempSync(join(tmpdir(), 'instar-register-e2e-'));
    try {
      const run = (...args: string[]) => execFileSync(process.execPath, ['scripts/build-register.mjs', '--bootstrap', '--out', root, ...args], { encoding: 'utf8' });
      const first = JSON.parse(run()) as { rules: number; entries: number; generation: string; authority: string };
      expect(first.rules).toBe(115); expect(first.entries).toBeGreaterThan(115); expect(first.authority).toBe('shape-only');
      const before = readFileSync(join(root, 'register.json'), 'utf8'); run('--check'); run();
      expect(readFileSync(join(root, 'register.json'), 'utf8')).toBe(before);
      expect(readFileSync(join(root, 'capabilities.md'), 'utf8')).toContain('register-tooling');
      expect(readFileSync(join(root, 'rules.md'), 'utf8').split('\n').some(line => /[ \t]+$/.test(line))).toBe(false);
      writeFileSync(join(root, 'shape.json'), '{}\n');
      const fail = spawnSync(process.execPath, ['scripts/build-register.mjs', '--out', root, '--check'], { encoding: 'utf8' });
      expect(fail.status).not.toBe(0); expect(fail.stderr).toContain('P3-NF-09');
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 30_000);
});
