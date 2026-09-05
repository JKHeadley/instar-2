import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { compare, decode } from '../../src/index.js';
import { fixture, raw, value } from '../fixtures.js';
it('production package export is live in a fresh Node process', () => {
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { canonical, consumeResult, decode, defineDecoder, readHistorical, rehydrateResult, rehydrateConflict, rehydrateOutcome, schemas } from '@instar/constitutional-types';
    const encoded = consumeResult(canonical({ type: 'Example', schemaVersion: 1 }), { Success: x => x, Refused: r => { throw new Error(r.detail); } });
    const refusal = consumeResult(decode('Profile', null, { preserved: 'capture:e2e' }), { Success: () => { throw new Error('null accepted'); }, Refused: r => r });
    console.log(JSON.stringify({ count: Object.keys(schemas).length, hash: encoded.hash, reason: refusal.reason, preserved: refusal.preserved,
      seams: [defineDecoder, readHistorical, rehydrateResult, rehydrateConflict, rehydrateOutcome].every(x => typeof x === 'function') }));
  `], { encoding: 'utf8' });
  expect(JSON.parse(output)).toMatchObject({ count: 18, reason: 'decode', preserved: 'capture:e2e', seams: true });
});
it('R3 saves records and reconstructs historical authority and unavailable Evidence in a fresh process', () => {
  const f = fixture();
  const payload = { id: 'r1', grantId: f.g.id, by: f.alice, at: f.now, reason: 'withdrawn' }; const { p } = f.proof(payload);
  const revocation = value(decode('Revocation', raw('Revocation', { ...payload, source: p }), { ...f.ctx, provenance: p }));
  const conflicting = f.grant({ expiresAt: 200 });
  const conflict = value(compare('StandingGrant', f.g, conflicting, 'identity', f.scope, f.ctx.preserved));
  const records = { grant: f.g, authorization: f.authorization, revocation, conflict, evidence: f.e };
  const pins = Object.fromEntries(Object.entries(records).map(([name, record]) => [name, f.historyPin(record)]));
  delete f.captures['capture:evidence'];
  const bundle = { records, pins, register: f.ctx.register, captures: f.captures, now: f.clockRaw() };
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { readFileSync } from 'node:fs';
    import { consumeResult, decode, decodeMeasurement, readHistorical, readHistoricalEvidence } from '@instar/constitutional-types';
    const bundle = JSON.parse(readFileSync(0, 'utf8'));
    const value = result => consumeResult(result, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
    const base = { register: bundle.register, captures: bundle.captures, preserved: 'capture:fresh-read', captureStatuses: { 'capture:evidence': 'tombstoned' } };
    const context = { ...base, now: value(decodeMeasurement('clock', bundle.now, base)) };
    const grant = value(readHistorical('StandingGrant', bundle.records.grant, bundle.pins.grant, context));
    const withGrant = { ...context, history: [grant] };
    const authorization = value(readHistorical('Authorization', bundle.records.authorization, bundle.pins.authorization, withGrant));
    const revocation = value(readHistorical('Revocation', bundle.records.revocation, bundle.pins.revocation, withGrant));
    const conflict = value(readHistorical('Conflict', bundle.records.conflict, bundle.pins.conflict, withGrant));
    const evidence = value(readHistorical('Evidence', bundle.records.evidence, bundle.pins.evidence, context));
    const unavailable = consumeResult(readHistoricalEvidence(evidence, context.now, context.preserved), { Success: () => false, Refused: r => r.detail.includes('evidence-unavailable') });
    const liveRefused = consumeResult(decode('StandingGrant', bundle.records.grant, { ...context, provenance: grant.view.source, principals: [grant.view.grantee] }), { Success: () => false, Refused: () => true });
    console.log(JSON.stringify({ grant: grant.view.id, authorization: authorization.view.under, revocation: revocation.view.grantId,
      conflict: conflict.view.type, status: evidence.captureStatus, unavailable, liveRefused }));
  `], { input: JSON.stringify(bundle), encoding: 'utf8' });
  expect(JSON.parse(output)).toEqual({ grant: 'g1', authorization: 'g1', revocation: 'g1', conflict: 'Conflict', status: 'tombstoned', unavailable: true, liveRefused: true });
});
it('NF-39 N1 historical body timestamps are independently checked in a fresh public-package process', () => {
  const f = fixture(); const grant = f.grant({ id: 'limited', expiresAt: 105 });
  const grantPin = f.historyPin(grant);
  const cases = [99, 100, 104, 105, 106].map(at => {
    const record = f.authInput({ under: grant.id, at: f.clock(at) }).input;
    return { at, record, pin: f.historyPin(record) };
  });
  const bundle = { grant, grantPin, cases, register: f.ctx.register, captures: f.captures, now: f.clockRaw() };
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { readFileSync } from 'node:fs';
    import { consumeResult, decodeMeasurement, readHistorical } from '@instar/constitutional-types';
    const b = JSON.parse(readFileSync(0, 'utf8'));
    const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
    const base = { register: b.register, captures: b.captures, preserved: 'capture:body-time-e2e' };
    const context = { ...base, now: take(decodeMeasurement('clock', b.now, base)) };
    const grant = take(readHistorical('StandingGrant', b.grant, b.grantPin, context));
    console.log(JSON.stringify(b.cases.map(c => [c.at, consumeResult(readHistorical('Authorization', c.record, c.pin, { ...context, history: [grant] }), {
      Success: () => 'accepted', Refused: r => r.detail.includes('not live') ? 'not-live' : r.detail,
    })])));
  `], { input: JSON.stringify(bundle), encoding: 'utf8' });
  expect(JSON.parse(output)).toEqual([[99, 'not-live'], [100, 'accepted'], [104, 'accepted'], [105, 'not-live'], [106, 'not-live']]);
});
