import { consumeResult, decode, decodeMeasurement } from '../index.js';
import type { Clock, Json } from '../index.js';
import type { ChainExtract, Declaration, FactPositionVectorReference, FactReference, GeneratedRegister, GenerationRecord,
  RegisterContext, RegisterEntry, RegisterGeneration, SpineReadPort, VersionRowInput, VerifiedRegister } from './types.js';
import { checked, encoding, exact, list, object, requireThat, strings, take, text, validated } from './boundary.js';
import { decodeDeclaration } from './declarations.js';
import { decodeShape } from './shape.js';
import { resolveFact } from './fact-schema.js';

const loaded = new WeakMap<object, () => boolean>();
export const wasVerified = (register: GeneratedRegister): register is VerifiedRegister => loaded.get(register)?.() === true;

function reference<N extends 'FactEnvelope' | 'FactPositionVector'>(input: Json, name: N) {
  const r = object(input); exact(r, ['owner', 'name', 'id']);
  requireThat(r.owner === 'part-two' && r.name === name, `expected part-two ${name} reference`);
  return { owner: 'part-two' as const, name, id: text(r.id, 'reference.id') };
}
function row(input: Json): VersionRowInput {
  const r = object(input); exact(r, ['id', 'version', 'status', 'since', 'supersedes', 'approvedIn', 'landedIn', 'base', 'contentHash']);
  requireThat(['live', 'retired', 'superseded'].includes(String(r.status)), 'invalid version status');
  const hash = text(r.contentHash, 'contentHash'); requireThat(/^sha256:[a-f0-9]{64}$/.test(hash), 'invalid content hash');
  return { id: text(r.id, 'row.id'), version: text(r.version, 'version'), status: r.status as VersionRowInput['status'],
    since: text(r.since, 'since'), supersedes: strings(r.supersedes, 'supersedes'), approvedIn: reference(r.approvedIn!, 'FactEnvelope'),
    landedIn: text(r.landedIn, 'landedIn'), base: text(r.base, 'base'), contentHash: hash as VersionRowInput['contentHash'] };
}
export function decodeExtract(input: unknown, context: RegisterContext) {
  return validated<ChainExtract, RegisterContext>('ChainExtract', input, context, v => {
    exact(v, ['type', 'schemaVersion', 'vector', 'rows']);
    const rows = list(v.rows, 'extract.rows').map(row);
    requireThat(new Set(rows.map(r => r.version)).size === rows.length, 'duplicate version in extract');
    const visited = new Set<string>(); const visiting = new Set<string>(); const byVersion = new Map(rows.map(r => [r.version, r]));
    const walk = (version: string): void => {
      requireThat(!visiting.has(version), 'version-chain cycle'); if (visited.has(version)) return;
      const r = byVersion.get(version); requireThat(r, `unresolved supersedes ${version}`); visiting.add(version);
      for (const previous of r.supersedes) walk(previous);
      visiting.delete(version); visited.add(version);
    };
    for (const r of rows) walk(r.version);
    return { type: 'ChainExtract', schemaVersion: 1, vector: reference(v.vector!, 'FactPositionVector'),
      rows: rows.slice().sort((a, b) => a.version < b.version ? -1 : a.version > b.version ? 1 : 0) } as unknown as ChainExtract;
  });
}
function declarationInput(d: Record<string, Json>): Record<string, Json> {
  const { declaredBy: _site, ...input } = d; return input;
}
function entry(declaration: Declaration, extract: ChainExtract, commit: string): RegisterEntry {
  const history = extract.rows.filter(r => r.id === declaration.id);
  const replaced = new Set(history.flatMap(r => r.supersedes)); const heads = history.filter(r => !replaced.has(r.version));
  requireThat(heads.length <= 1, `conflicting version heads for ${declaration.id}; part-two resolution required`);
  const head = heads[0]; const { declaredBy: _site, ...authored } = declaration;
  const contentHash = encoding(authored).hash;
  // Supersession must be a recorded row, never an author-supplied declaration field.
  if (head && head.status !== 'live') requireThat(head.contentHash === contentHash && declaration.status === 'retired',
    `P3-NF-17: resurrected id ${declaration.id} lacks recorded supersession`);
  const current = head?.contentHash === contentHash ? head : undefined;
  const pending = { state: 'pending-landing' as const };
  return { declaration, owner: declaration.declaredBy.path, since: head?.since ?? pending,
    supersedes: current?.supersedes ?? (head ? [head.version] : []), approvedIn: current?.approvedIn ?? pending,
    landedIn: current?.landedIn ?? pending, base: current?.base ?? commit, history };
}
export function generateRegister(input: unknown, context: RegisterContext) {
  return checked<GeneratedRegister, RegisterContext>('RegisterBuild', input, context, (raw, ctx) => {
    const v = object(raw); exact(v, ['commit', 'complete', 'extract', 'sources', 'instances']);
    requireThat(v.complete === true, 'P3-NF-23: partial checkout or incomplete source walk');
    const commit = text(v.commit, 'commit'); const extract = take(decodeExtract(v.extract, ctx));
    const instances = object(v.instances!); const declarations: Declaration[] = [];
    for (const source of list(v.sources, 'sources')) {
      const s = object(source); exact(s, ['path', 'symbol', 'declaration']); const path = text(s.path, 'source.path');
      requireThat(!path.startsWith('/') && !path.split('/').some(p => p === '..' || p === '.' || p === '') && !path.includes('\\') && path === path.normalize('NFC'), 'noncanonical source path');
      const local = { ...ctx, source: { path, symbol: text(s.symbol, 'symbol') } };
      const d = take(decodeDeclaration(s.declaration, local)); declarations.push(d);
      if (d.family) {
        const members = list(instances[d.family.source], 'family instance source');
        for (const member of members) {
          const m = object(member); exact(m, ['id', 'requiredFacts']);
          const template = object(s.declaration!); const { family: _family, ...rest } = template;
          declarations.push(take(decodeDeclaration({ ...rest, id: text(m.id, 'instance.id'), requiredFacts: m.requiredFacts }, local)));
        }
      }
    }
    const seen = new Map<string, Declaration>();
    for (const d of declarations) {
      const old = seen.get(d.id); requireThat(!old, `P3-NF-16: duplicate ${d.id}: ${old?.declaredBy.path}/${old?.declaredBy.symbol} and ${d.declaredBy.path}/${d.declaredBy.symbol}`);
      seen.set(d.id, d);
    }
    for (const row of extract.rows) requireThat(seen.has(row.id), `historical entry ${row.id} missing: retain its retired declaration`);
    for (const d of declarations) {
      if (d.profile?.repeats.kind === 'bounded') {
        const bound = seen.get(d.profile.repeats.by);
        requireThat(bound?.status === 'live' && bound.kind === 'critical outcomes' && bound.requiredFacts.probe,
          `P3-NF-06: unresolved live bound/probe ${d.profile.repeats.by}`);
      }
      const shape = ctx.shape.kinds.find(k => k.name === d.kind)!;
      for (const field of shape.fields) if (field.schema) resolveFact(d.requiredFacts[field.name], field.schema, `${d.id}.${field.name}`, seen, ctx);
      for (const field of shape.fields.filter(f => f.reference)) {
        const target = d.requiredFacts[field.name]; if (target === undefined) continue;
        for (const ref of typeof target === 'string' ? [target] : strings(target, field.name))
          requireThat(seen.has(ref), `unresolved ${d.id}.${field.name}: ${ref}`);
      }
    }
    const entries = declarations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(d => entry(d, extract, commit));
    return { type: 'GeneratedRegister', schemaVersion: 1, commit, extract, shape: ctx.shape, entries, authority: 'shape-only' } as unknown as GeneratedRegister;
  });
}
export function generationOf(register: GeneratedRegister, context: RegisterContext) {
  return checked<RegisterGeneration, RegisterContext>('RegisterGenerationDerivation', register, context, raw => {
    const v = object(raw); requireThat(v.type === 'GeneratedRegister' && v.schemaVersion === 1, 'expected GeneratedRegister');
    const extract = object(v.extract!);
    return { type: 'RegisterGeneration', schemaVersion: 1, id: encoding(raw).hash, commit: text(v.commit, 'commit'),
      vector: reference(extract.vector!, 'FactPositionVector') } as RegisterGeneration;
  });
}
export function decodeGeneration(input: unknown, context: RegisterContext) {
  return validated<RegisterGeneration, RegisterContext>('RegisterGeneration', input, context, v => {
    exact(v, ['type', 'schemaVersion', 'id', 'commit', 'vector']); const id = text(v.id, 'generation.id');
    requireThat(/^sha256:[a-f0-9]{64}$/.test(id), 'generation requires canonical hash');
    return { type: 'RegisterGeneration', schemaVersion: 1, id, commit: text(v.commit, 'commit'),
      vector: reference(v.vector!, 'FactPositionVector') } as RegisterGeneration;
  });
}
export function decodeGenerationRecord(input: unknown, context: RegisterContext) {
  return validated<GenerationRecord, RegisterContext>('GenerationRecord', input, context, v => {
    exact(v, ['type', 'schemaVersion', 'generation', 'at']); const at = take(decodeMeasurement('clock', v.at, context.types));
    return { type: 'GenerationRecord', schemaVersion: 1, generation: take(decodeGeneration(v.generation, context)), at } as GenerationRecord;
  });
}
export function loadRegister(input: unknown, expected: RegisterGeneration, context: RegisterContext, spine: SpineReadPort, now: Clock) {
  return validated<VerifiedRegister, RegisterContext>('GeneratedRegister', input, context, (v, ctx) => {
    exact(v, ['type', 'schemaVersion', 'commit', 'extract', 'shape', 'entries', 'authority']);
    requireThat(encoding(v).hash === expected.id && v.commit === expected.commit, 'P3-NF-08: register content differs from pinned generation');
    requireThat(spine.owner === 'part-two', 'part-two verified spine required');
    const shape = take(decodeShape(v.shape, ctx)); const extract = take(decodeExtract(v.extract, ctx));
    requireThat(encoding(extract.vector).bytes === encoding(expected.vector).bytes, 'generation vector differs');
    take(spine.verifyExtract(extract));
    const record = take(spine.enteringForce(expected));
    requireThat(encoding(record.generation).bytes === encoding(expected).bytes, 'P3-NF-21: generation has no matching entering-force record');
    requireThat(take(spine.isCurrent(extract.vector, now)), 'P3-NF-23: extract vector stale or unverifiable');
    const entries = list(v.entries, 'entries');
    const sources = entries.map(raw => { const e = object(raw); const d = object(e.declaration!); const site = object(d.declaredBy!);
      return { path: site.path!, symbol: site.symbol!, declaration: declarationInput(d) }; });
    // Family entries have already been expanded. Revalidate each stored declaration;
    // never enumerate a family twice when loading an already generated register.
    const decoded: RegisterEntry[] = sources.map((s, i) => {
      const d = take(decodeDeclaration(s.declaration, { ...ctx, shape, source: { path: text(s.path, 'path'), symbol: text(s.symbol, 'symbol') } }));
      const rebuilt = entry(d, extract, text(v.commit, 'commit'));
      requireThat(encoding(rebuilt).bytes === encoding(entries[i]).bytes, 'generated entry metadata differs from source history'); return rebuilt;
    });
    requireThat(new Set(decoded.map(e => e.declaration.id)).size === decoded.length, 'P3-NF-16: duplicate loaded entry');
    const instances = Object.fromEntries(decoded.filter(e => e.declaration.family).map(e => [e.declaration.family!.source, []]));
    const rebuilt = take(generateRegister({ commit: v.commit, complete: true, sources, extract, instances }, { ...ctx, shape }));
    requireThat(encoding(rebuilt).bytes === encoding(v).bytes, 'loaded register does not match complete declaration/reference validation');
    requireThat(v.authority === 'shape-only', 'register bytes may not self-assert authority');
    const result = { type: 'GeneratedRegister', schemaVersion: 1, commit: text(v.commit, 'commit'), extract, shape, entries: decoded, authority: 'shape-only' } as unknown as VerifiedRegister;
    loaded.set(result, () => {
      if (!spine.revalidateLoaded) return true;
      return consumeResult(spine.revalidateLoaded(extract, expected, now), { Success: value => value === true, Refused: () => false });
    });
    return result;
  });
}
// The vector and envelope reference imports above intentionally remain owned by P2.
export type { FactPositionVectorReference, FactReference };
