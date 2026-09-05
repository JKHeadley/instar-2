import { describe, expect, it } from 'vitest';
import { compareHistoricalReads, decode, decodeMeasurement, readHistorical } from '../../src/index.js';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { clone, digest, fixture, raw, value } from '../fixtures.js';

const refused = <T>(r: Result<T>, detail: string) => consumeResult(r, {
  Success: () => { throw new Error('expected refusal'); }, Refused: r => { expect(r.detail).toContain(detail); expect(r.preserved).toBeTruthy(); },
});
function setup() {
  const f = fixture();
  const a = f.intentInput(); const b = f.intentInput({ raw: f.capture('machine B asks differently'), receivedAt: value(decodeMeasurement('clock', f.clockRaw(101, 'machine-b'), f.ctx)) });
  const base = { register: f.ctx.register, captures: f.captures, preserved: f.ctx.preserved, now: f.now };
  const aPin = f.historyPin(a); const bPin = f.historyPin(b);
  const left = value(readHistorical('Intent', a, aPin, base)); const right = value(readHistorical('Intent', b, bPin, base));
  const context = { register: f.ctx.register, preserved: f.ctx.preserved, recordSubjects: { [digest(a)]: f.scope, [digest(b)]: f.scope } };
  return { f, a, b, aPin, bPin, left, right, base, context };
}
describe('historical comparison public consumer', () => {
  it('NF-68 derives a frozen non-authorizing Conflict from genuine two-machine reads', () => {
    const { f, left, right, context } = setup();
    const result = value(compareHistoricalReads('Intent', left, right, 'identity', f.scope, context));
    expect(result).toMatchObject({ owner: 'part-one', mode: 'historical', kind: 'derived-conflict', sources: [left.origin, right.origin],
      view: { type: 'Conflict', fields: ['raw', 'receivedAt'], origins: ['machine-a', 'machine-b'], subject: f.scope, left: left.view, right: right.view } });
    expect(Object.isFrozen(result)).toBe(true);
    if (typeof result === 'boolean') throw new Error('missing Conflict');
    expect(Object.isFrozen(result.view)).toBe(true);
    expect(value(compareHistoricalReads('Intent', left, right, 'identity', f.scope, context))).toEqual(result);
  });
  it('uses the existing identity, version, and value rules for equality and inequality', () => {
    const { f, a, left, base, context } = setup();
    const otherId = { ...a, id: 'another' };
    const other = value(readHistorical('Intent', otherId, f.historyPin(otherId), base));
    expect(value(compareHistoricalReads('Intent', left, left, 'identity', f.scope, context))).toBe(true);
    expect(value(compareHistoricalReads('Intent', left, left, 'version', f.scope, context))).toBe(true);
    expect(value(compareHistoricalReads('Intent', left, other, 'identity', f.scope, context))).toBe(false);
    expect(value(compareHistoricalReads('Intent', left, other, 'version', f.scope, context))).toBe(false);
    expect(value(compareHistoricalReads('Intent', left, other, 'value', f.scope, context))).toBe(true);
    const profile = value(readHistorical('Profile', f.profileInput(), f.historyPin(f.profileInput()), base));
    expect(value(compareHistoricalReads('Profile', profile, profile, 'value', f.scope, context))).toBe(true);
    refused(compareHistoricalReads('Profile', profile, profile, 'identity', f.scope, context), 'value equality only');
  });
  it('NF-75 binds scopeless conflicts to independently admitted subject context without mutating reads', () => {
    const { f, a, b, aPin, left, right, base, context } = setup();
    refused(compareHistoricalReads('Intent', left, right, 'identity', f.scope, { ...context, recordSubjects: {} }), 'independent admission context');
    refused(compareHistoricalReads('Intent', left, right, 'identity', f.scope, { ...context, recordSubjects: { [digest(a)]: f.scope } }), 'independent admission context');
    const projectB = raw('Scope', { kind: 'project', members: ['project-b'] });
    refused(compareHistoricalReads('Intent', left, right, 'identity', projectB, context), 'authoritative record context');
    const pinned = value(readHistorical('Intent', a, aPin, { ...base, recordSubjects: context.recordSubjects }));
    refused(compareHistoricalReads('Intent', pinned, right, 'identity', projectB, { ...context, recordSubjects: { [digest(a)]: projectB, [digest(b)]: projectB } }), 'original admission context');
    expect(typeof value(compareHistoricalReads('Intent', left, right, 'identity', f.scope, context))).toBe('object');
    // The successful comparison must not have silently installed its bindings on the reads.
    refused(compareHistoricalReads('Intent', left, right, 'identity', f.scope, { ...context, recordSubjects: {} }), 'independent admission context');
  });
  it('NF-67 refuses mixed live/historical, copied wrappers, wrong inventory type and bare views', () => {
    const { f, a, left, right, context } = setup(); const live = value(decode('Intent', a, f.ctx));
    for (const [first, second] of [[live, right], [left, live], [live, live], [{ ...left }, right], [left, clone(right)], [left.view, right], [left, right.view]])
      refused(Reflect.apply(compareHistoricalReads, undefined, ['Intent', first, second, 'identity', f.scope, context]), 'two origin-verified reads');
    refused(Reflect.apply(compareHistoricalReads, undefined, ['StandingGrant', left, right, 'identity', f.scope, context]), 'requested type');
  });
  for (const type of ['VerifiedPrincipal', 'StandingGrant', 'Authorization'] as const) it(`NF-67 refuses live/historical ${type} mixtures in both directions`, () => {
    const { f, base, context } = setup();
    const g = value(readHistorical('StandingGrant', f.g, f.historyPin(f.g), base));
    const live = type === 'VerifiedPrincipal' ? f.alice : type === 'StandingGrant' ? f.g : f.authorization;
    const historical = value(readHistorical(type, live, f.historyPin(live), { ...base, history: [g] }));
    const scope = type === 'VerifiedPrincipal' ? f.org : f.scope;
    expect(value(compareHistoricalReads(type, historical, historical, 'identity', scope, context))).toBe(true);
    for (const pair of [[live, historical], [historical, live]])
      refused(Reflect.apply(compareHistoricalReads, undefined, [type, ...pair, 'identity', scope, context]), 'two origin-verified reads');
  });
  it('refuses unavailable inputs rather than losing dependency taint in equality or Conflict', () => {
    const { f, a, aPin, right, base, context } = setup(); delete f.captures[a.raw];
    const missing = value(readHistorical('Intent', a, aPin, base));
    expect(missing.captureStatus).toBe('missing');
    for (const mode of ['identity', 'version', 'value'] as const)
      refused(compareHistoricalReads('Intent', missing, right, mode, f.scope, context), 'evidence-unavailable');
    refused(compareHistoricalReads('Intent', missing, missing, 'value', f.scope, context), 'evidence-unavailable');
  });
  it('is total on malformed subject/context/mode and does not invent a default comparison', () => {
    const { f, left, right, context } = setup();
    for (const subject of [null, {}, new Proxy({}, { ownKeys() { throw new Error('subject trap'); } })])
      refused(compareHistoricalReads('Intent', left, right, 'identity', subject, context), '');
    refused(Reflect.apply(compareHistoricalReads, undefined, ['Intent', left, right, 'invented', f.scope, context]), 'unknown historical comparison mode');
    refused(Reflect.apply(compareHistoricalReads, undefined, ['Intent', left, right, 'identity', f.scope, null]), '');
    refused(Reflect.apply(compareHistoricalReads, undefined, ['Intent', left, right, 'identity', f.scope, { ...context, recordSubjects: null }]), 'independent record subject context');
  });
});
