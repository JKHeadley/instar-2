import type { Json } from '../index.js';
import type { GeneratedRegister } from './types.js';
import { object, requireThat } from './boundary.js';
import { validateFact } from './fact-schema.js';

export type RequiredReleaseCheck = Readonly<{
  id: string; evidenceLocation: string; stage: 'build' | 'runtime';
}>;
// Source-bound release metadata, never execution results or new governing facts.
export function requiredReleaseChecks(register: GeneratedRegister, input: Json): readonly (RequiredReleaseCheck & { readonly rule: number })[] {
  const rules = new Set(register.entries.filter(e => e.declaration.kind === 'rules').map(e => String(e.declaration.requiredFacts.number)));
  return Object.entries(object(input)).map(([rule, check]) => {
    requireThat(rules.has(rule), 'release check names unknown rule ' + rule);
    validateFact(check, { type: 'object', fields: {
      id: { type: 'string' }, evidenceLocation: { type: 'string' }, stage: { type: 'string', values: ['build', 'runtime'] },
    } }, 'requiredReleaseCheck');
    return { rule: Number(rule), ...(check as unknown as RequiredReleaseCheck) };
  }).sort((a, b) => a.rule - b.rule);
}
