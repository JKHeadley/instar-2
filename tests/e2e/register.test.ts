import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { build } from '../../scripts/build-register.mjs';
import type { BootstrapBinding } from '../../scripts/build-register.mjs';
import { defineDecoder, decode } from '../../src/index.js';
import { generationOf, decodeGenerationRecord } from '../../src/register/index.js';
import type { FactReference, RegisterContext } from '../../src/register/index.js';
import { setup, value, json, hash } from '../register/fixtures.js';
import { installOwnerFixture } from '../register/owner-fixture.js';
// Emitted runtime is available when tests execute (after build), but a fresh
// checkout must be typecheckable before dist exists.
const emittedModule = '../../dist/index.js';
const { decode: emittedDecode } = await import(emittedModule) as typeof import('../../src/index.js');

describe('compiled register build adapter lifecycle', () => {
  it('P3-NF-21 P3-NF-22 P3-NF-23 P3-NF-24 P3-NF-26 P3-NF-27 R1 normal extract and completion workflows invoke the provider and full graph ladder', () => {
    const root = mkdtempSync(join(tmpdir(), 'instar-register-normal-e2e-'));
    try {
      for (const path of ['docs', 'src', 'tests', 'register-source', 'package.json', 'tsconfig.json']) cpSync(path, join(root, path), { recursive: true });
      installOwnerFixture(root);
      const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      git('init'); git('add', '.'); git('commit', '-qm', 'fixture bootstrap');
      const initial = git('rev-parse', 'HEAD').trim();
      const replay = build(root, initial, { mode: 'replay', now: 100 });
      const conversion = replay.conversion;
      expect(replay.authorityPrerequisites).toHaveLength(5);
      expect(replay.register.entries.find(e => e.declaration.id === 'rungraph.contract')!.approvedIn).toEqual({ state: 'pending-landing' });
      for (const source of conversion.sources) if (source.declaration.requiredFacts.number) Object.assign(source.declaration.requiredFacts, { deadline: 1000, owner: 'fixture-operator', overdueAction: 'surface' });
      const s = setup(); const parent = s.build(); const generation = value(generationOf(parent, s.context));
      Object.assign(s.f.ctx.register, { entries: [...new Set([...s.f.ctx.register.entries, ...replay.register.entries.map(e => e.declaration.id)])] });
      const record = value(decodeGenerationRecord(json('GenerationRecord', { generation, at: s.f.now }), s.context));
      const reply = <T,>(payload: T) => value(defineDecoder<T, RegisterContext>({ name: 'NormalWorkflowFixture', owner: 'test-only', currentVersion: 1,
        versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {}, decodeCurrent: () => ({ ok: true, value: payload }) }, s.context.preserved))
        .decode(json('NormalWorkflowFixture', {}), s.context);
      const calls: string[] = [];
      const compiledTypes = emittedDecode as unknown as typeof decode;
      const principal = (id: string, kind: 'person' | 'system') => {
        const proof = s.f.proof({ id, kind }, { id, kind }, 'identity');
        return value(compiledTypes('VerifiedPrincipal', json('VerifiedPrincipal', { id, kind }),
          { ...s.f.ctx, provenance: value(compiledTypes('Provenance', proof.input, s.f.ctx)) }));
      };
      const executor = principal('fixture-executor', 'system'); const writer = principal('alice', 'person');
      const ownerSeparations = replay.authorityPrerequisites.map(({ site, record }) => ({ site, record,
        execution: { principal: executor, grants: s.f.grants, revocations: [], scope: s.f.scope, now: s.f.now }, writer, scope: s.f.scope, action: 'work' }));
      const ownerRows = replay.register.entries.filter(e => e.declaration.kind === 'governed documents').map(({ declaration }) => {
        const { declaredBy: _site, ...authored } = declaration;
        return { id: declaration.id, version: 'fixture-approved:' + declaration.id, status: 'live', since: initial, supersedes: [],
          approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'fixture:document-approval' }, landedIn: initial, base: initial, contentHash: hash(authored) };
      });
      const provider = { owner: 'part-two' as const, verifyExtract: (e: typeof parent.extract) => { calls.push('extract:' + e.vector.id); return reply({ owner: 'part-two', name: 'FactEnvelope', id: 'verified:fixture' } as FactReference); },
        enteringForce: () => { calls.push('force'); return reply(record); }, isCurrent: () => { calls.push('current'); return reply(true); },
        verifyShapeChange: () => { throw new Error('unchanged parent shape must not ask for approval'); }, types: s.f.ctx, separations: ownerSeparations };
      expect(() => build(root, initial, { mode: 'bootstrap', now: 100 })).toThrow('phase verification');
      expect(() => build(root, initial, { mode: 'bootstrap', provider, now: 100 })).toThrow('phase verification');
      let phase: 'converted-unanchored' | 'anchored' = 'converted-unanchored';
      const bootstrapProvider = { ...provider, verifyBootstrap: (binding: BootstrapBinding) => {
        calls.push('bootstrap:' + binding.commit);
        return reply({ phase, binding, fact: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: 'fixture:conversion-approval' } });
      } };
      // Conversion-phase approval is not approval of the later owner's contract.
      expect(() => build(root, initial, { mode: 'bootstrap', provider: bootstrapProvider, now: 100 })).toThrow('lacks approved history');
      expect(calls).toContain('bootstrap:' + initial);
      phase = 'anchored';
      expect(() => build(root, initial, { mode: 'bootstrap', provider: bootstrapProvider, now: 100 })).toThrow('already anchored');
      phase = 'converted-unanchored';
      expect(() => build(root, initial, { mode: 'bootstrap', now: 101, provider: { ...bootstrapProvider,
        verifyBootstrap: binding => bootstrapProvider.verifyBootstrap({ ...binding, checkedAt: 100 }) } })).toThrow('stale/mismatched');
      expect(() => build(root, initial, { mode: 'replay', provider: bootstrapProvider, now: 100 })).toThrow('offline shape verdict');
      const workflow = { mode: 'normal', branch: 'fixture', conversion, parent: { register: parent, generation },
        extract: { ...s.extract, rows: ownerRows, vector: { owner: 'part-two', name: 'FactPositionVector', id: 'fixture:mirrored' } },
        runs: [], catalog: { fixtures: [], probes: [], sentinels: [], semanticReviews: [] }, landedParts: [], references: [],
        claims: s.context.shape.kinds.map(k => ({ kind: k.name, complete: false })) };
      const commit = () => { writeFileSync(join(root, 'register-source/normal.json'), JSON.stringify(workflow)); git('add', '.'); git('commit', '-qm', 'fixture normal source'); return git('rev-parse', 'HEAD').trim(); };
      const revision = commit();
      expect(() => build(root, revision, { mode: 'normal', workflow, now: 100 })).toThrow('provider');
      const result = build(root, revision, { mode: 'normal', workflow, provider, now: 100 });
      expect(() => build(root, revision, { mode: 'normal', workflow, provider: { ...provider, separations: [] }, now: 100 })).toThrow('standing evidence');
      expect(result.authorityPrerequisites).toEqual([]);
      expect(result.register.entries.find(e => e.declaration.id === 'rungraph.contract')!.approvedIn).toEqual(ownerRows[0]!.approvedIn);
      expect(result.graph.prerequisites).toEqual([]); expect(result.graph.loops).toHaveLength(115);
      expect(result.register.extract.vector.id).toBe('fixture:mirrored');
      expect(calls).toContain('extract:fixture:mirrored'); expect(calls).toContain('force'); expect(calls).toContain('current');
      const source = workflow.conversion.sources.find(s => s.declaration.requiredFacts.number === 4)!;
      source.declaration.requiredFacts.deadline = 99;
      expect(() => build(root, commit(), { mode: 'normal', workflow, provider, now: 100 })).toThrow('deadline passed');
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
        return ownerRows.find(r => r.id === declaration.id) ?? { id: declaration.id, version: 'v:' + declaration.id, status: 'live', since: revision, supersedes: [],
          approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'fixture:approval' }, landedIn: revision, base: revision, contentHash: hash(authored) };
      }) };
      const completion = { ...workflow, mode: 'completion', pending: result.register, extract: completedExtract };
      writeFileSync(join(root, 'register-source/completion.json'), JSON.stringify(completion)); git('add', '.'); git('commit', '-qm', 'fixture extract mirror');
      const completed = build(root, git('rev-parse', 'HEAD').trim(), { mode: 'completion', workflow: completion, now: 100,
        provider: { ...provider, types: s.f.ctx, landingStanding: { principal: compiledMachine, grants: s.f.grants, revocations: [], scope: s.f.scope, now: s.f.now } } });
      expect(completed.register.commit).toBe(revision);
      expect(completed.register.entries.every(e => !('state' in e.approvedIn))).toBe(true);
      // R1.1: normal ingestion must bind the sidecar to a real function, then
      // derive its record read/decoder observations and check live separation.
      const guarded = { ...s.holder([]), requiredFacts: { ...s.holder([]).requiredFacts, decidesAlone: 'governed-state', enforces: { record: 'store', decoder: 'decode:Profile' } } };
      const governed = { ...workflow, references: [{ provider: 'fixture', id: 'check' }, { provider: 'decoder', id: 'decode:Profile' }],
        catalog: { ...workflow.catalog, fixtures: [{ id: 'check', stage: 'build', artifact: { path: 'src/register/workflow.ts', hash: hash(readFileSync(join(root, 'src/register/workflow.ts'), 'utf8')) } }] },
        extract: { ...workflow.extract, rows: [...ownerRows, { id: 'store', version: 'v1', status: 'live', since: initial, supersedes: [], approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'fixture:approval' },
          landedIn: initial, base: initial, contentHash: hash(s.declaration()) }] } };
      writeFileSync(join(root, 'src/guard.declarations.json'), JSON.stringify([s.declaration(), guarded]));
      const writerProof = s.f.proof({ id: 'alice', kind: 'person' }, { id: 'alice', kind: 'person' }, 'identity');
      const compiledWriter = value(compiledDecode('VerifiedPrincipal', json('VerifiedPrincipal', { id: 'alice', kind: 'person' }),
        { ...s.f.ctx, provenance: value(compiledDecode('Provenance', writerProof.input, s.f.ctx)) }));
      const separated = { ...provider, types: s.f.ctx, separations: [...ownerSeparations, { site: 'holder', record: 'store',
        execution: { principal: compiledMachine, grants: s.f.grants, revocations: [], scope: s.f.scope, now: s.f.now }, writer: compiledWriter, scope: s.f.scope, action: 'work' }] };
      const reads = "readRegisterEntry('store', register, context); decode('Profile', raw, context);";
      const imports = "import { constructGoverned, readRegisterEntry } from '@instar/constitutional-types/register'; import { decode } from '@instar/constitutional-types';";
      for (const [body, error] of [
        [imports + "export function guard() { constructGoverned('blocking sites', 'holder', register, context); " + reads + '}', null],
        [imports + "export function guard() { constructGoverned('blocking sites', 'holder', register, context); } export function unrelated() { " + reads + '}', 'does not read'],
        [imports + 'export function unrelated() { ' + reads + '}', 'does not read'],
      ] as const) {
        writeFileSync(join(root, 'src/guard.ts'), body); writeFileSync(join(root, 'register-source/governed.json'), JSON.stringify(governed));
        git('add', '.'); git('commit', '-qm', 'fixture governed source');
        const run = () => build(root, git('rev-parse', 'HEAD').trim(), { mode: 'normal', workflow: governed, provider: separated, now: 100 });
        if (error) expect(run).toThrow(error);
        else expect(run().register.entries.find(e => e.declaration.id === 'holder')!.declaration.declaredBy).toMatchObject({ path: 'src/guard.ts', symbol: 'guard' });
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60_000);
  it('P3-NF-09 P3-NF-13 P3-NF-19 P3-NF-24 P3-NF-26 R1/R3/R5 shipped CLI rejects invalid holders, deadlines, rungs and unbound shape changes', async () => {
    const root = mkdtempSync(join(tmpdir(), 'instar-register-repair-e2e-'));
    const script = resolve('scripts/build-register.mjs');
    try {
      for (const path of ['docs', 'src', 'tests', 'register-source', 'package.json', 'tsconfig.json']) cpSync(path, join(root, path), { recursive: true });
      const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      git('init');
      const commit = () => { git('add', '.'); git('commit', '-qm', 'fixture source'); return git('rev-parse', 'HEAD').trim(); };
      writeFileSync(join(root, 'register-source/checks.json'), JSON.stringify({ mode: 'replay', references: [{ provider: 'fixture', id: 'check' }],
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
        const result = spawnSync(process.execPath, [script, '--replay', '--checks', 'register-source/checks.json', '--now', '100', '--commit', revision, '--out', join(root, 'out')], { cwd: root, encoding: 'utf8' });
        if (error) { expect(result.status, result.stderr).not.toBe(0); expect(result.stderr).toContain(error); }
        else { expect(result.status, result.stderr).toBe(0); expect(JSON.parse(result.stdout).prerequisites).toBeGreaterThan(0); }
        await new Promise<void>(done => setImmediate(done));
      }
      // R1.1: a colocated cap can actually carry a memory store's load-bearing
      // bound through the shipped CLI. Missing, other-file and ambiguous sites
      // do not become valid simply because they repeat its id.
      const s = setup();
      writeFileSync(join(root, 'register-source/checks.json'), JSON.stringify({ mode: 'replay', references: [{ provider: 'probe', id: 'probe' }],
        catalog: { fixtures: [], probes: [{ id: 'probe', cadence: 100, artifact: { path: 'src/register/workflow.ts', hash: hash(readFileSync(join(root, 'src/register/workflow.ts'), 'utf8')) } }], sentinels: [], semanticReviews: [] } }));
      writeFileSync(join(root, 'src/repair.declarations.json'), JSON.stringify([s.bound, { ...s.declaration(), profile: s.f.profileInput() }]));
      const cap = "import { constructGoverned } from '@instar/constitutional-types/register'; export function cap() { return constructGoverned('critical outcomes', 'bound', register, context); }";
      for (const [body, other, error] of [[cap, '', null], ['', cap, 'no paired construct'], ['', '', 'no paired construct'],
        [cap + "export function wrong() { return constructGoverned('critical outcomes', 'bound', register, context); }", '', 'ambiguous colocated']] as const) {
        writeFileSync(join(root, 'src/repair.ts'), body); writeFileSync(join(root, 'src/elsewhere.ts'), other); const revision = commit();
        const result = spawnSync(process.execPath, [script, '--replay', '--checks', 'register-source/checks.json', '--now', '100', '--commit', revision, '--out', join(root, 'out')], { cwd: root, encoding: 'utf8' });
        if (error) { expect(result.status).not.toBe(0); expect(result.stderr).toContain(error); }
        else {
          expect(result.status, result.stderr).toBe(0);
          const generated = JSON.parse(readFileSync(join(root, 'out/register.json'), 'utf8'));
          expect(generated.entries.find((e: { declaration: { id: string } }) => e.declaration.id === 'bound').declaration.declaredBy).toMatchObject({ path: 'src/repair.ts', symbol: 'cap' });
          expect(JSON.parse(readFileSync(join(root, 'out/conversion.json'), 'utf8')).sources.some((s: { path: string }) => s.path === 'src/repair.ts')).toBe(false);
        }
        await new Promise<void>(done => setImmediate(done));
      }
      const shapePath = join(root, 'register-source/bootstrap-shape.json');
      const shape = JSON.parse(readFileSync(shapePath, 'utf8')) as { kinds: { name: string; invariants: string[]; fields: { name: string; values: string[] }[] }[] };
      const stores = shape.kinds.find(k => k.name === 'stores')!;
      for (const mutation of [() => { stores.invariants = []; }, () => { stores.fields.find(f => f.name === 'growth')!.values.push('invented'); }]) {
        mutation(); writeFileSync(shapePath, JSON.stringify(shape)); const revision = commit();
        const result = spawnSync(process.execPath, [script, '--replay', '--commit', revision, '--out', join(root, 'out')], { cwd: root, encoding: 'utf8' });
        expect(result.status).not.toBe(0); expect(result.stderr).toContain('P3-NF-09');
        // R5.1 exact desk counterexample: mutate the purported anchor too. The
        // immutable checker pin must refuse even though candidate hashes agree.
        const anchorPath = join(root, 'register-source/bootstrap-anchor.json');
        const anchor = JSON.parse(readFileSync(anchorPath, 'utf8')); anchor.shape = hash(shape);
        writeFileSync(anchorPath, JSON.stringify(anchor));
        writeFileSync(join(root, 'src/repair.declarations.json'), JSON.stringify([s.declaration('illegal-memory', 'stores', { growth: 'deletes', holdsAgentMemory: 'yes', machineScope: { kind: 'shared' }, agreesWith: [] })]));
        const changed = commit();
        for (const flag of ['--bootstrap', '--replay']) {
          const tampered = spawnSync(process.execPath, [script, flag, '--commit', changed, '--out', join(root, 'tampered-' + flag.slice(2))], { cwd: root, encoding: 'utf8' });
          expect(tampered.status).not.toBe(0); expect(tampered.stderr).toContain('P3-NF-09');
        }
        await new Promise<void>(done => setImmediate(done));
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  // Measured 63.4s on GitHub x64 (~24s locally): this real compiled-CLI,
  // multi-invocation refusal test needs slow-runner headroom, not a runtime-latency assertion.
  }, 120_000);
  it('P3-P5 shipped CLI defaults resolve committed owner bindings, but never spoofed calls or stale artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'instar-owner-cli-'));
    try {
      for (const path of ['docs', 'src', 'tests', 'register-source', 'package.json', 'tsconfig.json']) cpSync(path, join(root, path), { recursive: true });
      installOwnerFixture(root);
      const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      git('init');
      const commit = () => { git('add', '.'); git('commit', '-qm', 'owner CLI source'); return git('rev-parse', 'HEAD'); };
      const script = resolve('scripts/build-register.mjs');
      const run = (revision: string) => spawnSync(process.execPath, [script, '--replay', '--now', '100', '--commit', revision, '--out', join(root, 'out')], { cwd: root, encoding: 'utf8' });
      const revision = commit(); const good = run(revision);
      expect(good.status, good.stderr).toBe(0);
      const source = JSON.parse(readFileSync(join(root, 'out/source.json'), 'utf8'));
      expect(source.authority).toBe('shape-only'); expect(source.authorityPrerequisites).toHaveLength(5);
      const declared = JSON.parse(readFileSync(join(root, 'out/register.json'), 'utf8'));
      expect(declared.entries.find((e: { declaration: { id: string } }) => e.declaration.id === 'rungraph-core').declaration).toMatchObject({ status: 'dark', profile: { reach: 'user', consequence: 'control', reversibility: 'costly', surface: 'chat' } });
      const path = join(root, 'src/rungraph/rungraph.ts'); const original = readFileSync(path, 'utf8');
      // Preserve the real import and the same-name local call, but remove the
      // actual owner invocation. An identifier-only scanner would accept this.
      const spoof = original.replace(/decodeRun\(([^;]+)\);/, '((decodeRun) => decodeRun($1))((v) => v);');
      expect(spoof).not.toBe(original); writeFileSync(path, spoof);
      const wrongCall = run(commit()); expect(wrongCall.status).not.toBe(0); expect(wrongCall.stderr).toContain('does not read');
      // R1: retain the real construction/read and every valid owner artifact pin.
      // Only the decoder receiver changes. Immutable namespace chains work;
      // a reassigned receiver and a const alias of that receiver do not.
      for (const [receiver, accepted] of [
        ['const ns = owner; const next = ns; next.decodeRun($1);', true],
        ["let ns = owner; ns = { ...owner, decodeRun: (_v: unknown) => 'impostor' }; ns.decodeRun($1);", false],
        ["let ns = owner; ns = { ...owner, decodeRun: (_v: unknown) => 'impostor' }; const next = ns; next.decodeRun($1);", false],
      ] as const) {
        const body = original.replace(/decodeRun\(([^;]+)\);/, receiver);
        expect(body).not.toBe(original);
        writeFileSync(path, "import * as owner from './index.js';\n" + body);
        const result = run(commit());
        if (accepted) expect(result.status, result.stderr).toBe(0);
        else { expect(result.status).not.toBe(0); expect(result.stderr).toContain('does not read enforced record and invoke named decoder'); }
      }
      writeFileSync(path, original);
      const manifestPath = join(root, 'register-source/owner-references.json'); const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.decoders[0].artifact.hash = hash('not the committed owner source'); writeFileSync(manifestPath, JSON.stringify(manifest));
      const stale = run(commit()); expect(stale.status).not.toBe(0); expect(stale.stderr).toContain('artifact hash differs');
      // Pin validation includes CI artifacts, not just production .ts files.
      const testPath = join(root, 'tests/rungraph/governance.test.ts'); writeFileSync(testPath, readFileSync(testPath, 'utf8') + '\n// ambient edit\n');
      const ambient = run(revision); expect(ambient.status).not.toBe(0); expect(ambient.stderr).toContain('source pin trails');
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60_000);
  it('P3-P5 R2 same pinned commit refuses with and without an ambient bridge, and resolves a committed bridge', () => {
    const directory = mkdtempSync(join(tmpdir(), 'instar-owner-graph-cli-'));
    const root = join(directory, 'working'); const clean = join(directory, 'clean'); const committed = join(directory, 'committed');
    try {
      const inputs = ['docs', 'src', 'tests', 'register-source', 'package.json', 'tsconfig.json'];
      for (const path of inputs) cpSync(path, join(root, path), { recursive: true });
      installOwnerFixture(root);
      const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-C', cwd, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      const indexPath = join(root, 'src/rungraph/index.ts');
      const index = readFileSync(indexPath, 'utf8');
      const viaBridge = index.replaceAll("'./records.js'", "'./owner-bridge.js'");
      expect(viaBridge).not.toBe(index); writeFileSync(indexPath, viaBridge);
      const manifestPath = join(root, 'register-source/owner-references.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      for (const decoder of manifest.decoders) decoder.module.hash = hash(viaBridge);
      writeFileSync(manifestPath, JSON.stringify(manifest));
      git(root, 'init'); git(root, 'add', ...inputs); git(root, 'commit', '-qm', 'pinned public index, absent bridge');
      const revision = git(root, 'rev-parse', 'HEAD');
      git(directory, 'clone', '--quiet', '--no-hardlinks', root, clean);
      expect(git(clean, 'rev-parse', 'HEAD')).toBe(revision);
      writeFileSync(join(root, 'src/rungraph/owner-bridge.ts'), "export * from './records.js';");
      expect(git(root, 'ls-tree', '-r', '--name-only', revision)).not.toContain('owner-bridge.ts');
      expect(git(root, 'status', '--porcelain')).toContain('?? src/rungraph/owner-bridge.ts');
      const script = resolve('scripts/build-register.mjs');
      const run = (cwd: string, pin: string) => spawnSync(process.execPath, [script, '--replay', '--now', '100', '--commit', pin, '--out', join(cwd, 'out')], { cwd, encoding: 'utf8' });
      for (const cwd of [root, clean]) {
        const result = run(cwd, revision);
        expect(result.status).not.toBe(0); expect(result.stderr).toContain('unresolved public owner decoder export decodeRun');
      }
      git(root, 'add', 'src/rungraph/owner-bridge.ts'); git(root, 'commit', '-qm', 'include bridge in committed source graph');
      const pinned = git(root, 'rev-parse', 'HEAD');
      git(directory, 'clone', '--quiet', '--no-hardlinks', root, committed);
      expect(git(committed, 'rev-parse', 'HEAD')).toBe(pinned);
      for (const cwd of [root, committed]) { const result = run(cwd, pinned); expect(result.status, result.stderr).toBe(0); }
      for (const path of ['register.json', 'source.json'])
        expect(readFileSync(join(root, 'out', path), 'utf8')).toBe(readFileSync(join(committed, 'out', path), 'utf8'));
      // The separately shipped wiring command also scans the pin, never an
      // expanded live-file graph. Its valid control must work before perturbing it.
      cpSync(join(root, 'out'), join(root, 'generated'), { recursive: true });
      const wiring = () => spawnSync(process.execPath, [resolve('scripts/check-register-wiring.mjs')], { cwd: root, encoding: 'utf8' });
      const checked = wiring(); expect(checked.status, checked.stderr).toBe(0);
      writeFileSync(join(root, 'src/rungraph/ambient.ts'), "export * from './records.js';");
      const untracked = wiring(); expect(untracked.status).not.toBe(0); expect(untracked.stderr).toContain('roster differs from committed graph');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }, 60_000);
  it('P3-NF-01 P3-NF-07 P3-NF-09 actual CLI reproduces committed outputs and rejects edited output', () => {
    const root = mkdtempSync(join(tmpdir(), 'instar-register-e2e-'));
    try {
      const run = (...args: string[]) => execFileSync(process.execPath, ['scripts/build-register.mjs', '--replay', '--out', root, ...args], { encoding: 'utf8' });
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
