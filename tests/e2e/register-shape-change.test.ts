import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { build } from '../../scripts/build-register.mjs';
import { decode } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { createFactStore, factId, registerOwnedBody } from '../../src/facts/index.js';
import type { FactSchema, OwnedShape } from '../../src/facts/index.js';
import { createPartTwoRegisterProvider, decodeGeneration } from '../../src/register/index.js';
import type { FactReference, ShapeChangeBinding } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { hash, json, setup, value } from '../register/fixtures.js';

const emittedModule = '../../dist/index.js';
const { decode: emittedDecode } = await import(emittedModule) as typeof import('../../src/index.js');
function policy(input: Json): OwnedShape {
  if (input === null) return { kind: 'null' };
  if (typeof input === 'string') return { kind: 'text', maxLength: Math.max(1, input.length) };
  if (typeof input === 'number') return { kind: 'integer' };
  if (typeof input === 'boolean') return { kind: 'boolean' };
  if (Array.isArray(input)) return { kind: 'array', maxLength: Math.max(1, input.length), items: input.length ? policy(input[0]!) : { kind: 'null' } };
  return { kind: 'object', fields: Object.fromEntries(Object.entries(input).map(([key, value]) => [key, policy(value)])) };
}

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
      const sinceId = factId({ machine: 'machine-a', epoch: 0, position: 0 });
      const approval: FactReference = { owner: 'part-two', name: 'FactEnvelope', id: factId({ machine: 'machine-a', epoch: 0, position: 1 }) };
      const landingId = factId({ machine: 'machine-a', epoch: 0, position: 2 });
      const documentPath = 'register-source/shape-changes/part-fourteen.json'; mkdirSync(join(root, 'register-source/shape-changes'), { recursive: true });
      const document = { type: 'ShapeChangeDocument', schemaVersion: 1, id: 'part-fourteen-owner-enrollment', parent: parentSource.generation,
        candidateShape: hash(shape), changes: [{ operation: 'add', path: `/parts/${parentRegister.shape.parts.length}`, after: 14 }],
        ownerReferences: [enrollment], approvedIn: approval };
      writeFileSync(join(root, documentPath), JSON.stringify(document, null, 2) + '\n');
      const ownerRows = parentRegister.entries.filter((entry: { declaration: { kind: string } }) => entry.declaration.kind === 'governed documents')
        .map(({ declaration }: { declaration: Record<string, unknown> }) => {
          const { declaredBy: _site, ...authored } = declaration;
          return { id: declaration.id, version: 'fixture-approved:' + declaration.id, status: 'live', since: sinceId, supersedes: [],
            approvedIn: approval, landedIn: landingId,
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

      const s = setup(), f = factsFixture();
      Object.assign(s.f.ctx.register, { entries: [...new Set([...s.f.ctx.register.entries, 'build-machine',
        ...parentRegister.entries.map((entry: { declaration: { id: string } }) => entry.declaration.id)])],
        producers: [...new Set([...s.f.ctx.register.producers, 'register.generator'])] });
      const generation = value(decodeGeneration({ type: 'RegisterGeneration', schemaVersion: 1, id: parentSource.generation,
        commit: parentSource.commit, vector: parentRegister.extract.vector }, s.context));
      const generationRecord = JSON.parse(JSON.stringify(json('GenerationRecord', { generation, at: f.now }))) as Json;
      const registration = value(registerOwnedBody({ owner: 'part-three', name: 'GenerationRecord', currentVersion: 1,
        versions: { 1: { validate: input => ({ ok: true as const, value: input }) } }, migrations: {},
        decodeCurrent: input => ({ ok: true as const, value: input }) }, policy(generationRecord), f.c));
      const generationSchema: FactSchema = { kind: 'generation-record', version: 1,
        fields: { record: { kind: 'owned', owner: 'part-three', name: 'GenerationRecord' } }, machineScope: 'shared',
        standing: 'requester', action: 'work', scope: f.scope, causallyBound: false, requiredReferences: [], authority: 'none' };
      const factContext = { ...f.ctx, schemas: [f.schema, generationSchema], ownedBodies: [registration] };
      const sinceFact = f.fact({}, factContext), approvalFact = f.next(sinceFact, {}, factContext);
      const landingFact = f.next(approvalFact, {}, factContext);
      const enteringForceFact = f.next(landingFact, { kind: 'generation-record', body: { record: generationRecord } }, factContext);
      expect([sinceFact.id, approvalFact.id, landingFact.id]).toEqual([sinceId, approval.id, landingId]);
      const durableFacts = [sinceFact, approvalFact, landingFact, enteringForceFact];
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
      const makeProvider = (observedAt = f.now.value) => createPartTwoRegisterProvider({
        store: createFactStore(factContext, { owner: 'part-ten', read: () => JSON.parse(JSON.stringify(durableFacts)),
          append: () => f.success({ kind: 'local-durable' as const }) }),
        authority: { owner: 'part-two', vector: generation.vector,
          verifyVersionRow: () => f.success({ since: { owner: 'part-two', name: 'FactEnvelope', id: sinceId },
            approval, landing: { owner: 'part-two', name: 'FactEnvelope', id: landingId } }),
          verifyShapeChange: binding => f.success(JSON.stringify(binding) === JSON.stringify(expectedBinding)
            ? approval : { owner: 'part-two', name: 'FactEnvelope', id: 'missing:approval' }) },
        horizon: { lineages: { 'machine-a': { head: { epoch: 0, position: 3 }, observedAt, closed: false } }, stalenessBound: 100 },
        context: s.context, separations,
      });
      const provider = makeProvider();
      const first = build(root, candidate, { mode: 'normal', workflow: good, provider, now: 100, requireWorkflowSchema: true });
      const second = build(root, candidate, { mode: 'normal', workflow: good, provider: makeProvider(), now: 100, requireWorkflowSchema: true });
      expect(first.register.shape.parts).toContain(14);
      expect(first.outputs).toEqual(second.outputs); expect(first.generation).toEqual(second.generation);
      expect(() => build(root, candidate, { mode: 'normal', workflow: missing, provider, now: 100, requireWorkflowSchema: true })).toThrow('not committed');
      expect(() => build(root, candidate, { mode: 'normal', workflow: tampered, provider, now: 100, requireWorkflowSchema: true })).toThrow('bytes do not match');
      expect(() => build(root, candidate, { mode: 'normal', workflow: good, provider: makeProvider(-1), now: 100,
        requireWorkflowSchema: true })).toThrow('stale');
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60_000);
});
