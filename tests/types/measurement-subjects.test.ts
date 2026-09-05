import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createProgram, lintProgram } from '../../scripts/check-architecture.mjs';
import { fixture, raw } from '../fixtures.js';

// Use built package exports, exactly as the desk's probe does. These are ordinary
// parser signatures; the producer is valid, but a pattern is not one known subject.
const subjects = {
  'desk-pattern': '`${string}-${string}`',
  'prefix-pattern': '`detection-${string}`',
  'suffix-pattern': '`${string}-latency`',
  'number-pattern': '`latency-${number}`',
  'bigint-pattern': '`latency-${bigint}`',
  'uppercase-pattern': 'Uppercase<string>',
  'lowercase-pattern': 'Lowercase<string>',
  'capitalize-pattern': 'Capitalize<string>',
  'uncapitalize-pattern': 'Uncapitalize<string>',
  'intrinsic-template-pattern': 'Uppercase<`${string}-${number}`>',
  'pattern-intersection': '`${string}-latency` & `detection-${string}`',
  'branded-string': 'string & { readonly brand: "subject" }',
  'pattern-or-literal': '`${string}-latency` | "clock"',
  'finite-pattern': '`${"detection" | "time"}-${"latency" | "remaining"}`',
  'boolean-pattern': '`subject-${boolean}`',
  'broad-string': 'string',
  'literal-union': '"detection-latency" | "time-remaining"',
};
const header = `import { compareMeasurements, consumeResult, decodeMeasurement } from '@instar/constitutional-types';
import type { DecodeContext, Result } from '@instar/constitutional-types';
declare const ctx: DecodeContext, leftBytes: unknown, rightBytes: unknown;
function take<T>(r: Result<T>): T { return consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } }); }
`;
const sources: Record<string, string> = {};
for (const [name, subject] of Object.entries(subjects)) {
  const producer = header + `type Subject = ${subject};
function parse(subject: Subject, bytes: unknown) { return take(decodeMeasurement(subject, bytes, ctx)); }
declare const leftSubject: Subject, rightSubject: Subject;
const left = parse(leftSubject, leftBytes), right = parse(rightSubject, rightBytes);
`;
  sources[`tests/subject-${name}-producer.ts`] = producer;
  sources[`tests/subject-${name}-comparison.ts`] = producer + 'compareMeasurements(left, right, "capture:desk");';
}
sources['tests/subject-exact-desk.ts'] = header + `
function parse(subject: ${subjects['desk-pattern']}, bytes: unknown) { return take(decodeMeasurement(subject, bytes, ctx)); }
const latency = parse('detection-latency', leftBytes);
const remaining = parse('time-remaining', rightBytes);
compareMeasurements(latency, remaining, 'capture:desk');
`;
sources['tests/subject-singletons.ts'] = header + `
const a = take(decodeMeasurement('detection-latency', leftBytes, ctx));
const b = take(decodeMeasurement('detection-latency', rightBytes, ctx));
compareMeasurements(a, b, 'capture:singleton');
const clock = take(decodeMeasurement('clock', leftBytes, ctx));
compareMeasurements(clock, clock, 'capture:clock');
function genericParse<S extends string>(subject: S, bytes: unknown) { return take(decodeMeasurement(subject, bytes, ctx)); }
const literal = genericParse('任意-🚀-subject', leftBytes);
compareMeasurements(literal, literal, 'capture:unicode-literal');
type ConcreteTemplate = ${'`${"detection"}-${"latency"}`'};
function concrete(subject: ConcreteTemplate, bytes: unknown) { return take(decodeMeasurement(subject, bytes, ctx)); }
const exact = concrete('detection-latency', leftBytes);
compareMeasurements(exact, exact, 'capture:finite-template');
enum Subject { Clock = 'clock' }
const enumValue = genericParse(Subject.Clock, leftBytes);
compareMeasurements(enumValue, enumValue, 'capture:enum-member');
`;
const program = createProgram(sources);
const errors = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error);
const diagnostics = (path: string) => errors.filter(d => d.file?.fileName === resolve(path));
function onlyComparisonFails(path: string) {
  const failures = diagnostics(path);
  expect(failures.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).not.toEqual([]);
  for (const d of failures) expect(d.file!.text.split('\n')[d.file!.getLineAndCharacterOfPosition(d.start!).line]).toContain('compareMeasurements');
}
describe('NF-19 requires concrete singleton subject knowledge through public producers', () => {
  for (const name of Object.keys(subjects)) it(`NF-19 R4.2 permits ${name} decoding but refuses its comparison`, () => {
    const path = `tests/subject-${name}-producer.ts`;
    expect(diagnostics(path).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
    expect(lintProgram(program, [path])).toEqual([]);
    onlyComparisonFails(`tests/subject-${name}-comparison.ts`);
  });
  it('NF-19 R4.2 rejects the exact desk parser and preserves concrete singleton producers', () => {
    onlyComparisonFails('tests/subject-exact-desk.ts');
    expect(diagnostics('tests/subject-singletons.ts').map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
    expect(lintProgram(program, ['tests/subject-singletons.ts'])).toEqual([]);
  });
  it('NF-19 R4.2 retains runtime refusal for the exact pattern parser executed as JavaScript', () => {
    const f = fixture();
    const measurement = (kind: string) => raw('Measurement', { subject: { kind, instance: 'machine-a' }, value: 5, unit: 'ms', at: f.now, by: 'probe' });
    const probe = sources['tests/subject-exact-desk.ts']!.replace("compareMeasurements(latency, remaining, 'capture:desk');", `
      console.log(consumeResult(compareMeasurements(latency, remaining, 'capture:desk'), {
        Success: () => 'unexpected arithmetic', Refused: r => r.detail,
      }));`);
    // Deliberately erase types for the untyped-caller control. The test immediately
    // above separately proves this same parser's comparison cannot type-check.
    const javascript = ts.transpileModule(probe, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import { readFileSync } from 'node:fs';
      const { ctx, leftBytes, rightBytes } = JSON.parse(readFileSync(0, 'utf8'));
      ${javascript}
    `], { input: JSON.stringify({ ctx: f.ctx, leftBytes: measurement('detection-latency'), rightBytes: measurement('time-remaining') }), encoding: 'utf8' });
    expect(result.trim()).toBe('measurement comparison: subject, instance, or unit mismatch');
  });
});
