// 1.x CartographerTree's node projection, with Part Two owning durable originals.
// No filesystem, clock, timer, model route, or approval registry lives here.
import type { BoundaryContext, Json, Result, Scope } from '../../index.js';
import { authorAndAppend } from '../../facts/index.js';
import type { FactEnvelope, FactSchema } from '../../facts/index.js';
import type { RecallWriter } from '../contracts.js';
import { boundary, ensure, freeze, take } from '../boundary.js';
import { redact } from '../redact.js';
import type { CartographerNode, CartographerReader } from './contracts.js';
import { isSecretBearingPath } from './summary.js';

export const cartographerObservationKind = 'cartographer-observation';
export interface CartographerObservation {
  readonly root: string;
  readonly revision: string;
  readonly node: CartographerNode;
  /** Durable original source reference supplied by the admitted source owner. */
  readonly source: string;
  /** Original author output, including rejected/invalidation evidence; never rendered. */
  readonly originalSummary: string;
  readonly disposition: 'observed' | 'authored' | 'invalidated' | 'fingerprint' | 'failed' | 'deferred';
}
export function cartographerObservationSchema(scope: Scope): FactSchema {
  return freeze({ kind: cartographerObservationKind, version: 1, machineScope: 'shared', standing: 'requester', action: 'work',
    scope, causallyBound: false, requiredReferences: [], authority: 'none', fields: {
      root: { kind: 'text', maxLength: 1024 }, revision: { kind: 'text', maxLength: 64 },
      source: { kind: 'text', maxLength: 1024 }, disposition: { kind: 'text', maxLength: 32 },
      node: { kind: 'text', maxLength: 262144 }, originalSummary: { kind: 'text', maxLength: 16000 },
    } });
}
export function validCartographerPath(path: string): boolean {
  return path.length <= 1024 && (path === '' || (!path.startsWith('/') && !/[\\\0\r\n]/u.test(path)
    && path.split('/').every(p => p !== '' && p !== '.' && p !== '..')));
}
function checked(o: CartographerObservation): void {
  ensure(typeof o.root === 'string' && o.root.length > 0 && o.root.length <= 1024, 'exact source root required');
  ensure(/^[a-f0-9]{40,64}$/u.test(o.revision), 'committed source revision required');
  ensure(o.source.length > 0 && o.source.length <= 1024, 'durable original source reference required');
  const n = o.node;
  ensure(validCartographerPath(n.path) && !isSecretBearingPath(n.path), 'excluded or invalid source path', 'policy');
  ensure(n.kind === 'file' || n.kind === 'dir', 'node kind');
  ensure(n.builtinKind === 'cartographer-node' && !n.dirtyAtAuthor, 'only committed-source observations');
  ensure(n.codeHash === null || /^[a-f0-9]{40,64}$/u.test(n.codeHash), 'code identity required');
  ensure(n.summary.length <= 16000 && o.originalSummary.length <= 16000, 'bounded description required');
  ensure(n.children.length <= 4096 && new Set(n.children).size === n.children.length, 'bounded unique direct children required');
  ensure(n.kind === 'dir' || n.children.length === 0, 'files have no children');
  for (const p of n.children) {
    ensure(validCartographerPath(p) && p !== '' && (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '') === n.path,
      'child must be a direct scoped descendant');
  }
  ensure(['observed', 'authored', 'invalidated', 'fingerprint', 'failed', 'deferred'].includes(o.disposition), 'observation disposition');
  ensure(redact(JSON.stringify(o)).count === 0, 'credential-bearing observation refused', 'floor');
}
/** Appends; never overwrites the earlier description, source identity, or rejection evidence. */
export function captureCartographerObservation(o: CartographerObservation, at: Json, writer: RecallWriter,
  observed?: (fact: FactEnvelope) => void): Result<string> {
  const context: BoundaryContext = { site: writer.context.site, preserved: writer.context.preserved, register: writer.context.decode.register };
  return boundary('CartographerObservation', o, context, () => {
    checked(o);
    const receipt = take(authorAndAppend({ kind: cartographerObservationKind, schemaVersion: 1, machine: writer.machine,
      principal: writer.principal as Json, provenance: writer.provenance as Json, at,
      body: { root: o.root, revision: o.revision, source: o.source, disposition: o.disposition,
        node: JSON.stringify(o.node), originalSummary: o.originalSummary }, required: [] }, writer.context, writer.store, writer.privateKey));
    observed?.(receipt.fact);
    return receipt.fact.id;
  });
}
export function readCartographerObservation(fact: FactEnvelope): CartographerObservation | null {
  if (fact.kind !== cartographerObservationKind || fact.schemaVersion !== 1) return null;
  try {
    const b = fact.body as Record<string, Json>;
    if (typeof b.node !== 'string') return null;
    const o = { root: b.root, revision: b.revision, source: b.source, disposition: b.disposition,
      originalSummary: b.originalSummary, node: JSON.parse(b.node) } as CartographerObservation;
    checked(o); return freeze(o);
  } catch { return null; }
}
/** Rebuildable read projection. Feed accepted, ordered Part Two facts incrementally;
 * constructor root is the existing source owner's scoped root, not a new root grant.
 * A caller must never give this projection unadmitted sources. */
export class CartographerTree implements CartographerReader {
  private readonly nodes = new Map<string, CartographerNode>();
  private readonly sources = new Map<string, { fact: string; source: string; revision: string }>();
  constructor(readonly root: string, private readonly oids: (paths: readonly string[]) => ReadonlyMap<string, string>) {}
  observe(fact: FactEnvelope): boolean {
    const o = readCartographerObservation(fact);
    if (!o || o.root !== this.root) return false;
    this.nodes.set(o.node.path, freeze({ ...o.node, children: [...o.node.children].sort() }));
    this.sources.set(o.node.path, { fact: fact.id, source: o.source, revision: o.revision });
    return true;
  }
  getNode(path: string): CartographerNode | null { return this.nodes.get(path) ?? null; }
  getChildren(path: string, limit: number): CartographerNode[] {
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 10000) throw new RangeError('finite child read bound required');
    const children = this.nodes.get(path)?.children ?? [], result: CartographerNode[] = [];
    for (let i = 0; i < children.length && i < limit; i += 1) {
      const n = this.nodes.get(children[i]!); if (n) result.push(n);
    }
    return result;
  }
  currentOidMap(paths: readonly string[]): ReadonlyMap<string, string> { return this.oids(paths); }
  source(path: string): Readonly<{ fact: string; source: string; revision: string }> | null { return this.sources.get(path) ?? null; }
}
