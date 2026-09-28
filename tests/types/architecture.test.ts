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
  it('public doorways compile and are permitted when actually consumed', () => {
    expect(diagnostics.filter(d => d.file?.fileName.endsWith('tests/lint-safe.ts')).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
    expect(lintProgram(program, ['tests/lint-safe.ts'])).toEqual([]);
  });
});

describe('NF-10: intent-decision sites never branch on a literal meaning classifier (Rule 10)', () => {
  it('flags a keyword-gated decision offer, search offer or promise reader, and passes the live runner', async () => {
    const { lintIntentSites } = await import('../../scripts/check-architecture.mjs');
    expect(lintIntentSites()).toEqual([]);
    const flagged = lintIntentSites({
      'tests/preview/journal.ts': [
        'const summaryDecision = fromOperator(turn) && /\\b(?:summar|recap)/iu.test(turn.text);',
        'const search = /\\bremember\\b/iu.test(turn.text) ? searchFor(turn) : undefined;',
        'const packet = { ...(/\\bundo\\b/iu.test(text) ? { undoDecision: "x" } : {}), ...(ready ? { datedDecision: "y" } : {}) };',
      ].join('\n'),
      'tests/preview/agent-commitment.ts': 'export function promiseProposals(value: unknown, reply: string) { return /I will/u.test(reply); }',
    }).map((issue: { rule: string; detail: string }) => `${issue.rule} ${issue.detail}`);
    expect(flagged).toEqual(['NF-10 summaryDecision branches on a literal meaning classifier',
      'NF-10 search branches on a literal meaning classifier', 'NF-10 undoDecision branches on a literal meaning classifier',
      'NF-10 promiseProposals branches on a literal meaning classifier']);
  });
});
