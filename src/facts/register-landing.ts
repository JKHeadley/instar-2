// Rules 2, 7, 82, 90, 98; P2-NF-38..45. The append side of the register spine: the Part Two
// landing provider. It lands a version only on a decoded explicit-yes `Authorization` (Part One
// is the authority), decodes the version with `decodeVersion`, and appends the governing
// records `register-spine.ts` reads: the approval, the version and, on entering force, the
// generation. Each record is a signed `governing-record` fact committing to its payload's hash;
// the payload bytes sit in content-addressed custody. The spine is rebuilt from the fact log on
// every read, so it survives a restart, and a missing payload is refused loudly, never skipped.
import type { Authorization, Hash, Json, Result, Scope } from '../index.js';
import { isExplicitYes } from '../index.js';
import { boundary, encoding, object, requireFact, string, take } from './boundary.js';
import type { FactContext, FactEnvelope } from './contracts.js';
import { contextBoundary } from './contracts.js';
import type { FactStorePort } from './store.js';
import { authorAndAppend } from './store.js';
import { governingRecordBody, governingRecordKind } from './register-spine.js';
import type { GoverningRecordRole, GoverningSpine, RecordedGeneration, RecordedVersion } from './register-spine.js';
import { decodeVersion } from './version-chain.js';
import type { GovernedVersion, LandingReadPort } from './version-chain.js';

/** Content-addressed durable custody for governing payload bytes (Part Ten owns the I/O). */
export interface GoverningPayloadCustody {
  put(bytes: string): Result<Hash>;
  get(hash: Hash): string | undefined;
}
export interface RegisterLandingDeps {
  readonly context: FactContext;
  readonly store: FactStorePort;
  readonly custody: GoverningPayloadCustody;
  /** The landing appender's own identity; its key signs the governing-record envelopes. */
  readonly author: Readonly<{ machine: string; principal: Json; provenance: Json; privateKey: string }>;
  readonly anchor: string;
  readonly stalenessBoundMs: number;
}
/** A version to land: `since` and `approvedIn` are supplied by the landing, never the caller. */
export interface LandingVersionInput {
  readonly id: string; readonly subject: string; readonly content: Json; readonly contentHash: string;
  readonly supersedes: readonly string[]; readonly base: string; readonly landedIn: string | null;
}
export interface RegisterLandingPort {
  readonly owner: 'part-two';
  land(authorization: Authorization, version: LandingVersionInput, scope: Scope, landing: LandingReadPort, at: Json): Result<RecordedVersion>;
  enterForce(record: Json, at: Json): Result<RecordedGeneration>;
  spine(): Result<GoverningSpine>;
}

export function createRegisterLanding(deps: RegisterLandingDeps): RegisterLandingPort {
  const facts = (): readonly FactEnvelope[] => [...deps.context.facts, ...take(deps.store.read())];
  const recorded = () => facts().filter(f => f.kind === governingRecordKind);
  const payload = (fact: FactEnvelope): Json => {
    const body = object(fact.body);
    const hash = string(body.hash, 'governing-record.hash') as Hash;
    const bytes = deps.custody.get(hash);
    requireFact(typeof bytes === 'string', `governing payload lost from custody: ${fact.id} (${hash})`, 'integrity');
    const parsed = JSON.parse(bytes) as Json;
    requireFact(encoding(parsed).hash === hash, `governing payload differs from its signed record: ${fact.id}`, 'integrity');
    return parsed;
  };
  const rebuild = (): GoverningSpine => {
    const approvals: { factId: string; authorizationId: string }[] = [];
    const versions: RecordedVersion[] = [];
    const generations: RecordedGeneration[] = [];
    for (const fact of recorded()) {
      const role = string(object(fact.body).role, 'governing-record.role') as GoverningRecordRole;
      const value = payload(fact);
      if (role === 'approval') approvals.push({ factId: fact.id, authorizationId: string(object(value).id, 'approval.id') });
      else if (role === 'version') versions.push({ factId: fact.id, version: value as unknown as GovernedVersion });
      else { requireFact(role === 'generation', `unknown governing-record role: ${role}`, 'integrity'); generations.push({ factId: fact.id, record: value }); }
    }
    return { anchor: deps.anchor, versions, approvals, generations, stalenessBoundMs: deps.stalenessBoundMs };
  };
  const append = (role: GoverningRecordRole, value: unknown, at: Json): FactEnvelope => {
    const bytes = encoding(value).bytes;
    requireFact(take(deps.custody.put(bytes)) === encoding(value).hash, 'custody stored different bytes', 'integrity');
    return take(authorAndAppend({ kind: governingRecordKind, schemaVersion: 1, machine: deps.author.machine,
      principal: deps.author.principal, provenance: deps.author.provenance, at, body: governingRecordBody(role, value), required: [] },
    deps.context, deps.store, deps.author.privateKey)).fact;
  };
  return {
    owner: 'part-two',
    land: (authorization, version, scope, landing, at) => boundary('GovernedLanding', null, contextBoundary(deps.context), () => {
      requireFact(isExplicitYes(authorization.explicitYes), 'landing needs an admitted explicit yes, never a merge or attested event', 'standing');
      const spine = rebuild();
      const reference = authorization.explicitYes.record.reference;
      // One use: a yes already behind a landed version cannot land another.
      requireFact(!spine.versions.some(v => v.version.approvedIn.explicitYes.record.reference === reference),
        `explicit yes ${reference} was already used`, 'standing');
      // A crash between the two appends leaves the approval recorded; landing again reuses it.
      const approvalBytes = encoding(authorization).bytes;
      const prior = spine.approvals.find(a => a.authorizationId === authorization.id);
      const approvalFact = prior
        ? (() => { const fact = recorded().find(f => f.id === prior.factId)!;
          requireFact(encoding(payload(fact)).bytes === approvalBytes, `authorization ${authorization.id} was recorded with different content`, 'integrity');
          return fact; })()
        : append('approval', authorization, at);
      const context = { ...deps.context, facts: facts(),
        decode: { ...deps.context.decode, authorizations: [...(deps.context.decode.authorizations ?? []), authorization] } };
      const decoded = take(decodeVersion({ ...version, since: approvalFact.id, approvedIn: authorization.id }, context, scope,
        spine.versions.map(v => v.version), landing));
      return { factId: append('version', decoded, at).id, version: decoded };
    }),
    enterForce: (record, at) => boundary('GovernedEnteringForce', null, contextBoundary(deps.context), () => {
      const r = object(record);
      requireFact(r.type === 'GenerationRecord' && r.schemaVersion === 1, 'expected a decoded generation record');
      return { factId: append('generation', record, at).id, record };
    }),
    spine: () => boundary('GoverningSpineRead', null, contextBoundary(deps.context), rebuild),
  };
}
