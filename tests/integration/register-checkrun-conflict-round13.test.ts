import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { Json, Result, Validation } from '../../src/index.js';
import { authorAndAppend, registerOwnedBody } from '../../src/facts/index.js';
import type { FactSchema, OwnedBodyRegistration } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeCheckRun,
  decodeRegisteredFact } from '../../src/register/index.js';
import { privateKey } from '../facts/fixtures.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { detail, json, setup, value } from '../register/fixtures.js';
import { ownedPolicy, ownedSchema } from '../register/normal-provider-fixture.js';

const validation = <T,>(result: Result<T>): Validation<T> => consumeResult<T, Validation<T>>(result, {
  Success: decoded => ({ ok: true, value: decoded }),
  Refused: refusal => ({ ok: false, reason: refusal.reason, detail: refusal.detail }),
});

describe('round-thirteen independent CheckRunRecord identity resolution', () => {
  it('P3-NF-28 refuses contradictory owned values before comparing requested bytes', () => {
    const s = setup(), v = verificationRuntimeFixture();
    const raw = JSON.parse(JSON.stringify(json('CheckRunRecord', { id: 'check-run:resolved',
      commit: s.build().commit, branch: 'main', providerRun: 'ci:123', outcome: 'passed',
      fixtures: [{ id: 'check', stage: 'build', outcome: 'passed' }], at: v.clock(100) }))) as Json;
    const passed = value(decodeCheckRun(raw, s.context));
    const body = value(registerOwnedBody({ owner: 'part-three', name: 'CheckRunRecord', currentVersion: 1,
      versions: { 1: { validate: input => ({ ok: true as const, value: input }) } }, migrations: {},
      decodeCurrent: input => validation(decodeRegisteredFact('check-run-record', input, s.context)) },
    ownedPolicy(raw), v.c));
    const mutable = v.context as unknown as { schemas: FactSchema[]; ownedBodies?: OwnedBodyRegistration[] };
    mutable.schemas.push(ownedSchema('check-run-record', 'part-three', 'CheckRunRecord', v.scope));
    mutable.ownedBodies = [...(mutable.ownedBodies ?? []), body];
    const signed = value(authorAndAppend({ kind: 'check-run-record', schemaVersion: 1, machine: 'machine-a',
      principal: JSON.parse(JSON.stringify(v.alice)), provenance: JSON.parse(JSON.stringify(v.alice.provenance)),
      at: JSON.parse(JSON.stringify(v.clock(100))), body: { record: raw }, required: [] },
    v.context, v.store, privateKey)).fact;
    const authority = createPartTwoRegisterAuthority({ facts: v.context, scope: v.scope,
      landing: { owner: 'part-ten', merges: [] }, context: s.context });
    const provider = createPartTwoRegisterProvider({ store: v.store, authority, horizon: { lineages: {
      'machine-a': { head: { epoch: 0, position: 0 }, observedAt: 100, closed: false },
    }, stalenessBound: 100 }, context: s.context });

    expect(signed.id).not.toBe(passed.id);
    expect(value(provider.verifyRecord({ id: signed.id, kind: 'check-run-record' }, passed, v.clock(100)))).toBe(true);
    expect(value(provider.verifyRecord({ id: passed.id, kind: 'check-run-record' }, passed, v.clock(100)))).toBe(true);

    const failedRaw = { ...(raw as Readonly<Record<string, Json>>), outcome: 'failed',
      fixtures: [{ id: 'check', stage: 'build', outcome: 'failed' }] } as Json;
    value(authorAndAppend({ kind: 'check-run-record', schemaVersion: 1, machine: 'machine-a',
      principal: JSON.parse(JSON.stringify(v.alice)), provenance: JSON.parse(JSON.stringify(v.alice.provenance)),
      at: JSON.parse(JSON.stringify(v.clock(100))), body: { record: failedRaw }, required: [] },
    v.context, v.store, privateKey));
    const live = value(v.store.readForProjection());
    expect(live.entries.filter(entry => entry.fact.kind === 'check-run-record')).toHaveLength(2);
    expect(live.entries.every(entry => entry.taint.length === 0 && entry.conflicts.length === 0)).toBe(true);

    for (const expected of [passed, value(decodeCheckRun(failedRaw, s.context))])
      expect(detail(provider.verifyRecord({ id: passed.id, kind: 'check-run-record' }, expected, v.clock(100))))
        .toContain('inconsistent owned values');
  });
});
