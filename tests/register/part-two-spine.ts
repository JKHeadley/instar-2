// A real part-two spine for part-three consumers: recorded facts, verified explicit-yes
// approvals and real landings. It approves nothing — each fixture supplies its own content,
// and every anchor below is a fact this fixture actually appended, whose signed body records
// the exact approval, version or generation it anchors.
import { canonical } from '../../src/index.js';
import type { Json, Result } from '../../src/index.js';
import { createRegisterSpine, decodeVersion, extractGovernedChain, governingRecordBody, governingRecordKind } from '../../src/facts/index.js';
import type { GoverningRecordRole } from '../../src/facts/index.js';
import type { ChainExtraction, GoverningSpine, RecordedApproval, RecordedGeneration, RecordedVersion } from '../../src/facts/index.js';
import { factsFixture, value } from '../facts/fixtures.js';

/** `base` is what the approvals were reviewed against: the consuming register's source commit. */
export function partTwoSpine(entries: readonly { readonly id: string; readonly content: unknown }[], base = 'commit:1') {
  const f = factsFixture();
  const chain = [f.fact()];
  const ctx = { ...f.ctx, schemas: [...f.ctx.schemas, f.governingSchema], facts: chain, grants: [{ factId: chain[0]!.id, grant: f.g }] };
  const append = () => { const next = f.next(chain[chain.length - 1]!, {}, ctx); chain.push(next); return next; };
  const record = (role: GoverningRecordRole, payload: unknown) => {
    const next = f.next(chain[chain.length - 1]!, { kind: governingRecordKind, body: governingRecordBody(role, payload) }, ctx);
    chain.push(next); return next;
  };
  const landing = { owner: 'part-ten' as const, merges: [{ commit: 'merge-1', onMain: true, parentCount: 2, reviewedBase: base }] };
  const approvals: RecordedApproval[] = [];
  const generations: RecordedGeneration[] = [];
  const versions: RecordedVersion[] = [];
  for (const entry of entries) {
    const content = entry.content as Json;
    const encoded = value(canonical(content)); f.capture(encoded.bytes, encoded.hash);
    const since = append();
    const approval = f.authorize({ id: `approval:${entry.id}`, artifact: encoded.hash, base, action: { kind: 'merge', scope: f.scope } });
    approvals.push({ factId: record('approval', approval).id, authorizationId: approval.id });
    const version = value(decodeVersion({ id: `${entry.id}:v1`, subject: entry.id,
      content, contentHash: encoded.hash, since: since.id, supersedes: [], approvedIn: approval.id,
      base, landedIn: 'merge-1' }, ctx, f.scope, [], landing));
    versions.push({ factId: record('version', version).id, version });
  }
  const spine: GoverningSpine = { anchor: chain[0]!.id, versions, approvals, generations, stalenessBoundMs: 1000 };
  const extraction: ChainExtraction = value(extractGovernedChain(spine, ctx));
  const anchor = (generation: unknown, at = 100) => {
    const generationRecord = { type: 'GenerationRecord', schemaVersion: 1, at: f.clockRaw(at), generation } as unknown as Json;
    generations.push({ factId: record('generation', generationRecord).id, record: generationRecord });
  };
  const port = <R>(decodeRecord: (record: Json) => Result<R>) => createRegisterSpine(spine, ctx, decodeRecord);
  const extractionAt = (through: number): ChainExtraction => value(extractGovernedChain(spine, ctx, through));
  return { f, ctx, spine, extraction, extractionAt, anchor, append, record, port, approvals, approvalFactFor: (id: string) =>
    approvals[entries.findIndex(e => e.id === id)]!.factId };
}
