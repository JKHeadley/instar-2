import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { build } from '../../scripts/build-register.mjs';
import { canonical, decode } from '../../src/index.js';
import { createFactStore, factId } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeGeneration } from '../../src/register/index.js';
import type { FactReference, ShapeChangeBinding } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { hash, json, setup, value } from '../register/fixtures.js';
import { generationRegistration, ownedSchema, versionSchema } from '../register/normal-provider-fixture.js';
import { realRepositoryLanding } from '../register/repository-landing-round11.js';

const emittedModule = '../../dist/index.js';
const { decode: emittedDecode } = await import(emittedModule) as typeof import('../../src/index.js');

export function rosterOnlyEnrollmentFixture(signInvalidDocument = false) {
    const root = mkdtempSync(join(tmpdir(), 'instar-register-roster-only-'));
    try {
      for (const path of ['docs', 'generated', 'src', 'tests', 'register-source', 'package.json', 'tsconfig.json'])
        cpSync(path, join(root, path), { recursive: true });
      const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture',
        '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      const conversionPath = join(root, 'generated/conversion.json');
      const conversion = JSON.parse(readFileSync(conversionPath, 'utf8'));
      for (const source of conversion.sources) if (source.declaration.requiredFacts.number)
        Object.assign(source.declaration.requiredFacts, { deadline: 4_000_000_000_000,
          owner: 'fixture-operator', overdueAction: 'surface' });
      writeFileSync(conversionPath, JSON.stringify(conversion));
      const { base: ownerBase, commit: landingId, landing } = realRepositoryLanding(root);
      let parentCommit = git('rev-parse', 'HEAD');
      const parentRegister = JSON.parse(readFileSync(join(root, 'generated/register.json'), 'utf8'));
      const parentSource = JSON.parse(readFileSync(join(root, 'generated/source.json'), 'utf8'));
      const s = setup(), f = factsFixture();

      const shapePath = join(root, 'register-source/bootstrap-shape.json');
      const shape = JSON.parse(readFileSync(shapePath, 'utf8'));
      shape.parts.push(14); parentRegister.shape.parts.push(14);
      writeFileSync(shapePath, JSON.stringify(shape, null, 2) + '\n');
      mkdirSync(join(root, 'tests/sentinel-holders'), { recursive: true });
      writeFileSync(join(root, 'tests/e2e/sentinel-holders.test.ts'), '// P14-NF-50 enrolled build fixture\n');
      writeFileSync(join(root, 'tests/sentinel-holders/core.test.ts'), '// part fourteen CI probe fixture\n');
      const manifest = { schemaVersion: 1, owner: 'part-fourteen',
        fixtures: [{ id: 'P14-NF-50', stage: 'build', artifact: { path: 'tests/e2e/sentinel-holders.test.ts',
          hash: hash('// P14-NF-50 enrolled build fixture\n') } }],
        probes: [{ id: 'sentinel-holders.package-loop-policy.probe', cadence: 60_000, execution: 'ci',
          artifact: { path: 'tests/sentinel-holders/core.test.ts', hash: hash('// part fourteen CI probe fixture\n') } }],
        decoders: [], documents: [] };
      const manifestPath = 'register-source/owner-references/part-fourteen.json';
      writeFileSync(join(root, manifestPath), JSON.stringify(manifest, null, 2) + '\n');
      const enrollment = { part: 14, owner: 'part-fourteen', manifest: { path: manifestPath, hash: hash(manifest) } };
      writeFileSync(join(root, 'register-source/owner-enrollments.json'),
        JSON.stringify({ schemaVersion: 1, enrollments: [enrollment] }, null, 2) + '\n');
      const rootId = factId({ machine: 'machine-a', epoch: 0, position: 0 });
      const sinceId = factId({ machine: 'machine-a', epoch: 0, position: 1 });
      const anchorId = factId({ machine: 'machine-a', epoch: 0, position: 2 });
      const approval: FactReference = { owner: 'part-two', name: 'FactEnvelope', id: 'approval:shape:v1' };
      const documentPath = 'register-source/shape-changes/part-fourteen.json';
      mkdirSync(join(root, 'register-source/shape-changes'), { recursive: true });
      const document = { type: 'ShapeChangeDocument', schemaVersion: 1, id: 'part-fourteen-owner-enrollment',
        parent: parentSource.generation, candidateShape: hash(shape),
        changes: [{ operation: 'add', path: `/parts/${parentRegister.shape.parts.length}`, after: 14 }],
        ownerReferences: [enrollment], approvedIn: approval };
      writeFileSync(join(root, documentPath), JSON.stringify(document, null, 2) + '\n');

      const ownerVersions: Record<string, unknown>[] = [];
      const ownerRows = parentRegister.entries
        .filter((entry: { declaration: { kind: string } }) => entry.declaration.kind === 'governed documents')
        .map(({ declaration }: { declaration: Record<string, unknown> }) => {
          const { declaredBy: _site, ...authored } = declaration;
          const encoded = value(canonical(authored)); f.capture(encoded.bytes, encoded.hash);
          const approved = f.authorize({ id: 'approval:' + declaration.id, artifact: encoded.hash, base: ownerBase,
            action: { kind: 'merge', scope: f.scope } });
          ownerVersions.push({ id: 'fixture-approved:' + declaration.id, subject: declaration.id, content: authored,
            contentHash: encoded.hash, since: sinceId, supersedes: [], approvedIn: approved.id,
            landedIn: landingId, base: ownerBase });
          return { id: declaration.id, version: 'fixture-approved:' + declaration.id, status: 'live', since: sinceId,
            supersedes: [], approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: approved.id },
            landedIn: landingId, base: ownerBase, contentHash: hash(authored) };
        });
      const vectorId = factId({ machine: 'machine-a', epoch: 0, position: 2 + ownerVersions.length });
      parentRegister.extract = { ...parentRegister.extract,
        vector: { owner: 'part-two', name: 'FactPositionVector', id: vectorId }, rows: ownerRows };
      parentRegister.entries = parentRegister.entries.map((entry: Record<string, unknown>) => {
        const declaration = entry.declaration as { id: string };
        const row = ownerRows.find((candidate: { id: string }) => candidate.id === declaration.id);
        return row ? { ...entry, since: row.since, supersedes: row.supersedes, approvedIn: row.approvedIn,
          landedIn: row.landedIn, base: row.base, history: [row] } : entry;
      });
      parentSource.generation = hash(parentRegister); document.parent = parentSource.generation;
      writeFileSync(join(root, documentPath), JSON.stringify(document, null, 2) + '\n');
      writeFileSync(join(root, 'generated/register.json'), JSON.stringify(parentRegister));
      writeFileSync(join(root, 'generated/source.json'), JSON.stringify(parentSource));
      git('add', 'generated/register.json', 'generated/source.json', manifestPath,
        'register-source/owner-enrollments.json', documentPath, 'register-source/bootstrap-shape.json',
        'tests/e2e/sentinel-holders.test.ts', 'tests/sentinel-holders/core.test.ts');
      git('commit', '-qm', 'parent roster and unapproved enrollment');
      parentCommit = git('rev-parse', 'HEAD');
      const workflow = { type: 'RegisterWorkflow', schemaVersion: 1, mode: 'normal', branch: 'fixture-roster-only',
        parent: { commit: parentCommit, register: 'generated/register.json', source: 'generated/source.json',
          conversion: 'generated/conversion.json' }, extract: parentRegister.extract, runs: [],
        catalog: { fixtures: [], probes: [], sentinels: [], semanticReviews: [] }, landedParts: [], references: [],
        claims: shape.kinds.map((kind: { name: string }) => ({ kind: kind.name, complete: false })), instances: {} };
      mkdirSync(join(root, 'register-source/workflows'), { recursive: true });
      writeFileSync(join(root, 'register-source/workflows/roster-only.json'), JSON.stringify(workflow, null, 2) + '\n');
      git('add', '.'); git('commit', '-qm', 'candidate normal build'); const candidate = git('rev-parse', 'HEAD');

      Object.assign(s.f.ctx.register, { entries: [...new Set([...s.f.ctx.register.entries, 'build-machine',
        ...parentRegister.entries.map((entry: { declaration: { id: string } }) => entry.declaration.id)])],
        producers: [...new Set([...s.f.ctx.register.producers, 'register.generator'])] });
      const generation = value(decodeGeneration({ type: 'RegisterGeneration', schemaVersion: 1,
        id: parentSource.generation, commit: parentSource.commit, vector: parentRegister.extract.vector }, s.context));
      const generationRecord = JSON.parse(JSON.stringify(json('GenerationRecord', { generation, at: f.now })));
      const registration = generationRegistration(generationRecord, s.context, f);
      const factContext = { ...f.ctx, facts: [], schemas: [f.schema,
        versionSchema('register-version-record', f.scope), versionSchema('register-shape-version-record', f.scope),
        ownedSchema('generation-record', 'part-three', 'GenerationRecord', f.scope)], ownedBodies: [registration] };
      const rootFact = f.fact({}, factContext), sinceFact = f.next(rootFact, {}, factContext);
      const anchorFact = f.next(sinceFact, {}, factContext);
      expect([rootFact.id, sinceFact.id, anchorFact.id]).toEqual([rootId, sinceId, anchorId]);
      const principal = (id: string, kind: 'person' | 'system') => {
        const proof = s.f.proof({ id, kind }, { id, kind }, 'identity');
        return value((emittedDecode as unknown as typeof decode)('VerifiedPrincipal', json('VerifiedPrincipal', { id, kind }),
          { ...s.f.ctx, provenance: value((emittedDecode as unknown as typeof decode)('Provenance', proof.input, s.f.ctx)) }));
      };
      const writer = principal('alice', 'person'), executor = principal('fixture-executor', 'system');
      const separations = parentSource.authorityPrerequisites.map(({ site, record }: { site: string; record: string }) => ({
        site, record, execution: { principal: executor, grants: s.f.grants, revocations: [], scope: s.f.scope, now: s.f.now },
        writer, scope: s.f.scope, action: 'work' }));
      let previous = anchorFact;
      const versionFacts = ownerVersions.map(version => {
        const fact = f.next(previous, { kind: 'register-version-record', body: { record: JSON.stringify(version) } }, factContext);
        previous = fact; return fact;
      });
      expect(previous.id).toBe(vectorId);
      let invalidShapeVersionFact: typeof previous | undefined;
      if (signInvalidDocument) {
        const binding: ShapeChangeBinding = { parent: document.parent, candidateShape: document.candidateShape,
          document: { path: documentPath, hash: hash(document) }, approval };
        const encoded = value(canonical(binding)); f.capture(encoded.bytes, encoded.hash);
        const signedApproval = f.authorize({ id: approval.id, artifact: encoded.hash, base: parentCommit });
        const shapeVersion = { id: 'shape:invalid-retained-introduction', subject: 'register-shape:part-fourteen',
          content: binding, contentHash: encoded.hash, since: sinceId, supersedes: [], approvedIn: signedApproval.id,
          base: parentCommit, landedIn: null };
        invalidShapeVersionFact = f.next(previous,
          { kind: 'register-shape-version-record', body: { record: JSON.stringify(shapeVersion) } }, factContext);
        previous = invalidShapeVersionFact;
      }
      const enteringForceFact = f.next(previous, { kind: 'generation-record', body: { record: generationRecord } }, factContext);
      const durableFacts = [rootFact, sinceFact, anchorFact, ...versionFacts,
        ...(invalidShapeVersionFact ? [invalidShapeVersionFact] : []), enteringForceFact];
      const provider = createPartTwoRegisterProvider({ store: createFactStore(factContext, { owner: 'part-ten',
        read: () => JSON.parse(JSON.stringify(durableFacts)), append: () => f.success({ kind: 'local-durable' as const }) }),
        authority: createPartTwoRegisterAuthority({ facts: { ...factContext, grants: [{ factId: rootFact.id, grant: f.g }] },
          scope: f.scope, landing, context: s.context }),
        horizon: { lineages: { 'machine-a': { head: { epoch: 0, position: enteringForceFact.segment.position },
          observedAt: 100, closed: false } }, stalenessBound: 100 }, context: s.context, separations });

      const invoke = () => build(root, candidate, { mode: 'normal', workflow, provider, now: 100, requireWorkflowSchema: true });
      if (signInvalidDocument) return invoke();
      expect(invoke).toThrow('P3-NF-09: no unique current governed version approves this exact shape change');
      return undefined;
    } finally { rmSync(root, { recursive: true, force: true }); }
}

describe.skip('round-eight normal build roster-only enrollment regression SKIPPED: HELD-BY-SCOPE:SEAM-LEDGER-row-124', () => {
  it('P3-NF-09 refuses a manifest tuple with no signed enrollment approval although the witnessed parent roster contains its part', () => {
    rosterOnlyEnrollmentFixture();
  }, 60_000);
});
