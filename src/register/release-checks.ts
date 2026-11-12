import type { GeneratedRegister } from './types.js';

export type RequiredReleaseCheck = Readonly<{
  id: string; evidenceLocation: string; stage: 'build' | 'runtime';
}>;
// Rules 26/95: these are obligations, never execution results or passing verdicts.
// The caller supplies a generated register whose declarations passed its shape decoder.
export function requiredReleaseChecks(register: GeneratedRegister): readonly (RequiredReleaseCheck & { readonly rule: number })[] {
  return register.entries.flatMap(({ declaration: d }) => d.kind === 'rules' && d.requiredFacts.requiredReleaseCheck !== undefined
    ? [{ rule: d.requiredFacts.number as number, ...(d.requiredFacts.requiredReleaseCheck as unknown as RequiredReleaseCheck) }]
    : []).sort((a, b) => a.rule - b.rule);
}
