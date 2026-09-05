import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { createProgram, lintProgram } from '../../scripts/check-architecture.mjs';

const prelude = `import type { Result, Evidence, Outcome, Conflict, Capacity } from '../src/index.js';
declare const result: Result<string>, evidence: Evidence, outcome: Outcome, conflict: Conflict, capacity: Capacity;
`;
const fixtures = {
  'NF-14': `function lie() { if (result.kind === 'Refused') return { kind: 'Success', value: 'handled' }; return result; }`,
  'NF-15': `function errorBranch() { if (capacity.kind === 'applied') return { error: true }; return { error: false }; }`,
  'NF-46': `function retry() { if (outcome.kind === 'uncertain') return { kind: 'did-not-happen' }; return outcome; }`,
  'NF-66': `function staleRead() { return evidence.claim; }`,
  'NF-69': `function choose() { return conflict.right; }`,
};
const sources = Object.fromEntries(Object.entries(fixtures).map(([id, code]) => [`tests/lint-${id}.ts`, prelude + code]));
sources['src/virtual-impure.ts'] = `import { readFileSync } from 'node:fs'; export function impure() { return [Date.now(), readFileSync('x'), fetch('https://example.invalid')]; }`;
sources['tests/lint-safe.ts'] = `import { consumeResult, readEvidence, retryPermission, resolveConflict } from '../src/index.js'; export const consumers = [consumeResult, readEvidence, retryPermission, resolveConflict];`;
const program = createProgram(sources);
describe('architecture checks reject programs that compile', () => {
  for (const id of Object.keys(fixtures)) it(`${id} rejects a typed bypass`, () => {
    const path = `tests/lint-${id}.ts`;
    const diagnostics = ts.getPreEmitDiagnostics(program).filter(d => d.file?.fileName.endsWith(path));
    expect(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
    expect(lintProgram(program, [path]).some(i => i.rule === id)).toBe(true);
  });
  it('NF-52 refuses clock, filesystem, and network dependencies in the core', () => {
    const issues = lintProgram(program, ['src/virtual-impure.ts']);
    expect(issues.filter(i => i.rule === 'NF-52').length).toBeGreaterThanOrEqual(3);
  });
  it('public doorways are permitted', () => { expect(lintProgram(program, ['tests/lint-safe.ts'])).toEqual([]); });
});
