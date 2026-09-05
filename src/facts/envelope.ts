// P2-NF-01..24, 64, 69: canonical integrity precedes body migration and authority.
import { sign, verify, createHash } from 'node:crypto';
import { decode, readHistorical } from '../index.js';
import type { Clock, Hash, HistoricalShape, Json, Provenance, Result, VerifiedPrincipal } from '../index.js';
import { boundary, encoding, fields, integer, object, requireFact, same, string, strings, take } from './boundary.js';
import type { CausalFrontier, FactContext, FactEnvelope, FactSchema, LineagePosition, Predecessors, SegmentPosition } from './contracts.js';
import { contextBoundary } from './contracts.js';

export const genesisHash: Hash = `sha256:${'0'.repeat(64)}`;
export function comparePosition(a: LineagePosition, b: LineagePosition): number { return a.epoch - b.epoch || a.position - b.position; }
export function factId(segment: SegmentPosition): string { return `${encodeURIComponent(segment.machine)}:${segment.epoch}:${segment.position}`; }
export function clockKey(clock: Clock): string {
  requireFact(clock.subject.kind === 'clock' && clock.unit === 'unix-ms' && Number.isSafeInteger(clock.value), 'unnormalizable fold-key clock');
  // Schema 1: signed integer unix-ms shifted into unsigned 64-bit big-endian hexadecimal.
  return (BigInt(clock.value) + (1n << 63n)).toString(16).padStart(16, '0');
}
export function foldKey(fact: FactEnvelope): string { return `${clockKey(fact.at)}\u0000${fact.machine}\u0000${fact.id}`; }
export function hashBytes(bytes: string): Hash { return `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`; }
export function secretShape(bytes: string): boolean {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/.test(bytes);
}
function position(v: Json | undefined): LineagePosition {
  const p = object(v ?? null); fields(p, ['epoch', 'position']);
  return { epoch: integer(p.epoch, 'epoch'), position: integer(p.position, 'position') };
}
function frontier(v: Json | undefined): CausalFrontier {
  return Object.fromEntries(Object.entries(object(v ?? null)).map(([m, p]) => { requireFact(m.length > 0, 'empty lineage'); return [m, position(p)]; }));
}
function predecessors(v: Json | undefined): Predecessors {
  const p = object(v ?? null); fields(p, ['inSegment', 'frontier', 'required']);
  return { inSegment: p.inSegment === null ? null : string(p.inSegment, 'inSegment'), frontier: frontier(p.frontier), required: strings(p.required, 'required') };
}
function hash(v: Json | undefined): Hash { const s = string(v, 'hash'); requireFact(/^sha256:[a-f0-9]{64}$/.test(s), 'malformed hash'); return s as Hash; }

export function schemaFor(context: FactContext, kind: string, version: number): FactSchema {
  const schema = context.schemas.find(s => s.kind === kind && s.version === version);
  requireFact(schema, 'unknown kind or schema version'); return schema;
}
export function preimage(input: unknown): { bytes: string; hash: Hash } {
  const v = object(JSON.parse(encoding(input).bytes) as Json);
  // The original body stays in this preimage forever, even when a later schema migrates it.
  const { contentHash: _hash, signature: _signature, ...payload } = v;
  return encoding(payload);
}
export function signEnvelope(input: unknown, privateKey: string): unknown {
  const value = object(JSON.parse(encoding(input).bytes) as Json);
  const { hash: contentHash } = preimage(value);
  return { ...value, contentHash, signature: sign(null, Buffer.from(contentHash, 'utf8'), privateKey).toString('hex') };
}

export function decodeEnvelope(input: unknown, context: FactContext, mode: 'origin' | 'replication' = 'origin'): Result<FactEnvelope> {
  return boundary('FactEnvelopeDecode', input, contextBoundary(context), raw => {
    // The public boundary snapshots without evaluating getters. No refused body is retained here.
    requireFact(!secretShape(encoding(raw).bytes), 'secret-shaped bytes', 'policy');
    const v = object(raw);
    fields(v, ['type', 'envelopeVersion', 'id', 'kind', 'schemaVersion', 'at', 'machine', 'principal', 'provenance', 'segment', 'prevInSegment', 'predecessors', 'body', 'contentHash', 'signature']);
    requireFact(v.type === 'FactEnvelope' && v.envelopeVersion === 1, 'unknown envelope type/version');
    const id = string(v.id, 'id'), kind = string(v.kind, 'kind'), version = integer(v.schemaVersion, 'schemaVersion', 1);
    const machine = string(v.machine, 'machine');
    const atValue = take(decode('Measurement', v.at, context.decode));
    requireFact(atValue.subject.kind === 'clock', 'at must be a clock');
    // Narrow the clock through its generic decoder contract; no principal/provenance is cast.
    const at = atValue as Clock; clockKey(at);
    const s = object(v.segment ?? null); fields(s, ['machine', 'epoch', 'position']);
    const segment = { machine: string(s.machine, 'segment.machine'), epoch: integer(s.epoch, 'epoch'), position: integer(s.position, 'position') };
    requireFact(segment.machine === machine && id === factId(segment), 'fact id outside appender namespace');
    const prevInSegment = hash(v.prevInSegment), parents = predecessors(v.predecessors);
    const contentHash = hash(v.contentHash), signature = string(v.signature, 'signature');
    requireFact(/^[a-f0-9]{128}$/.test(signature), 'signature encoding');
    requireFact(preimage(raw).hash === contentHash, 'content hash mismatch', 'integrity');
    const key = context.keys.find(k => k.machine === machine && comparePosition(segment, k.from) >= 0 && (!k.through || comparePosition(segment, k.through) <= 0)
      && verify(null, Buffer.from(contentHash, 'utf8'), k.publicKey, Buffer.from(signature, 'hex')));
    requireFact(key, 'signature, signing owner, or key position invalid', 'integrity');
    requireFact(!key.compromisedAt || comparePosition(segment, key.compromisedAt) < 0, 'compromised-key: quarantine required', 'integrity');
    schemaFor(context, kind, version);
    let principal: HistoricalShape<VerifiedPrincipal>, provenance: HistoricalShape<Provenance>;
    if (mode === 'origin') {
      const p = context.decode.principals?.find(p => same(p, v.principal));
      requireFact(p && same(p.provenance, v.provenance), 'principal must be independently decoded with matching provenance', 'standing');
      // Revalidate through P1's producer, never trust caller field construction.
      const decoded = take(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1, id: p.id, kind: p.kind }, { ...context.decode, provenance: p.provenance }));
      principal = decoded; provenance = decoded.provenance;
    } else {
      const bytes = encoding(raw).bytes, reference = `origin:${id}`;
      const pin = { origin: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id }, capture: { reference, hash: hashBytes(bytes) }, machineKeyId: key.id, signature, path: ['principal'] };
      // G1: this seam fails closed with P1 3f688bf: readHistorical signs raw bytes, while
      // this contract signs contentHash. Do not add a second signature or cast to live authority.
      const historical = take(readHistorical('VerifiedPrincipal', v.principal, pin, { ...context.decode, captures: { ...context.decode.captures, [reference]: bytes } }));
      principal = historical.view; provenance = historical.view.provenance;
      requireFact(same(provenance, v.provenance), 'origin provenance mismatch', 'integrity');
    }
    requireFact(segment.position === 0 ? parents.inSegment === null : parents.inSegment !== null, 'in-segment predecessor missing or invalid');
    return { type: 'FactEnvelope', envelopeVersion: 1, id, kind, schemaVersion: version, at, machine, principal, provenance,
      segment, prevInSegment, predecessors: parents, body: v.body!, contentHash, signature } as FactEnvelope;
  });
}
