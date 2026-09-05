import { deriveProfile } from '../index.js';
import type { Json } from '../index.js';
import type { GeneratedRegister, RegisterContext, RegisterValue } from '../register/types.js';
import { checked, encoding, list, object, requireThat, strings, take, text } from '../register/boundary.js';

export type TermResolution = RegisterValue<'TermResolution'> & Readonly<{
  usedBy: Readonly<Record<string, readonly string[]>>;
  adjectives: Readonly<Record<string, Readonly<Record<'critical' | 'significant' | 'userFacing' | 'irreversible', boolean>>>>;
  warnings: readonly string[];
}>;
export function resolveTerms(register: GeneratedRegister, context: RegisterContext) {
  return checked<TermResolution, RegisterContext>('TermResolution', register, context, () => {
    const terms = register.entries.filter(e => e.declaration.kind === 'terms' && e.declaration.status === 'live').map(e => e.declaration);
    const ids = new Map(terms.map(t => [t.id, t])); const names = terms.map(t => text(t.requiredFacts.name, 'term.name'));
    requireThat(new Set(names).size === names.length, 'P3-NF-10: multiple live definitions of a term');
    const usedBy: Record<string, string[]> = Object.fromEntries(terms.map(t => [t.id, []])); const warnings: string[] = [];
    const use = (id: string, site: string) => { requireThat(ids.has(id), `P3-NF-10: ${site} uses missing live term ${id}`); usedBy[id]!.push(site); };
    for (const { declaration: d } of register.entries) {
      const refs = d.requiredFacts.termRefs === undefined ? [] : strings(d.requiredFacts.termRefs, 'termRefs');
      for (const ref of refs) use(ref, d.id);
      const prose = [d.requiredFacts.statement, d.requiredFacts.definition].filter(v => typeof v === 'string').join(' ').toLowerCase();
      for (const term of terms) {
        const name = text(term.requiredFacts.name, 'name').toLowerCase();
        if (prose.includes(name) && !refs.includes(term.id) && term.id !== d.id) warnings.push(`${d.id}: unreferenced occurrence of ${name}`);
      }
      for (const name of ['critical', 'significant', 'significance', 'userFacing', 'irreversible'])
        requireThat(!(name in d.requiredFacts), `P3-NF-11: ${d.id} asserts derived adjective ${name}`);
    }
    for (const kind of register.shape.kinds) for (const field of kind.fields)
      for (const id of field.terms) use(id, `shape:${kind.name}.${field.name}`);
    for (const term of terms) {
      if (usedBy[term.id]!.length === 0) warnings.push(`unused term: ${term.id}`);
      if (term.requiredFacts.kind === 'adjective') {
        const key = text(term.requiredFacts.name, 'name') === 'user-facing' ? 'userFacing' : text(term.requiredFacts.name, 'name');
        requireThat(Object.hasOwn(register.shape.derivedFrom, key), `unknown profile adjective ${key}`);
        requireThat(encoding(term.requiredFacts.derivedFrom).bytes === encoding(register.shape.derivedFrom[key as keyof typeof register.shape.derivedFrom]).bytes,
          `P3-NF-11: term ${term.id} and shape derivation disagree`);
      }
    }
    const adjectives = Object.fromEntries(register.entries.filter(e => e.declaration.profile).map(({ declaration: d }) => [d.id,
      take(deriveProfile(d.profile!, { owner: 'part-three', derivedFrom: register.shape.derivedFrom }, context.preserved))]));
    return { type: 'TermResolution', schemaVersion: 1, usedBy, adjectives, warnings } as unknown as TermResolution;
  });
}
export function verifyDerivedColumns(actual: unknown, resolution: TermResolution, context: RegisterContext) {
  return checked('DerivedColumnCheck', actual, context, raw => {
    requireThat(encoding(raw).bytes === encoding(resolution.adjectives).bytes, 'P3-NF-11: asserted adjective differs from computed profile'); return true;
  });
}
