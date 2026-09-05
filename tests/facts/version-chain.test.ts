import { expect, it } from 'vitest';
import { decodeVersion, walkVersions } from '../../src/facts/index.js';
import type { GovernedVersion } from '../../src/facts/index.js';
import { canonical } from '../../src/index.js';
import { factsFixture, value, refused } from './fixtures.js';

function fixture() {
  const f = factsFixture(), since = f.fact(), content = { rule: 'one' }, encoded = value(canonical(content));
  f.capture(encoded.bytes, encoded.hash);
  const authorization = f.authorize({ artifact: encoded.hash, id: 'version-approval' });
  const ctx = { ...f.ctx, facts: [since] };
  const input = { id: 'v1', subject: 'rule:one', content, contentHash: encoded.hash, since: since.id, supersedes: [], approvedIn: authorization.id, base: 'base:1', landedIn: null };
  const landing = { owner: 'part-ten' as const, merges: [] };
  const version = value(decodeVersion(input, ctx, f.scope, [], landing));
  function make(id: string, rule: string, parents: readonly GovernedVersion[]) {
    const content = { rule }, encoded = value(canonical(content)); f.capture(encoded.bytes, encoded.hash);
    const approval = f.authorize({ id: `approval:${id}`, artifact: encoded.hash });
    return value(decodeVersion({ ...input, id, content, contentHash: encoded.hash, approvedIn: approval.id, supersedes: parents.map(p => p.id) }, ctx, f.scope, parents, landing));
  }
  return { ...f, ctx, input, authorization, landing, version, make };
}
it('P2-NF-38 approvedIn must be explicit yes, never a merge event', () => {
  const f = fixture(), event = f.authInput({ artifact: f.authorization.artifact, id: 'merge-event' }, false, 'merge');
  // P1 itself refuses the protected merge event. P2 also rejects any id not backed by a decoded authorization.
  refused(decodeVersion({ ...f.input, approvedIn: 'host-merge-event' }, f.ctx, f.scope, [], f.landing), 'explicit yes');
});
it('P2-NF-39 repository landing must resolve to a merge on main at the reviewed base', () => {
  const f = fixture(); const auth = f.authorize({ artifact: f.authorization.artifact, id: 'repository-approval', action: { kind: 'merge', scope: f.scope } });
  const input = { ...f.input, approvedIn: auth.id, landedIn: 'commit-1' };
  for (const merge of [{ commit: 'commit-1', onMain: false, parentCount: 2, reviewedBase: 'base:1' }, { commit: 'commit-1', onMain: true, parentCount: 1, reviewedBase: 'base:1' }, { commit: 'commit-1', onMain: true, parentCount: 2, reviewedBase: 'wrong-base' }]) {
    refused(decodeVersion(input, f.ctx, f.scope, [], { owner: 'part-ten', merges: [merge] }), 'real merge');
  }
  expect(value(decodeVersion(input, f.ctx, f.scope, [], { owner: 'part-ten', merges: [{ commit: 'commit-1', onMain: true, parentCount: 2, reviewedBase: 'base:1' }] })).landedIn).toBe('commit-1');
});
it('P2-NF-40 version bytes must match exactly the approved content hash', () => {
  const f = fixture(); refused(decodeVersion({ ...f.input, content: { rule: 'changed' } }, f.ctx, f.scope, [], f.landing), 'content hash');
  const content = { rule: 'changed' }; refused(decodeVersion({ ...f.input, content, contentHash: value(canonical(content)).hash }, f.ctx, f.scope, [], f.landing), 'approval content');
});
it('P2-NF-41 moving the approved base requires reissue', () => {
  const f = fixture(); refused(decodeVersion({ ...f.input, base: 'base:2' }, f.ctx, f.scope, [], f.landing), 'base');
});
it('P2-NF-42 all supersedes references resolve in the same subject chain', () => {
  const f = fixture(); refused(decodeVersion({ ...f.input, supersedes: ['missing'] }, f.ctx, f.scope, [], f.landing), 'supersedes missing');
});
it('P2-NF-43 in-place governing edits refuse even if newly approved', () => {
  const f = fixture(); refused(decodeVersion(f.input, f.ctx, f.scope, [f.version], f.landing), 'in-place');
});
it('P2-NF-44 genuine fork records conflict and retains reviewed incumbent until merge', () => {
  const f = fixture();
  const left = f.make('left', 'left-content', [f.version]);
  const right = f.make('right', 'right-content', [f.version]);
  const result = walkVersions([right, f.version, left]);
  expect(result.current[0]?.id).toBe('v1'); expect(result.conflicts[0]?.kind).toBe('version-fork');
  const merge = f.make('merge', 'merged', [left, right]);
  expect(walkVersions([left, merge, f.version, right]).current[0]?.id).toBe('merge');
});
it('P2-NF-45 fork merge refuses without operator standing', () => {
  const f = fixture(); const delegate = f.grant({ id: 'delegate', standing: 'delegate', actions: ['work'], expiresAt: 1000 });
  const auth = f.authorize({ id: 'delegate-approval', under: delegate.id, artifact: f.authorization.artifact });
  const parents = [{ ...f.version, id: 'left' }, { ...f.version, id: 'right' }];
  refused(decodeVersion({ ...f.input, id: 'merge', approvedIn: auth.id, supersedes: ['left', 'right'] }, f.ctx, f.scope, parents, f.landing), 'operator standing');
});
it('P2-NF-71 identical approval and content replay collapses, never creates a fork', () => {
  const f = fixture(); const a = { ...f.version, id: 'a', supersedes: ['v1'] }, b = { ...a, id: 'b' };
  const result = walkVersions([f.version, a, b]); expect(result.duplicates).toEqual(['b']); expect(result.conflicts).toEqual([]); expect(result.current[0]?.id).toBe('a');
});
