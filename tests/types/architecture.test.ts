import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { createProgram, lintProgram } from '../../scripts/check-architecture.mjs';

const prelude = `import type { Result, Evidence, Outcome, Conflict, Capacity, Clock, Decision, StandingGrant, DecodeContext } from '../src/index.js';
declare const result: Result<string>, evidence: Evidence, outcome: Outcome, conflict: Conflict, capacity: Capacity;
declare const now: Clock, decision: Decision, grant: StandingGrant, context: DecodeContext;
`;
const fixtures = {
  'NF-14': `function lie() { if (result.kind === 'Refused') return { kind: 'Success', value: 'handled' }; return result; }`,
  'NF-15': `function errorBranch() { if (capacity.kind === 'applied') return { error: true }; return { error: false }; }`,
  'NF-46': `function retry() { if (outcome.kind === 'uncertain') return { kind: 'did-not-happen' }; return outcome; }`,
  'NF-66': `function staleRead() { return evidence.claim; }`,
  'NF-69': `function choose() { return conflict.right; }`,
};
const bindings = { 'NF-14': ['Result<string>', 'kind'], 'NF-15': ['Capacity', 'kind'], 'NF-46': ['Outcome', 'kind'], 'NF-66': ['Evidence', 'claim'], 'NF-69': ['Conflict', 'right'] };
const programs = Object.entries(fixtures).flatMap(([id, code]) => {
  const [type, field] = bindings[id as keyof typeof bindings]!;
  return [
    { id, form: 'property', code },
    { id, form: 'parameter', code: `function bypass({ ${field} }: ${type}) { return ${field}; }` },
    { id, form: 'arrow-alias', code: `const bypass = ({ ${field}: renamed }: ${type}) => renamed;` },
    { id, form: 'rest', code: `function bypass({ ...rest }: ${type}) { return rest; }` },
    { id, form: 'nested', code: `function bypass({ wrapped: { ${field} } }: { wrapped: ${type} }) { return ${field}; }` },
    { id, form: 'assignment', code: `declare const input: ${type}; let chosen: unknown; ({ ${field}: chosen } = input);` },
    { id, form: 'nested-assignment', code: `declare const input: { wrapped: ${type} }; let chosen: unknown; ({ wrapped: { ${field}: chosen } } = input);` },
    { id, form: 'tuple-assignment', code: `declare const input: [${type}]; let chosen: unknown; ([{ ${field}: chosen }] = input);` },
    { id, form: 'for-of', code: `declare const inputs: ${type}[]; for (const { ${field} } of inputs) { void ${field}; }` },
    { id, form: 'method', code: `const object = { bypass({ ${field} }: ${type}) { return ${field}; } };` },
  ];
});
const sources = Object.fromEntries(programs.map(({ id, form, code }) => [`tests/lint-${id}-${form}.ts`, prelude + code]));
sources['src/virtual-impure.ts'] = `import { readFileSync } from 'node:fs'; export function impure() { return [Date.now(), readFileSync('x'), fetch('https://example.invalid')]; }`;
sources['tests/lint-detector-symbol.ts'] = `import { existsSync } from 'node:fs'; export const probe = () => existsSync('/tmp/marker') && Date.now() > 0;`;
sources['tests/lint-detector-ports.ts'] = `export const probe = (ports: { read(): number }) => ports.read() > 0;`;
sources['tests/lint-safe.ts'] = prelude + `
import { consumeResult, consumeCapacity, consumeOutcome, readEvidence, retryPermission, resolveConflict } from '../src/index.js';
export const handled = consumeResult(result, {
  Success: (value, cap) => value + consumeCapacity(cap, { none: () => '', applied: (bound, action) => bound + action }),
  Refused: refused => refused.reason,
});
export const claim = readEvidence(evidence, now, 'capture:safe');
export const retry = retryPermission(outcome, 'capture:safe');
export const effect = consumeOutcome(outcome, { happened: e => e.length, 'did-not-happen': e => e.length, uncertain: e => e.length });
export const resolved = resolveConflict(conflict, decision, grant, now, context);
`;
const program = createProgram(sources);
const diagnostics = ts.getPreEmitDiagnostics(program);
describe('architecture checks reject programs that compile', () => {
  for (const { id, form } of programs) it(`${id} rejects a compiling ${form} bypass`, () => {
    const path = `tests/lint-${id}-${form}.ts`;
    expect(diagnostics.filter(d => d.file?.fileName.endsWith(path)).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
    expect(lintProgram(program, [path]).some(i => i.rule === id)).toBe(true);
  });
  it('NF-52 refuses clock, filesystem, and network dependencies in the core', () => {
    const issues = lintProgram(program, ['src/virtual-impure.ts']);
    expect(issues.filter(i => i.rule === 'NF-52').length).toBeGreaterThanOrEqual(3);
  });
  it('NF-26 holds a declared detector module to its observation ports (Rule 26, live runner)', () => {
    const detectors = ['tests/lint-detector-symbol.ts', 'tests/lint-detector-ports.ts'];
    const issues = lintProgram(program, detectors, detectors).filter(i => i.rule === 'NF-26');
    expect(issues.filter(i => i.file.endsWith('lint-detector-symbol.ts')).length).toBeGreaterThanOrEqual(3);
    expect(issues.filter(i => i.file.endsWith('lint-detector-ports.ts'))).toEqual([]);
    // The same file is not a detector unless declared: the rule binds only named boundaries.
    expect(lintProgram(program, ['tests/lint-detector-symbol.ts'], []).filter(i => i.rule === 'NF-26')).toEqual([]);
  });
  it('the live runner\'s proof module is a declared detector and passes', async () => {
    const { DETECTOR_MODULES } = await import('../../scripts/check-architecture.mjs');
    expect(DETECTOR_MODULES).toContain('tests/preview/proofs.ts');
    expect(lintProgram(createProgram(), ['tests/preview/proofs.ts'])).toEqual([]);
  });
  it('public doorways compile and are permitted when actually consumed', () => {
    expect(diagnostics.filter(d => d.file?.fileName.endsWith('tests/lint-safe.ts')).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
    expect(lintProgram(program, ['tests/lint-safe.ts'])).toEqual([]);
  });
});
