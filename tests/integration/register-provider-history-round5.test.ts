import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { createFactStore, decodeVersion, walkVersions } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeExtract,
  generateAgainstParent, generationOf, loadRegister, readRegisterEntry } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { detail, json, setup, value } from '../register/fixtures.js';
import { generationRegistration, ownedSchema, vectorAt, versionSchema } from '../register/normal-provider-fixture.js';
import { realRepositoryLanding } from '../register/repository-landing-round11.js';

describe('round-five Part Two history answers', () => {
  it('P3-NF-21/23 expires an older extract horizon only after the newer entering-force bound', () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), 'instar-register-history-landing-'));
    try {
    const { base, commit: landingCommit, landing } = realRepositoryLanding(repositoryRoot);
    const f = factsFixture(), s = setup(), root = f.fact(), since = f.next(root);
    const content = s.declaration(), encoded = value(canonical(content)); f.capture(encoded.bytes, encoded.hash);
    const approval = f.authorize({ id: 'approval:v1', artifact: encoded.hash, base,
      action: { kind: 'merge', scope: f.scope } });
    const version = { id: 'store:v1', subject: 'store', content, contentHash: encoded.hash, since: since.id,
      supersedes: [], approvedIn: approval.id, base, landedIn: landingCommit };
    const baseContext = { ...f.ctx, facts: [root, since], grants: [{ factId: root.id, grant: f.g }],
      schemas: [f.schema, versionSchema('register-version-record', f.scope)] };
    const versionFact = f.next(since, { kind: 'register-version-record', body: { record: JSON.stringify(version) } }, baseContext);
    const vector = vectorAt(versionFact);
    const row = { id: 'store', version: version.id, status: 'live' as const, since: since.id, supersedes: [],
      approvedIn: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: approval.id },
      landedIn: landingCommit, base, contentHash: encoded.hash };
    const extract = value(decodeExtract(json('ChainExtract', { vector, rows: [row] }), s.context));
    const firstRegister = s.build([content], { extract });
    const firstGeneration = value(generationOf(firstRegister, s.context));
    const firstRecord = json('GenerationRecord', { generation: firstGeneration, at: f.now });
    const body = generationRegistration(firstRecord, s.context, f);
    const factContext = { ...baseContext, facts: [], schemas: [...baseContext.schemas,
      ownedSchema('generation-record', 'part-three', 'GenerationRecord', f.scope)], ownedBodies: [body] };
    const firstForce = f.next(versionFact, { kind: 'generation-record', body: { record: firstRecord } }, factContext);
    const records = [root, since, versionFact, firstForce];
    const lineages = { 'machine-a': { head: { epoch: 0, position: 3 }, observedAt: 100, closed: false } };
    const store = createFactStore(factContext, { owner: 'part-ten', read: () => records,
      append: () => f.success({ kind: 'local-durable' as const }) });
    const authority = createPartTwoRegisterAuthority({ facts: factContext, scope: f.scope, landing, context: s.context });
    const provider = createPartTwoRegisterProvider({ store, authority,
      horizon: { lineages, stalenessBound: 100 }, context: s.context });
    const loaded = value(loadRegister(firstRegister, firstGeneration, s.context, provider, f.now));

    const secondRegister = s.build([content], { commit: 'commit:2', extract: { ...extract, vector: vectorAt(firstForce) } });
    const secondGeneration = value(generationOf(secondRegister, s.context));
    const secondRecord = json('GenerationRecord', { generation: secondGeneration, at: f.clock(200) });
    const secondForce = f.next(firstForce, { kind: 'generation-record', at: f.clock(200), body: { record: secondRecord } }, factContext);
    records.push(secondForce); lineages['machine-a'].head.position = 4;

    lineages['machine-a'].observedAt = 300;
    expect(value(provider.isCurrent(vector, f.clock(300)))).toBe(true);
    expect(value(readRegisterEntry('store', loaded,
      { ...s.context, types: { ...s.context.types, now: f.clock(300) } })).declaration.id).toBe('store');

    for (const now of [301, 400]) {
      lineages['machine-a'].observedAt = now;
      expect(value(provider.isCurrent(vector, f.clock(now)))).toBe(false);
      const context = { ...s.context, types: { ...s.context.types, now: f.clock(now) } };
      expect(detail(readRegisterEntry('store', loaded, context))).toContain('must use loadRegister');
      expect(detail(generateAgainstParent({ ...s.input([content]), extract }, loaded, loaded.shape, null, provider, context)))
        .toContain('parent requires verified entering-force');
    }

    lineages['machine-a'].observedAt = 400;
    const latest = value(loadRegister(secondRegister, secondGeneration,
      { ...s.context, types: { ...s.context.types, now: f.clock(400) } }, provider, f.clock(400)));
    expect(value(readRegisterEntry('store', latest,
      { ...s.context, types: { ...s.context.types, now: f.clock(400) } })).declaration.id).toBe('store');
    } finally { rmSync(repositoryRoot, { recursive: true, force: true }); }
  });

  it('P3-NF-23 accepts Part Two identical-content replay collapse without inventing a conflict', () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), 'instar-register-replay-landing-'));
    try {
    const { base, commit: landingCommit, landing } = realRepositoryLanding(repositoryRoot);
    const f = factsFixture(), s = setup(), root = f.fact(), since = f.next(root);
    const content = s.declaration(), encoded = value(canonical(content)); f.capture(encoded.bytes, encoded.hash);
    const approval = f.authorize({ id: 'approval:v1', artifact: encoded.hash, base,
      action: { kind: 'merge', scope: f.scope } });
    const original = { id: 'store:v1', subject: 'store', content, contentHash: encoded.hash, since: since.id,
      supersedes: [], approvedIn: approval.id, base, landedIn: landingCommit };
    const replay = { ...original, id: 'store:v1-replayed' };
    const versionContext = { ...f.ctx, facts: [root, since], grants: [{ factId: root.id, grant: f.g }],
      schemas: [f.schema, versionSchema('register-version-record', f.scope)] };
    const decoded = value(decodeVersion(original, versionContext, f.scope, [], landing));
    const decodedReplay = value(decodeVersion(replay, versionContext, f.scope, [decoded], landing));
    expect(walkVersions([decoded, decodedReplay])).toMatchObject({ conflicts: [], duplicates: [replay.id] });
    const context = { ...versionContext, facts: [] };
    const first = f.next(since, { kind: 'register-version-record', body: { record: JSON.stringify(original) } }, context);
    const second = f.next(first, { kind: 'register-version-record', body: { record: JSON.stringify(replay) } }, context);
    const records = [root, since, first, second];
    const store = createFactStore(context, { owner: 'part-ten', read: () => records,
      append: () => f.success({ kind: 'local-durable' as const }) });
    const authority = createPartTwoRegisterAuthority({ facts: context, scope: f.scope, landing, context: s.context });
    const provider = createPartTwoRegisterProvider({ store, authority, horizon: { lineages: {
      'machine-a': { head: { epoch: 0, position: 3 }, observedAt: 100, closed: false },
    }, stalenessBound: 100 }, context: s.context });
    const row = { id: 'store', version: original.id, status: 'live' as const, since: since.id, supersedes: [],
      approvedIn: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: approval.id },
      landedIn: landingCommit, base, contentHash: encoded.hash };
    const extract = value(decodeExtract(json('ChainExtract', { vector: vectorAt(second), rows: [row] }), s.context));
    expect(value(provider.verifyExtract(extract))).toEqual(vectorAt(second));
    } finally { rmSync(repositoryRoot, { recursive: true, force: true }); }
  });
});
