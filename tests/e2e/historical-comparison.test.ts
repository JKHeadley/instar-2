import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { fixture } from '../fixtures.js';

it('public historical comparison reconstructs records and produces a non-live Conflict in a fresh process', () => {
  const f = fixture(); const a = f.intentInput(); const b = f.intentInput({ raw: f.capture('different') });
  const bundle = { a, b, pins: [f.historyPin(a), f.historyPin(b)], register: f.ctx.register, captures: f.captures,
    subjects: f.ctx.recordSubjects, scope: f.scope };
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { readFileSync } from 'node:fs';
    import { compare, compareHistoricalReads, consumeResult, readHistorical } from '@instar/constitutional-types';
    const data = JSON.parse(readFileSync(0, 'utf8'));
    const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
    const base = { register: data.register, captures: data.captures, preserved: 'capture:fresh-comparison' };
    const a = take(readHistorical('Intent', data.a, data.pins[0], base));
    const b = take(readHistorical('Intent', data.b, data.pins[1], base));
    const context = { register: data.register, preserved: base.preserved, recordSubjects: data.subjects };
    const conflict = take(compareHistoricalReads('Intent', a, b, 'identity', data.scope, context));
    const equal = take(compareHistoricalReads('Intent', a, a, 'version', data.scope, context));
    const mixedRefused = consumeResult(compareHistoricalReads('Intent', a, data.b, 'identity', data.scope, context), { Success: () => false, Refused: () => true });
    const liveRefused = consumeResult(compare('Intent', conflict.view.left, conflict.view.right, 'identity', data.scope, base.preserved), { Success: () => false, Refused: () => true });
    console.log(JSON.stringify({ owner: conflict.owner, kind: conflict.kind, type: conflict.view.type, fields: conflict.view.fields, equal, mixedRefused, liveRefused }));
  `], { input: JSON.stringify(bundle), encoding: 'utf8' });
  expect(JSON.parse(output)).toEqual({ owner: 'part-one', kind: 'derived-conflict', type: 'Conflict', fields: ['raw'], equal: true, mixedRefused: true, liveRefused: true });
});
