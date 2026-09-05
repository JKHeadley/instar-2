import { expect, it } from 'vitest';
import ts from 'typescript';
import { resolve } from 'node:path';
import { createProgram, lintProgram } from '../../scripts/check-architecture.mjs';

const prelude = `
import { compareHistoricalReads, consumeResult, readHistorical } from '@instar/constitutional-types';
import type { Conflict, HistoricalConflict, HistoricalRead, Result, StandingGrant } from '@instar/constitutional-types';
import { fixture } from './fixtures.js';
const f = fixture();
function take<T>(result: Result<T>): T { return consumeResult(result, { Success: v => v, Refused: r => { throw new Error(r.detail); } }); }
const base = { register: f.ctx.register, captures: f.captures, preserved: f.ctx.preserved };
const grant = take(readHistorical('StandingGrant', f.g, f.historyPin(f.g), base));
const second = f.grant({ expiresAt: 200 });
const other = take(readHistorical('StandingGrant', second, f.historyPin(second), base));
declare const live: StandingGrant;
const context = { register: f.ctx.register, preserved: f.ctx.preserved, recordSubjects: {} };
function product(): HistoricalConflict {
  const r = take(compareHistoricalReads('StandingGrant', grant, other, 'identity', f.scope, context));
  if (typeof r === 'boolean') throw new Error('no conflict');
  return r;
}
const conflict = product();
`;
const cases = {
  'live-left': 'compareHistoricalReads("StandingGrant", live, grant, "identity", f.scope, context);',
  'live-right': 'compareHistoricalReads("StandingGrant", grant, live, "identity", f.scope, context);',
  'different-types': 'compareHistoricalReads("Authorization", grant, grant, "identity", f.scope, context);',
  'live-conflict': 'const counterfeit: Conflict = conflict;',
  'live-view': 'const counterfeit: Conflict = conflict.view;',
  'origin-read': 'const origin: HistoricalRead<Conflict> = conflict;',
  'spread-construction': 'const forged: HistoricalConflict = { ...conflict, view: { ...conflict.view, fields: [] } };',
};
const sources = Object.fromEntries(Object.entries(cases).map(([name, source]) => [`tests/virtual-historical-compare-${name}.ts`, prelude + source]));
sources['tests/virtual-historical-compare-valid.ts'] = prelude + `
const retained: { conflict: HistoricalConflict } = { conflict };
const owner = retained.conflict.owner;
const fields = retained.conflict.view.fields;
`;
const program = createProgram(sources);
const errors = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error);
for (const name of Object.keys(cases)) it(`historical comparison statically refuses ${name}`, () => {
  const failures = errors.filter(d => d.file?.fileName === resolve(`tests/virtual-historical-compare-${name}.ts`));
  expect(failures.length).toBeGreaterThan(0);
  for (const d of failures) expect(d.start).toBeGreaterThanOrEqual(prelude.length);
});
it('historical comparison producer and non-authorizing downstream retention compile', () => {
  const file = 'tests/virtual-historical-compare-valid.ts';
  expect(errors.filter(d => d.file?.fileName === resolve(file)).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
  expect(lintProgram(program, [file])).toEqual([]);
});
