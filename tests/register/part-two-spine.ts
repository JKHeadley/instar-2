// A real part-two spine for part-three consumers: recorded facts, verified explicit-yes
// approvals and real landings. It approves nothing — each fixture supplies its own content,
// and every anchor below is a fact this fixture actually appended.
import { canonical } from '../../src/index.js';
import type { Json, Result } from '../../src/index.js';
import { createRegisterSpine, decodeVersion, extractGovernedChain } from '../../src/facts/index.js';
import type { ChainExtraction, GoverningSpine, RecordedApproval, RecordedGeneration, RecordedVersion } from '../../src/facts/index.js';
import { factsFixture, value } from '../facts/fixtures.js';

/** `base` is what the approvals were reviewed against: the consuming register's source commit. */
export function partTwoSpine(entries: readonly { readonly id: string; readonly content: unknown }[], base = 'commit:1') {
  const f = factsFixture();
  const chain = [f.fact()];
  const append = () => { const next = f.next(chain[chain.length - 1]!); chain.push(next); return next; };
  const ctx = { ...f.ctx, facts: chain, grants: [{ factId: chain[0]!.id, grant: f.g }] };
  const landing = { owner: 'part-ten' as const, merges: [{ commit: 'merge-1', onMain: true, parentCount: 2, reviewedBase: base }] };
  const approvals: RecordedApproval[] = [];
  const generations: RecordedGeneration[] = [];
  const versions: RecordedVersion[] = [];
  for (const entry of entries) {
    const content = entry.content as Json;
    const encoded = value(canonical(content)); f.capture(encoded.bytes, encoded.hash);
    const since = append(), approvalFact = append(), versionFact = append();
    const approval = f.authorize({ id: `approval:${entry.id}`, artifact: encoded.hash, base, action: { kind: 'merge', scope: f.scope } });
    approvals.push({ factId: approvalFact.id, authorizationId: approval.id });
    versions.push({ factId: versionFact.id, version: value(decodeVersion({ id: `${entry.id}:v1`, subject: entry.id,
      content, contentHash: encoded.hash, since: since.id, supersedes: [], approvedIn: approval.id,
      base, landedIn: 'merge-1' }, ctx, f.scope, [], landing)) });
  }
  const spine: GoverningSpine = { anchor: chain[0]!.id, versions, approvals, generations, stalenessBoundMs: 1000 };
  const extraction: ChainExtraction = value(extractGovernedChain(spine, ctx));
  const anchor = (generation: unknown, at = 100) => {
    generations.push({ factId: append().id, record: { type: 'GenerationRecord', schemaVersion: 1,
      at: f.clockRaw(at), generation } as unknown as Json });
  };
  const port = <R>(decodeRecord: (record: Json) => Result<R>) => createRegisterSpine(spine, ctx, decodeRecord);
  const extractionAt = (through: number): ChainExtraction => value(extractGovernedChain(spine, ctx, through));
  return { f, ctx, spine, extraction, extractionAt, anchor, port, approvals, approvalFactFor: (id: string) =>
    approvals[entries.findIndex(e => e.id === id)]!.factId };
}
