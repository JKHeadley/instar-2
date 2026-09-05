import { describe, expect, it } from 'vitest';
import { decodeDeclaration, generateRegister, registeredFactSchemas, decodeRegisteredFact, generationOf } from '../../src/register/index.js';
import { setup, value, detail, json } from './fixtures.js';

describe('nested facts and owned registrations', () => {
  it('P3-NF-02 P3-NF-05 P3-NF-20 R2 machine scope is closed and local scope needs a reason', () => {
    const s = setup(); const d = s.declaration();
    for (const machineScope of [{}, { kind: 'invented' }, { kind: 'machine-local' }, { kind: 'shared', reason: 'ambiguous' }])
      expect(detail(decodeDeclaration({ ...d, requiredFacts: { ...d.requiredFacts, machineScope } }, s.context))).toContain('machineScope');
    for (const machineScope of [{ kind: 'shared' }, { kind: 'machine-local', reason: 'rebuildable host cache' }])
      expect(value(decodeDeclaration({ ...d, requiredFacts: { ...d.requiredFacts, machineScope } }, s.context)).id).toBe('store');
  });
  it('P3-NF-02 P3-NF-05 R2 duty watcher, record proof and store agreement resolve through named providers', () => {
    const s = setup(); const duty = s.declaration('duty', 'duties of observation', { watcher: 'watcher', proof: 'proof', cadence: 10 });
    expect(detail(generateRegister(s.input([duty]), s.context))).toContain('unresolved');
    const watcher = s.declaration('watcher', 'sentinels', { freshnessProbe: 'probe', scope: 'retrospective', authority: 'signal' }, { profile: s.profile });
    expect(detail(generateRegister(s.input([duty, watcher]), s.context))).toContain('proof');
    const context = { ...s.context, references: [...s.context.references!, { provider: 'record', kind: 'observation-proof', id: 'proof' }] };
    expect(value(generateRegister(s.input([duty, watcher]), context)).entries).toHaveLength(2);
    const agreement = { ...s.declaration(), requiredFacts: { ...s.declaration().requiredFacts, agreesWith: [{ store: 'peer', invariant: 'same authoritative answer', check: 'check' }] } };
    expect(detail(generateRegister(s.input([agreement]), context))).toContain('peer');
    expect(value(generateRegister(s.input([agreement, s.declaration('peer')]), context)).entries).toHaveLength(2);
    expect(detail(decodeDeclaration({ ...agreement, requiredFacts: { ...agreement.requiredFacts, agreesWith: [{ store: 'peer', check: 'check' }] } }, context))).toContain('invariant');
  });
  it('P3-NF-05 P3-NF-20 R2 parser authentication/event authority and model subsidy have complete nested contracts', () => {
    const s = setup(); const parserFacts = { fixture: 'bytes', authenticationClass: [{ stimulusType: 'message', class: 'verified' }], ackPolicy: 'bound-only',
      eventIdAuthority: { mintedBy: 'adapter', uniquenessScope: 'adapter + conversation', replayWindow: 300, fallbackFingerprint: { policy: 'canonical-hash', basis: 'captured bytes' } } };
    const parser = s.declaration('parser', 'parsers', parserFacts, { profile: s.profile });
    expect(value(decodeDeclaration(parser, s.context)).id).toBe('parser');
    for (const patch of [{ eventIdAuthority: {} }, { authenticationClass: [{ stimulusType: 'message', class: 'invented' }] },
      { eventIdAuthority: { ...parserFacts.eventIdAuthority, replayWindow: -1 } },
      { eventIdAuthority: { ...parserFacts.eventIdAuthority, fallbackFingerprint: { policy: 'invented', basis: 'bytes' } } }])
      expect(detail(decodeDeclaration({ ...parser, requiredFacts: { ...parserFacts, ...patch } }, s.context))).toBeTruthy();
    const facts = { models: [{ id: 'exact-model', verifiedAt: 1, freshFor: 100 }], billing: 'subscription', subsidy: { ratio: 0.5, basis: 'measured', updatedAt: 1, freshFor: 100 } };
    const door = s.declaration('door', 'model doorways', facts, { profile: s.profile });
    expect(value(decodeDeclaration(door, s.context)).id).toBe('door');
    for (const subsidy of [{}, { ...facts.subsidy, basis: 'guessed' }, { ...facts.subsidy, ratio: -1 }, { ratio: 1, basis: 'estimated' }])
      expect(detail(decodeDeclaration({ ...door, requiredFacts: { ...facts, subsidy } }, s.context))).toBeTruthy();
  });
  it('P3-NF-02 P3-NF-05 R2 remaining compound kinds reject missing or malformed required facts', () => {
    const s = setup();
    const cases: [string, object, object, object][] = [
      ['operator actions', { surface: 'phone', request: { action: 'approve', subject: 'change', parameters: [] } }, { request: {} }, {}],
      ['loops', { cadence: 10, dueBy: 100, owner: 'operator', overdueAction: 'surface' }, { cadence: 0 }, {}],
      ['features', { metrics: ['count'], gate: { test: 'check', deadline: 100 } }, { gate: { deadline: 100 } }, { status: 'dark', profile: s.profile }],
      ['sentinels', { freshnessProbe: 'probe', scope: 'live', authority: 'signal', irreversibleMoment: 'user send' }, { irreversibleMoment: '' }, { profile: s.profile }],
    ];
    for (const [kind, facts, bad, extra] of cases) {
      expect(value(decodeDeclaration(s.declaration('entry', kind, facts, { profile: s.profile, ...extra }), s.context)).id).toBe('entry');
      expect(detail(decodeDeclaration(s.declaration('entry', kind, { ...facts, ...bad }, { profile: s.profile, ...extra }), s.context))).toBeTruthy();
    }
  });
  it('P3-NF-21 P3-NF-28 R7 a P2-style consumer discovers and dispatches both P3 body registrations', () => {
    const s = setup(); const registrations = registeredFactSchemas(s.context);
    expect(registrations.map(r => r.kind)).toEqual(['generation-record', 'check-run-record']);
    const generation = value(generationOf(s.build(), s.context));
    const bodies = [json('GenerationRecord', { generation, at: s.f.now }), json('CheckRunRecord', { id: 'run', commit: 'commit:1', branch: 'main',
      providerRun: 'ci:1', outcome: 'passed', fixtures: [], at: s.f.now })];
    for (let i = 0; i < registrations.length; i++) {
      const registration = registrations[i]!;
      expect(value(decodeRegisteredFact(registration.kind, bodies[i], s.context)).type).toBe(registration.bodyType);
      expect(detail(decodeRegisteredFact(registration.kind, { ...bodies[i], at: {} }, s.context))).toBeTruthy();
    }
    expect(detail(decodeRegisteredFact('unknown', {}, s.context))).toContain('unregistered');
  });
});
