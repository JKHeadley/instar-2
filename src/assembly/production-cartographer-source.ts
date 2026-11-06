/** Committed-source capture and mediated disclosure for Cartographer. Ten owns
 * physical capture; One's existing custody binding owns who may read it. */
import { createHash } from 'node:crypto';
import type { Hash, Result } from '../index.js';
import { hashBytes } from '../facts/index.js';
import type { CartographerNode } from '../recall/cartographer/contracts.js';
import type { CartographerSourcePort } from '../recall/cartographer/service.js';
import { validCartographerPath } from '../recall/cartographer/tree.js';
import { contentHasCredentialMaterial, isSecretBearingPath } from '../recall/cartographer/summary.js';
import { boundary, ensure, freeze, take } from './boundary.js';
import { createProductionCustodyReader } from './production-custody-wiring.js';
import type { ProductionCustodyReadInput } from './production-custody-wiring.js';

export interface CommittedCartographerNode {
  readonly node: CartographerNode; readonly oid: string;
  /** Complete committed blob, never a working-tree read or a truncated capture. */
  readonly content: string | null;
}
export interface CartographerSourceCapture {
  readonly root: string; readonly revision: string;
  readonly position: string; readonly digest: string; readonly count: number;
}
const oidPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const byteLength = (s: string) => new TextEncoder().encode(s).length;
function validateRows(rows: readonly CommittedCartographerNode[]) {
  ensure(Array.isArray(rows) && rows.length > 0 && rows.length <= 4096, 'bounded committed source population required');
  const paths = new Set<string>();
  for (const row of rows) {
    const n = row.node;
    ensure(n && typeof n.path === 'string' && validCartographerPath(n.path) && !isSecretBearingPath(n.path)
      && !paths.has(n.path), 'invalid, excluded or duplicate committed source path');
    paths.add(n.path);
    ensure(oidPattern.test(row.oid) && (n.kind === 'file' || n.kind === 'dir')
      && n.builtinKind === 'cartographer-node' && !n.dirtyAtAuthor, 'committed source identity required');
    ensure(n.summary === '' && n.codeHash === null && n.codeRev === null && n.summaryUpdatedAt === null,
      'structural capture cannot assert authored evidence');
    ensure(Array.isArray(n.children) && n.children.length <= 4096 && new Set(n.children).size === n.children.length,
      'bounded unique children required');
    for (const p of n.children) ensure(typeof p === 'string' && validCartographerPath(p) && p !== ''
      && (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '') === n.path, 'direct descendant required');
    if (n.kind === 'file') {
      ensure(n.children.length === 0 && typeof row.content === 'string' && byteLength(row.content) <= 1048576,
        'bounded complete committed blob required');
      const bytes = Buffer.from(row.content, 'utf8');
      const actual = createHash(row.oid.length === 40 ? 'sha1' : 'sha256')
        .update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      ensure(actual === row.oid, 'committed blob identity differs');
      ensure(!contentHasCredentialMaterial(row.content), 'credential-bearing source capture refused');
    } else ensure(row.content === null, 'directory capture cannot carry blob text');
  }
  ensure(paths.has(''), 'committed source root missing');
  const indexed = new Map(rows.map(row => [row.node.path, row.node]));
  for (const row of rows) {
    for (const p of row.node.children) ensure(paths.has(p), 'committed child missing');
    if (row.node.path !== '') {
      const path = row.node.path, parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      ensure(indexed.get(parent)?.kind === 'dir' && indexed.get(parent)!.children.includes(path), 'committed parent link missing');
    }
  }
}

/** Used by the existing admitted source operation, after a committed Git read.
 * The caller supplies the current physical head from its owned append sequence.
 * It receives the real durable receipt position, never a fabricated custody id. */
export function captureCommittedCartographerSource(input: Readonly<{
  custody: ProductionCustodyReadInput; root: string; revision: string;
  rows: readonly CommittedCartographerNode[]; expectedPhysicalHead: Hash | null;
}>): Result<CartographerSourceCapture> {
  return boundary('CartographerSourceCapture', null, input.custody.context, () => {
    const current = input.custody.current();
    ensure(!current.stopped && current.generation === input.custody.binding.generation
      && current.clock.value < input.custody.binding.validUntil, 'Cartographer capture stopped, expired or stale');
    ensure(input.root.length > 0 && input.root.length <= 1024 && oidPattern.test(input.revision), 'exact root/revision required');
    validateRows(input.rows);
    const bytes = JSON.stringify({ root: input.root, revision: input.revision, rows: input.rows });
    ensure(byteLength(bytes) <= input.custody.policy.resourceBound && byteLength(bytes) <= 2097152,
      'committed capture exceeds custody budget');
    ensure(!contentHasCredentialMaterial(bytes), 'credential-bearing source capture refused');
    const digest = hashBytes(bytes), position = `cartographer-source:${digest}`;
    const receipt = take(input.custody.storage.persistence.appendExact({ segment: input.custody.policy.store,
      policy: input.custody.policy.id, position, bytes, bytesDigest: digest, expectedPhysicalHead: input.expectedPhysicalHead }));
    take(input.custody.storage.persistence.flushEvidence(receipt));
    return freeze({ root: input.root, revision: input.revision, position: receipt.position, digest, count: input.rows.length });
  });
}

/** Bind only positions already admitted by the production custody owner. This
 * adapter never adds a position, grant, root or disclosure to that binding. */
export function createProductionCartographerSource(input: Readonly<{
  custody: ProductionCustodyReadInput; capture: CartographerSourceCapture; topic: string;
  current(): Readonly<{ root: string; revision: string; stopped: boolean; holdsLease: boolean }>;
}>): CartographerSourcePort {
  const capture = freeze({ ...input.capture }), c = input.custody.context;
  const reader = createProductionCustodyReader(input.custody);
  let sequence = 0;
  const check = (revision: string, purpose: 'read' | 'author', topic: string) => {
    const current = input.current();
    ensure(topic === input.topic && current.root === capture.root, 'Cartographer source scope differs');
    ensure(!current.stopped && (purpose === 'read' || current.holdsLease), 'Cartographer stopped or lease unavailable');
    ensure(oidPattern.test(revision) && current.revision === revision && capture.revision === revision,
      'Cartographer captured revision unavailable or changed');
  };
  const read = (revision: string) => {
    check(revision, 'read', input.topic);
    const result = take(reader.read({ requester: input.custody.binding.requester, grant: input.custody.binding.grant,
      scope: input.custody.binding.scope, policy: input.custody.policy.id,
      operation: `cartographer:${capture.digest}:${++sequence}`, positions: [capture.position],
      maxBytes: Math.min(2097152, input.custody.policy.resourceBound) }));
    ensure(result.bytes.length === 1 && hashBytes(result.bytes[0]!) === capture.digest, 'Cartographer source custody digest differs');
    const data = JSON.parse(result.bytes[0]!) as { root: string; revision: string; rows: CommittedCartographerNode[] };
    ensure(data.root === capture.root && data.revision === revision && data.rows.length === capture.count,
      'Cartographer source binding differs');
    validateRows(data.rows); check(revision, 'read', input.topic);
    return data.rows;
  };
  const source: CartographerSourcePort = { root: capture.root,
    revision: () => boundary('CartographerSourceRevision', null, c, () => { check(capture.revision, 'read', input.topic); return capture.revision; }),
    admit: request => boundary('CartographerSourceAdmission', request, c, () => {
      ensure(request.root === capture.root, 'Cartographer source root differs');
      check(request.revision, request.purpose, request.topic); read(request.revision); return true as const;
    }),
    oids: (revision, paths) => boundary('CartographerSourceOids', { revision, paths }, c, () => {
      ensure(paths.length <= 1000 && paths.every(validCartographerPath), 'bounded source identity request required');
      const wanted = new Set(paths), map = new Map<string, string>();
      for (const row of read(revision)) if (wanted.has(row.node.path)) map.set(row.node.path, row.oid);
      return map;
    }),
    page: (revision, cursor, limit) => boundary('CartographerSourcePage', { revision, cursor, limit }, c, () => {
      ensure(Number.isSafeInteger(limit) && limit > 0 && limit <= 32, 'bounded source page required');
      const offset = cursor === null ? 0 : Number(cursor.split(':')[1]);
      ensure(cursor === null || cursor === `${revision}:${offset}`, 'revision-bound cursor required');
      const rows = read(revision);
      ensure(Number.isSafeInteger(offset) && offset >= 0 && offset < rows.length, 'source cursor outside capture');
      return { nodes: rows.slice(offset, offset + limit).map(row => row.node),
        next: offset + limit < rows.length ? `${revision}:${offset + limit}` : null, source: capture.position };
    }),
    content: (revision, path, maxBytes) => boundary('CartographerSourceContent', { revision, path, maxBytes }, c, () => {
      ensure(validCartographerPath(path) && !isSecretBearingPath(path) && Number.isSafeInteger(maxBytes)
        && maxBytes > 0 && maxBytes <= 1048576, 'bounded scoped content required');
      const row = read(revision).find(entry => entry.node.path === path);
      ensure(row?.node.kind === 'file' && row.content !== null, 'committed source unavailable');
      const bytes = Buffer.from(row.content, 'utf8');
      // Avoid a replacement character growing beyond maxBytes at a multibyte cut.
      let end = Math.min(bytes.length, maxBytes);
      while (end > 0 && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--;
      return { text: bytes.subarray(0, end).toString('utf8'), truncated: end < bytes.length,
        oid: row.oid, source: capture.position };
    }),
  };
  return Object.freeze(source);
}
