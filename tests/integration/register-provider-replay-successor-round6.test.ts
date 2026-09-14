import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { createFactStore, decodeVersion, walkVersions } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeExtract } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { json, setup, value } from '../register/fixtures.js';
import { vectorAt, versionSchema } from '../register/normal-provider-fixture.js';
import { realRepositoryLanding } from '../register/repository-landing-round11.js';

describe('round-six replay alias continuity', () => {
  it('P3-NF-23 preserves a replay alias until a later approved successor has resolved it', () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), 'instar-register-successor-landing-'));
    try {
    const { base, commit: landingCommit, landing } = realRepositoryLanding(repositoryRoot);
    const f = factsFixture(), s = setup(), root = f.fact(), since = f.next(root);
    const content = s.declaration(), encoded = value(canonical(content));
    f.capture(encoded.bytes, encoded.hash);
    const approval = f.authorize({ id: 'approval:v1', artifact: encoded.hash, base,
      action: { kind: 'merge', scope: f.scope } });
    const original = { id: 'store:v1', subject: 'store', content, contentHash: encoded.hash, since: since.id,
      supersedes: [], approvedIn: approval.id, base, landedIn: landingCommit };
    const replay = { ...original, id: 'store:v1-replayed' };
    const nextContent = { ...content, requiredFacts: { ...content.requiredFacts, growth: 'compacts' } };
    const nextEncoded = value(canonical(nextContent));
    f.capture(nextEncoded.bytes, nextEncoded.hash);
    const nextApproval = f.authorize({ id: 'approval:v2', artifact: nextEncoded.hash, base,
      action: { kind: 'merge', scope: f.scope } });
    const versionContext = { ...f.ctx, facts: [root, since], grants: [{ factId: root.id, grant: f.g }],
      schemas: [f.schema, versionSchema('register-version-record', f.scope)] };
    const decodedOriginal = value(decodeVersion(original, versionContext, f.scope, [], landing));
    const decodedReplay = value(decodeVersion(replay, versionContext, f.scope, [decodedOriginal], landing));
    const factContext = { ...versionContext, facts: [] };
    const first = f.next(since, { kind: 'register-version-record', body: { record: JSON.stringify(original) } }, factContext);
    const second = f.next(first, { kind: 'register-version-record', body: { record: JSON.stringify(replay) } }, factContext);
    const successor = { ...original, id: 'store:v2', content: nextContent, contentHash: nextEncoded.hash,
      since: second.id, supersedes: [replay.id], approvedIn: nextApproval.id };
    const decodedSuccessor = value(decodeVersion(successor, { ...versionContext, facts: [root, since, first, second] },
      f.scope, [decodedOriginal, decodedReplay], landing));
    expect(walkVersions([decodedOriginal, decodedReplay, decodedSuccessor])).toMatchObject({
      current: [{ id: successor.id }], conflicts: [], duplicates: [replay.id],
    });
    const third = f.next(second, { kind: 'register-version-record', body: { record: JSON.stringify(successor) } }, factContext);
    const records = [root, since, first, second, third];
    const store = createFactStore(factContext, { owner: 'part-ten', read: () => records,
      append: () => f.success({ kind: 'local-durable' as const }) });
    const authority = createPartTwoRegisterAuthority({ facts: factContext, scope: f.scope, landing, context: s.context });
    const provider = createPartTwoRegisterProvider({ store, authority, horizon: { lineages: {
      'machine-a': { head: { epoch: 0, position: 4 }, observedAt: 100, closed: false },
    }, stalenessBound: 100 }, context: s.context });
    const rows = [{ id: 'store', version: original.id, status: 'superseded' as const, since: since.id, supersedes: [],
      approvedIn: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: approval.id },
      landedIn: landingCommit, base, contentHash: encoded.hash },
    { id: 'store', version: successor.id, status: 'live' as const, since: second.id, supersedes: [original.id],
      approvedIn: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: nextApproval.id },
      landedIn: landingCommit, base, contentHash: nextEncoded.hash }];
    const extract = value(decodeExtract(json('ChainExtract', { vector: vectorAt(third), rows }), s.context));
    expect(value(provider.verifyExtract(extract))).toEqual(vectorAt(third));
    } finally { rmSync(repositoryRoot, { recursive: true, force: true }); }
  });
});
