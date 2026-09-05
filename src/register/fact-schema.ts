import type { Json } from '../index.js';
import type { Declaration, RegisterContext } from './types.js';
import { exact, list, number, object, requireThat, strings, text } from './boundary.js';

export type FactSchema = Readonly<{
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'union';
  optional?: boolean; values?: readonly string[]; minimum?: number;
  fields?: Readonly<Record<string, FactSchema>>; items?: FactSchema; alternatives?: readonly FactSchema[];
  reference?: Readonly<{ provider: string; kind?: string }>;
}>;
export function parseFactSchema(input: Json, depth = 0): FactSchema {
  requireThat(depth < 24, 'fact schema too deep'); const v = object(input);
  exact(v, ['type', 'optional', 'values', 'minimum', 'fields', 'items', 'alternatives', 'reference']);
  requireThat(['string', 'number', 'boolean', 'object', 'array', 'union'].includes(text(v.type, 'schema.type')), 'unknown fact schema');
  requireThat(v.optional === undefined || typeof v.optional === 'boolean', 'schema.optional must be boolean');
  if (v.values !== undefined) strings(v.values, 'schema.values');
  if (v.minimum !== undefined) number(v.minimum, 'schema.minimum');
  if (v.reference !== undefined) { const r = object(v.reference); exact(r, ['provider', 'kind']); text(r.provider, 'reference.provider'); if (r.kind !== undefined) text(r.kind, 'reference.kind'); }
  if (v.type === 'object') for (const child of Object.values(object(v.fields!))) parseFactSchema(child, depth + 1);
  if (v.type === 'array') parseFactSchema(v.items!, depth + 1);
  if (v.type === 'union') { const choices = list(v.alternatives, 'alternatives'); requireThat(choices.length > 1, 'union needs alternatives'); for (const c of choices) parseFactSchema(c, depth + 1); }
  return v as unknown as FactSchema;
}
export function validateFact(value: Json | undefined, schema: FactSchema, path: string): void {
  if (value === undefined && schema.optional) return;
  if (schema.type === 'union') {
    requireThat(schema.alternatives!.some(s => { try { validateFact(value, s, path); return true; } catch { return false; } }), `P3-NF-05: ${path} matches no allowed fact variant`); return;
  }
  if (schema.type === 'string') { const s = text(value, path); requireThat(!schema.values || schema.values.includes(s), `P3-NF-05: ${path} outside closed list`); }
  if (schema.type === 'number') requireThat(number(value, path) >= (schema.minimum ?? -Infinity), `P3-NF-05: ${path} below minimum`);
  if (schema.type === 'boolean') requireThat(typeof value === 'boolean', `${path} must be boolean`);
  if (schema.type === 'object') { const o = object(value!); exact(o, Object.keys(schema.fields!)); for (const [key, child] of Object.entries(schema.fields!)) validateFact(o[key], child, `${path}.${key}`); }
  if (schema.type === 'array') { const a = list(value, path); requireThat(a.length >= (schema.minimum ?? 0), `${path} empty`); for (const item of a) validateFact(item, schema.items!, path); }
}
export function resolveFact(value: Json | undefined, schema: FactSchema, path: string, declarations: ReadonlyMap<string, Declaration>, context: RegisterContext): void {
  if (value === undefined) return;
  if (schema.reference) {
    const id = text(value, path); const r = schema.reference;
    const d = declarations.get(id);
    requireThat(r.provider === 'declaration' ? !!d && d.status !== 'retired' && (!r.kind || d.kind === r.kind)
      : context.references?.some(e => e.provider === r.provider && e.id === id && (!r.kind || e.kind === r.kind)), `unresolved ${path}: ${r.provider} ${id}`);
  }
  if (schema.type === 'object') for (const [key, child] of Object.entries(schema.fields!)) resolveFact(object(value)[key], child, `${path}.${key}`, declarations, context);
  if (schema.type === 'array') for (const item of list(value, path)) resolveFact(item, schema.items!, path, declarations, context);
  if (schema.type === 'union') for (const child of schema.alternatives!) {
    let matches = false; try { validateFact(value, child, path); matches = true; } catch { /* another closed variant */ }
    if (matches) { resolveFact(value, child, path, declarations, context); break; }
  }
}
