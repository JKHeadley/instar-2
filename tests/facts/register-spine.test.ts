import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import type { Authorization, Json } from '../../src/index.js';
import { createRegisterSpine, decodeVersion, extractGovernedChain, governingRecordBody, governingRecordKind, positionVector } from '../../src/facts/index.js';
import type { GoverningRecordRole } from '../../src/facts/index.js';
import type { GovernedVersion, RecordedVersion } from '../../src/facts/index.js';
import { factsFixture, value, refused } from './fixtures.js';

type Row = { id: string; version: string; status: string; since: string; supersedes: readonly string[];
  approvedIn: { owner: string; name: string; id: string }; landedIn: string; base: string; contentHash: string };
const rowsOf = (extract: Json) => (extract as unknown as { rows: readonly Row[] }).rows;
const vectorOf = (extract: Json) => (extract as unknown as { vector: { id: string } }).vector;

function spineFixture() {
  const f = factsFixture();
  const chain = [f.fact()];
  const ctx = { ...f.ctx, schemas: [...f.ctx.schemas, f.governingSchema], facts: chain, grants: [{ factId: chain[0]!.id, grant: f.g }] };
  const append = () => { const next = f.next(chain[chain.length - 1]!, {}, ctx); chain.push(next); return next; };
  const record = (role: GoverningRecordRole, payload: unknown) => {
    const next = f.next(chain[chain.length - 1]!, { kind: governingRecordKind, body: governingRecordBody(role, payload) }, ctx);
    chain.push(next); return next;
  };
  const landing = { owner: 'part-ten' as const, merges: [{ commit: 'merge-1', onMain: true, parentCount: 2, reviewedBase: 'base:1' }] };
  // One governing version: its content is the authored entry, approved by a verified explicit
  // yes, landed on a real merge. Each of those things is a recorded fact whose body records it.
  function version(id: string, content: Json, supersedes: readonly GovernedVersion[] = [],
    overrides: Record<string, unknown> = {}, approvalOverrides: Record<string, unknown> = {}): RecordedVersion {
    const encoded = value(canonical(content)); f.capture(encoded.bytes, encoded.hash);
    const since = append();
    const approval = f.authorize({ id: `approval:${id}`, artifact: encoded.hash, action: { kind: 'merge', scope: f.scope }, ...approvalOverrides });
    approvals.push({ factId: record('approval', approval).id, authorizationId: approval.id });
    const decoded = value(decodeVersion({ id, subject: 'store', content, contentHash: encoded.hash, since: since.id,
      supersedes: supersedes.map(v => v.id), approvedIn: approval.id, base: 'base:1', landedIn: 'merge-1', ...overrides },
    ctx, f.scope, supersedes, landing));
    return { factId: record('version', decoded).id, version: decoded };
  }
  const approvals: { factId: string; authorizationId: string }[] = [];
  const first = version('v1', { id: 'store', body: 'one' });
  const generations: { factId: string; record: Json }[] = [];
  function anchorGeneration(vector: string, at: number, id = `sha256:${'a'.repeat(64)}`) {
    const generationRecord = { type: 'GenerationRecord', schemaVersion: 1, at: f.clockRaw(at),
      generation: { type: 'RegisterGeneration', schemaVersion: 1, id, commit: 'commit:1',
        vector: { owner: 'part-two', name: 'FactPositionVector', id: vector } } } as unknown as Json;
    generations.push({ factId: record('generation', generationRecord).id, record: generationRecord });
    return generationRecord;
  }
  const spine = (versions: readonly RecordedVersion[] = [first], bound = 1000) =>
    ({ anchor: chain[0]!.id, versions, approvals, generations, stalenessBoundMs: bound });
  return { f, ctx, chain, landing, version, first, approvals, generations, anchorGeneration, spine, append, record };
}

it('extraction derives approved history from the verified spine, not from git ancestry or a merge', () => {
  const s = spineFixture();
  const extraction = value(extractGovernedChain(s.spine(), s.ctx));
  const rows = rowsOf(extraction.extract);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.status).toBe('live');
  expect(rows[0]!.id).toBe('store');
  expect(rows[0]!.landedIn).toBe('merge-1');
  // The approval anchor is the fact that recorded the explicit yes, never the merge commit.
  expect(rows[0]!.approvedIn).toEqual({ owner: 'part-two', name: 'FactEnvelope', id: s.approvals[0]!.factId });
  expect(rows[0]!.approvedIn.id).not.toBe(rows[0]!.landedIn);
  expect(extraction.position).toBe(s.first.factId);
  expect(vectorOf(extraction.extract).id).toBe(positionVector([s.first.factId]));
  expect(extraction.conflicts).toEqual([]);
  // The empty position is the genesis anchor and extracts nothing.
  const genesis = value(extractGovernedChain(s.spine(), s.ctx, 0));
  expect(rowsOf(genesis.extract)).toEqual([]);
  expect(genesis.position).toBe(s.chain[0]!.id);
});
it('P2-NF-38 extraction refuses a version whose explicit yes is unrecorded or is a merge event', () => {
  const s = spineFixture();
  refused(extractGovernedChain({ ...s.spine(), approvals: [] }, s.ctx), 'explicit-yes record not recorded');
  const authorization = s.first.version.approvedIn;
  const asMerge = { ...authorization, explicitYes: { ...authorization.explicitYes,
    authenticated: { ...authorization.explicitYes.authenticated, recordType: 'merge' } } } as Authorization;
  // Each forged version is recorded by its own fact, so the refusal is the approval's, not the binding's.
  const recorded = (version: GovernedVersion): RecordedVersion => ({ factId: s.record('version', version).id, version });
  refused(extractGovernedChain({ ...s.spine([recorded({ ...s.first.version, approvedIn: asMerge })]) }, s.ctx), 'never a merge event');
  const attested = { ...authorization, explicitYes: { ...authorization.explicitYes, class: 'channel-attested' } } as Authorization;
  refused(extractGovernedChain({ ...s.spine([recorded({ ...s.first.version, approvedIn: attested })]) }, s.ctx), 'verified explicit yes');
});
it('P2-NF-39 a register row needs a repository landing, and every anchor must be a recorded fact', () => {
  const s = spineFixture();
  const landless = { ...s.first.version, landedIn: null };
  const runtime = { factId: s.record('version', landless).id, version: landless };
  refused(extractGovernedChain(s.spine([runtime]), s.ctx), 'repository landing');
  refused(extractGovernedChain(s.spine([{ ...s.first, factId: 'fact:never-appended' }]), s.ctx), 'version fact not recorded');
  refused(extractGovernedChain({ ...s.spine(), approvals: [{ factId: 'fact:never-appended', authorizationId: s.first.version.approvedIn.id }] },
    s.ctx), 'explicit-yes record not recorded');
});
it('P2-NF-44 a governing fork extracts the incumbent and reports the conflict instead of wedging', () => {
  const s = spineFixture();
  const left = s.version('left', { id: 'store', body: 'left' }, [s.first.version]);
  const right = s.version('right', { id: 'store', body: 'right' }, [s.first.version]);
  const extraction = value(extractGovernedChain(s.spine([s.first, left, right]), s.ctx));
  expect(rowsOf(extraction.extract).map(r => r.version)).toEqual(['v1']);
  expect(rowsOf(extraction.extract)[0]!.status).toBe('live');
  expect(extraction.conflicts.map(c => c.kind)).toEqual(['version-fork']);
});
it('P2-NF-71 an identical-content identical-approval replay collapses to one extracted row', () => {
  const s = spineFixture();
  const replayed = { ...s.first.version, id: 'v1-replay' };
  const replay = { factId: s.record('version', replayed).id, version: replayed };
  const extraction = value(extractGovernedChain(s.spine([s.first, replay]), s.ctx));
  expect(rowsOf(extraction.extract).map(r => r.version)).toEqual(['v1']);
  expect(extraction.conflicts).toEqual([]);
});
it('P2-NF-71 an exact same-id replay recorded by a second fact keeps its one history row', () => {
  const s = spineFixture();
  const replay = { factId: s.record('version', s.first.version).id, version: s.first.version };
  const extraction = value(extractGovernedChain(s.spine([s.first, replay]), s.ctx));
  expect(rowsOf(extraction.extract).map(r => [r.version, r.status])).toEqual([['v1', 'live']]);
  expect(extraction.conflicts).toEqual([]);
});
it('Rules 26/90 a recorded fact id is not proof of a payload that fact never recorded', () => {
  const s = spineFixture();
  // Control: the same spine with every association recorded by its own fact is accepted.
  value(extractGovernedChain(s.spine(), s.ctx));
  const note = s.append();
  refused(extractGovernedChain(s.spine([{ ...s.first, factId: note.id }]), s.ctx), 'does not record this version');
  refused(extractGovernedChain({ ...s.spine(), approvals: [{ factId: note.id, authorizationId: s.first.version.approvedIn.id }] },
    s.ctx), 'does not record this approval');
  // A governing record of a different payload is no better than an unrelated note.
  const other = s.version('other', { id: 'store', body: 'other' });
  refused(extractGovernedChain(s.spine([{ ...s.first, factId: other.factId }]), s.ctx), 'does not record this version');
  const extraction = value(extractGovernedChain(s.spine(), s.ctx));
  const record = s.anchorGeneration(extraction.vector, 100);
  s.generations[0] = { factId: note.id, record };
  const port = createRegisterSpine(s.spine(), s.ctx, r => s.f.success(r));
  refused(port.enteringForce((record as unknown as { generation: Json }).generation), 'does not record this generation');
  refused(port.isCurrent({ owner: 'part-two', name: 'FactPositionVector', id: extraction.vector }, s.f.clock(100)), 'does not record this generation');
});
it('the empty position rests on the recorded genesis fact, never an invented or later anchor', () => {
  const s = spineFixture();
  for (const anchor of ['fact:never-recorded', s.first.factId]) {
    refused(extractGovernedChain({ ...s.spine(), anchor }, s.ctx, 0), 'not a recorded genesis fact');
    const genesis = value(extractGovernedChain(s.spine(), s.ctx, 0));
    const port = createRegisterSpine({ ...s.spine(), anchor }, s.ctx, r => s.f.success(r));
    refused(port.verifyExtract(genesis.extract), 'not a recorded genesis fact');
  }
});
it('a superseding version marks its parent superseded and a retired head stays retired', () => {
  const s = spineFixture();
  const second = s.version('v2', { id: 'store', body: 'two', status: 'retired' }, [s.first.version]);
  const rows = rowsOf(value(extractGovernedChain(s.spine([s.first, second]), s.ctx)).extract);
  expect(rows.map(r => [r.version, r.status])).toEqual([['v1', 'superseded'], ['v2', 'retired']]);
  expect(rows[1]!.supersedes).toEqual(['v1']);
});
it('the provider verifies an extract at its own position and refuses a doctored or unknown one', () => {
  const s = spineFixture();
  const extraction = value(extractGovernedChain(s.spine(), s.ctx));
  const port = createRegisterSpine(s.spine(), s.ctx, record => s.f.success(record));
  expect(value(port.verifyExtract(extraction.extract))).toEqual({ owner: 'part-two', name: 'FactEnvelope', id: s.first.factId });
  const doctored = { ...(extraction.extract as unknown as object),
    rows: [{ ...rowsOf(extraction.extract)[0]!, landedIn: 'merge-invented' }] };
  refused(port.verifyExtract(doctored), 'differs from the verified chain');
  refused(port.verifyExtract({ ...(extraction.extract as unknown as object),
    vector: { owner: 'part-two', name: 'FactPositionVector', id: 'vector:invented' } }), 'no recorded spine position');
  // The empty position is verifiable too, and it is a different position.
  const genesis = value(extractGovernedChain(s.spine(), s.ctx, 0));
  expect(value(port.verifyExtract(genesis.extract))).toEqual({ owner: 'part-two', name: 'FactEnvelope', id: s.chain[0]!.id });
});
it('entering force is a lookup against recorded generation facts, never a minted hash', () => {
  const s = spineFixture();
  const extraction = value(extractGovernedChain(s.spine(), s.ctx));
  const record = s.anchorGeneration(extraction.vector, 100);
  const port = createRegisterSpine(s.spine(), s.ctx, r => s.f.success(r));
  const generation = (record as unknown as { generation: Json }).generation;
  expect(value(port.enteringForce(generation))).toEqual(record);
  refused(port.enteringForce({ ...(generation as unknown as object), id: `sha256:${'b'.repeat(64)}` }), 'no entering-force record');
});
it('vector currency answers from recorded entering-force positions and its declared bound', () => {
  const s = spineFixture();
  const head = value(extractGovernedChain(s.spine(), s.ctx));
  const genesis = value(extractGovernedChain(s.spine(), s.ctx, 0));
  const vector = (id: string) => ({ owner: 'part-two', name: 'FactPositionVector', id });
  const unanchored = createRegisterSpine(s.spine(), s.ctx, r => s.f.success(r));
  refused(unanchored.isCurrent(vector(head.vector), s.f.now), 'no entering-force record');
  s.anchorGeneration(genesis.vector, 50);
  s.anchorGeneration(head.vector, 100);
  const port = createRegisterSpine(s.spine(), s.ctx, r => s.f.success(r));
  expect(value(port.isCurrent(vector(head.vector), s.f.clock(100)))).toBe(true);
  expect(value(port.isCurrent(vector(genesis.vector), s.f.clock(100)))).toBe(true);
  const tight = createRegisterSpine(s.spine([s.first], 10), s.ctx, r => s.f.success(r));
  expect(value(tight.isCurrent(vector(genesis.vector), s.f.clock(100)))).toBe(false);
  expect(value(tight.isCurrent(vector(head.vector), s.f.clock(100)))).toBe(true);
  refused(port.isCurrent(vector('vector:invented'), s.f.clock(100)), 'no recorded entering-force position');
  refused(port.isCurrent({ owner: 'part-three', name: 'FactPositionVector', id: head.vector }, s.f.clock(100)), 'part-two fact-position vector');
  refused(port.isCurrent(vector(head.vector), s.f.clock(50)), 'newer than the consuming clock');
});
