import type { BoundaryContext, Json, ProfileExpression } from '../index.js';
import type { FieldShape, KindShape, ShapeEntries } from './types.js';
import { exact, list, number, object, requireThat, strings, text, validated } from './boundary.js';

function expression(input: Json, depth = 0): ProfileExpression {
  requireThat(depth < 32, 'profile expression exceeds depth'); const v = object(input);
  if ('field' in v) {
    exact(v, ['field', 'in']); const field = text(v.field, 'field');
    requireThat(['consequence', 'reversibility', 'reach', 'surface'].includes(field), 'unknown profile field');
    const values = strings(v.in, 'in'); requireThat(values.length > 0, 'empty profile expression');
    return { field: field as 'consequence' | 'reversibility' | 'reach' | 'surface', in: values };
  }
  const op = 'any' in v ? 'any' : 'all'; exact(v, [op]);
  const children = list(v[op], op).map(child => expression(child, depth + 1));
  requireThat(children.length > 0, 'empty profile expression'); return op === 'any' ? { any: children } : { all: children };
}
export function decodeShape(input: unknown, context: BoundaryContext) {
  return validated<ShapeEntries, BoundaryContext>('ShapeEntries', input, context, v => {
    exact(v, ['type', 'schemaVersion', 'kinds', 'parts', 'derivedFrom']);
    const kinds: KindShape[] = list(v.kinds, 'kinds').map(input => {
      const k = object(input); exact(k, ['name', 'fields', 'profile', 'holder', 'enforceable', 'invariants']);
      requireThat(typeof k.profile === 'boolean' && typeof k.holder === 'boolean', 'kind profile/holder must be boolean');
      const fields: FieldShape[] = list(k.fields, 'fields').map(input => {
        const f = object(input); exact(f, ['name', 'format', 'required', 'values', 'reference', 'terms']);
        const format = text(f.format, 'format'); requireThat(['text', 'number', 'boolean', 'array', 'object', 'scalar'].includes(format), 'unknown field format');
        requireThat(typeof f.required === 'boolean' && typeof f.reference === 'boolean', 'field required/reference must be boolean');
        return { name: text(f.name, 'field.name'), format: format as FieldShape['format'], required: f.required,
          values: strings(f.values, 'values'), reference: f.reference, terms: strings(f.terms, 'terms') };
      });
      requireThat(new Set(fields.map(f => f.name)).size === fields.length, 'duplicate field name');
      const enforceable = list(k.enforceable, 'enforceable').map(v => number(v, 'rule number'));
      requireThat(enforceable.every(n => Number.isSafeInteger(n) && n > 0), 'invalid rule number');
      requireThat(k.holder || enforceable.length === 0, 'non-holder cannot have enforceable subjects');
      return { name: text(k.name, 'kind.name'), fields, profile: k.profile, holder: k.holder,
        enforceable, invariants: strings(k.invariants, 'invariants') };
    });
    requireThat(kinds.length > 0 && new Set(kinds.map(k => k.name)).size === kinds.length, 'duplicate or empty kind roster');
    const parts = list(v.parts, 'parts').map(v => number(v, 'part'));
    requireThat(parts.every(p => Number.isSafeInteger(p) && p > 0) && new Set(parts).size === parts.length, 'invalid part roster');
    const d = object(v.derivedFrom!); exact(d, ['critical', 'significant', 'userFacing', 'irreversible']);
    return { type: 'ShapeEntries', schemaVersion: 1, kinds, parts, derivedFrom: {
      critical: expression(d.critical!), significant: expression(d.significant!),
      userFacing: expression(d.userFacing!), irreversible: expression(d.irreversible!),
    } } as unknown as ShapeEntries;
  });
}
