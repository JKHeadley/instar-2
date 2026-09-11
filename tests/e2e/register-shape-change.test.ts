import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { build } from '../../scripts/build-register.mjs';
import { decode, defineDecoder } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeGeneration, decodeGenerationRecord } from '../../src/register/index.js';
import type { FactReference, RegisterContext, ShapeChangeBinding } from '../../src/register/index.js';
import { hash, json, setup, value } from '../register/fixtures.js';

const emittedModule = '../../dist/index.js';
const { decode: emittedDecode } = await import(emittedModule) as typeof import('../../src/index.js');

describe('normal-mode shape-change CLI composition', () => {
  it('P3-NF-07/09/21/23/24 adds part 14 and its owner manifest, and refuses missing, tampered, or stale authority', () => {
    const root = mkdtempSync(join(tmpdir(), 'instar-register-shape-change-'));
    try {
      for (const path of ['docs', 'generated', 'src', 'tests', 'register-source', 'package.json', 'tsconfig.json'])
        cpSync(path, join(root, path), { recursive: true });
      const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      // The normal ladder requires deadlines supplied as governing data. This
      // fixture changes only the parent's carried conversion, never the docs.
      const conversionPath = join(root, 'generated/conversion.json');
      const conversion = JSON.parse(readFileSync(conversionPath, 'utf8'));
      for (const source of conversion.sources) if (source.declaration.requiredFacts.number)
        Object.assign(source.declaration.requiredFacts, { deadline: 1000, owner: 'fixture-operator', overdueAction: 'surface' });
      writeFileSync(conversionPath, JSON.stringify(conversion));
      git('init'); git('add', '.'); git('commit', '-qm', 'parent generation');
      const parentCommit = git('rev-parse', 'HEAD');
      const parentRegister = JSON.parse(readFileSync(join(root, 'generated/register.json'), 'utf8'));
      const parentSource = JSON.parse(readFileSync(join(root, 'generated/source.json'), 'utf8'));

      const shapePath = join(root, 'register-source/bootstrap-shape.json');
      const shape = JSON.parse(readFileSync(shapePath, 'utf8')); shape.parts.push(14);
      writeFileSync(shapePath, JSON.stringify(shape, null, 2) + '\n');
      mkdirSync(join(root, 'tests/sentinel-holders'), { recursive: true });
      writeFileSync(join(root, 'tests/e2e/sentinel-holders.test.ts'), '// P14-NF-50 enrolled build fixture\n');
      writeFileSync(join(root, 'tests/sentinel-holders/core.test.ts'), '// part fourteen CI probe fixture\n');
      const manifest = { schemaVersion: 1, owner: 'part-fourteen',
        fixtures: [{ id: 'P14-NF-50', stage: 'build', artifact: { path: 'tests/e2e/sentinel-holders.test.ts', hash: hash('// P14-NF-50 enrolled build fixture\n') } }],
        probes: [{ id: 'sentinel-holders.package-loop-policy.probe', cadence: 60_000, execution: 'ci',
          artifact: { path: 'tests/sentinel-holders/core.test.ts', hash: hash('// part fourteen CI probe fixture\n') } }],
        decoders: [], documents: [] };
      const manifestPath = 'register-source/owner-references/part-fourteen.json';
      writeFileSync(join(root, manifestPath), JSON.stringify(manifest, null, 2) + '\n');
      const enrollment = { part: 14, owner: 'part-fourteen', manifest: { path: manifestPath, hash: hash(manifest) } };
      writeFileSync(join(root, 'register-source/owner-enrollments.json'), JSON.stringify({ schemaVersion: 1, enrollments: [enrollment] }, null, 2) + '\n');
      const approval: FactReference = { owner: 'part-two', name: 'FactEnvelope', id: 'fixture:shape-change-approval' };
      const documentPath = 'register-source/shape-changes/part-fourteen.json'; mkdirSync(join(root, 'register-source/shape-changes'), { recursive: true });
      const document = { type: 'ShapeChangeDocument', schemaVersion: 1, id: 'part-fourteen-owner-enrollment', parent: parentSource.generation,
        candidateShape: hash(shape), changes: [{ operation: 'add', path: `/parts/${parentRegister.shape.parts.length}`, after: 14 }],
        ownerReferences: [enrollment], approvedIn: approval };
      writeFileSync(join(root, documentPath), JSON.stringify(document, null, 2) + '\n');
      const ownerRows = parentRegister.entries.filter((entry: { declaration: { kind: string } }) => entry.declaration.kind === 'governed documents')
        .map(({ declaration }: { declaration: Record<string, unknown> }) => {
          const { declaredBy: _site, ...authored } = declaration;
          return { id: declaration.id, version: 'fixture-approved:' + declaration.id, status: 'live', since: parentCommit, supersedes: [],
            approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'fixture:document-approval' }, landedIn: parentCommit,
            base: parentCommit, contentHash: hash(authored) };
        });
      const baseWorkflow = { type: 'RegisterWorkflow', schemaVersion: 1, mode: 'normal', branch: 'fixture-shape-change',
        parent: { commit: parentCommit, register: 'generated/register.json', source: 'generated/source.json', conversion: 'generated/conversion.json' },
        extract: { ...parentRegister.extract, rows: ownerRows }, runs: [], catalog: { fixtures: [], probes: [], sentinels: [], semanticReviews: [] },
        landedParts: [], references: [], claims: shape.kinds.map((kind: { name: string }) => ({ kind: kind.name, complete: false })), instances: {} };
      const good = { ...baseWorkflow, shapeChange: { document: { path: documentPath, hash: hash(document) } } };
      const missing = { ...baseWorkflow, shapeChange: { document: { path: 'register-source/shape-changes/missing.json', hash: hash({ missing: true }) } } };
      const tampered = { ...baseWorkflow, shapeChange: { document: { path: documentPath, hash: hash({ tampered: true }) } } };
      for (const [name, workflow] of Object.entries({ good, missing, tampered }))
        writeFileSync(join(root, `register-source/${name}.json`), JSON.stringify(workflow, null, 2) + '\n');
      git('add', '.'); git('commit', '-qm', 'part fourteen shape change'); const candidate = git('rev-parse', 'HEAD');

      const s = setup();
      Object.assign(s.f.ctx.register, { entries: [...new Set([...s.f.ctx.register.entries,
        ...parentRegister.entries.map((entry: { declaration: { id: string } }) => entry.declaration.id)])] });
      const generation = value(decodeGeneration({ type: 'RegisterGeneration', schemaVersion: 1, id: parentSource.generation,
        commit: parentSource.commit, vector: parentRegister.extract.vector }, s.context));
      const generationRecord = value(decodeGenerationRecord(json('GenerationRecord', { generation, at: s.f.now }), s.context));
      const reply = <T,>(payload: T): Result<T> => value(defineDecoder<T, RegisterContext>({ name: 'ShapeChangeFixtureReply', owner: 'test-only',
        currentVersion: 1, versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {},
        decodeCurrent: () => ({ ok: true, value: payload }) }, s.context.preserved)).decode(json('ShapeChangeFixtureReply', {}), s.context);
      const principal = (id: string, kind: 'person' | 'system') => {
        const proof = s.f.proof({ id, kind }, { id, kind }, 'identity');
        return value((emittedDecode as unknown as typeof decode)('VerifiedPrincipal', json('VerifiedPrincipal', { id, kind }),
          { ...s.f.ctx, provenance: value((emittedDecode as unknown as typeof decode)('Provenance', proof.input, s.f.ctx)) }));
      };
      const writer = principal('alice', 'person'), executor = principal('fixture-executor', 'system');
      const separations = parentSource.authorityPrerequisites.map(({ site, record }: { site: string; record: string }) => ({ site, record,
        execution: { principal: executor, grants: s.f.grants, revocations: [], scope: s.f.scope, now: s.f.now },
        writer, scope: s.f.scope, action: 'work' }));
      const expectedBinding: ShapeChangeBinding = { parent: document.parent, candidateShape: document.candidateShape,
        document: good.shapeChange.document, approval };
      const provider = { owner: 'part-two' as const,
        verifyExtract: () => reply({ owner: 'part-two', name: 'FactEnvelope', id: 'fixture:extract' } as FactReference),
        enteringForce: () => reply(generationRecord), isCurrent: () => reply(true),
        verifyShapeChange: (binding: ShapeChangeBinding) => {
          if (JSON.stringify(binding) !== JSON.stringify(expectedBinding)) throw new Error('unexpected shape approval binding');
          return reply(approval);
        }, types: s.f.ctx, separations };
      const first = build(root, candidate, { mode: 'normal', workflow: good, provider, now: 100, requireWorkflowSchema: true });
      const second = build(root, candidate, { mode: 'normal', workflow: good, provider, now: 100, requireWorkflowSchema: true });
      expect(first.register.shape.parts).toContain(14);
      expect(first.outputs).toEqual(second.outputs); expect(first.generation).toEqual(second.generation);
      expect(() => build(root, candidate, { mode: 'normal', workflow: missing, provider, now: 100, requireWorkflowSchema: true })).toThrow('not committed');
      expect(() => build(root, candidate, { mode: 'normal', workflow: tampered, provider, now: 100, requireWorkflowSchema: true })).toThrow('bytes do not match');
      expect(() => build(root, candidate, { mode: 'normal', workflow: good, provider: { ...provider, isCurrent: () => reply(false) }, now: 100,
        requireWorkflowSchema: true })).toThrow('stale');
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60_000);
});
