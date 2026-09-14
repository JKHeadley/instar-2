import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { Json, Result, Validation } from '../../src/index.js';
import { authorAndAppend, registerOwnedBody } from '../../src/facts/index.js';
import type { FactSchema, OwnedBodyRegistration } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeCheckRun,
  decodeRegisteredFact, runRegisterChecks } from '../../src/register/index.js';
import { privateKey } from '../facts/fixtures.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { json, setup, value } from '../register/fixtures.js';
import { ownedPolicy, ownedSchema } from '../register/normal-provider-fixture.js';

const validation = <T>(result: Result<T>): Validation<T> => consumeResult<T, Validation<T>>(result, {
  Success: decoded => ({ ok: true, value: decoded }),
  Refused: refusal => ({ ok: false, reason: refusal.reason, detail: refusal.detail }),
});

describe.skip('round-five normal workflow record identity SKIPPED: HELD-BY-SCOPE:SEAM-LEDGER-row-124', () => {
  it('P3-NF-28 resolves a CheckRunRecord id independently of its enclosing FactEnvelope id', () => {
    const s = setup();
    const register = s.build([s.rule(26), s.holder([{ rule: 26, class: 'held',
      evidence: { kind: 'fixture', id: 'check', stage: 'build' }, semanticallyReviewed: 'never' }])]);
    const v = verificationRuntimeFixture();
    const raw = JSON.parse(JSON.stringify(json('CheckRunRecord', { id: 'check-run:resolved', commit: register.commit, branch: 'main',
      providerRun: 'ci:123', outcome: 'passed', fixtures: [{ id: 'check', stage: 'build', outcome: 'passed' }],
      at: v.clock(100) }))) as Json;
    const run = value(decodeCheckRun(raw, s.context));
    const body = value(registerOwnedBody({ owner: 'part-three', name: 'CheckRunRecord', currentVersion: 1,
      versions: { 1: { validate: input => ({ ok: true as const, value: input }) } }, migrations: {},
      decodeCurrent: input => validation(decodeRegisteredFact('check-run-record', input, s.context)) }, ownedPolicy(raw), v.c));
    const mutable = v.context as unknown as { schemas: FactSchema[]; ownedBodies?: OwnedBodyRegistration[] };
    mutable.schemas.push(ownedSchema('check-run-record', 'part-three', 'CheckRunRecord', v.scope));
    mutable.ownedBodies = [...(mutable.ownedBodies ?? []), body];
    const signed = value(authorAndAppend({ kind: 'check-run-record', schemaVersion: 1, machine: 'machine-a',
      principal: JSON.parse(JSON.stringify(v.alice)), provenance: JSON.parse(JSON.stringify(v.alice.provenance)),
      at: JSON.parse(JSON.stringify(v.clock(100))), body: { record: raw }, required: [] },
    v.context, v.store, privateKey)).fact;
    expect(signed.id).not.toBe(run.id);
    const authority = createPartTwoRegisterAuthority({ facts: v.context, scope: v.scope,
      landing: { owner: 'part-ten', merges: [] }, context: s.context });
    const provider = createPartTwoRegisterProvider({ store: v.store, authority, horizon: { lineages: {
      'machine-a': { head: { epoch: 0, position: 0 }, observedAt: 100, closed: false },
    }, stalenessBound: 100 }, context: s.context });
    expect(value(provider.verifyRecord({ id: signed.id, kind: 'check-run-record' }, run, v.clock(100)))).toBe(true);
    expect(value(provider.verifyRecord({ id: run.id, kind: 'check-run-record' }, run, v.clock(100)))).toBe(true);

    const checks = { mode: 'normal' as const, branch: 'main', runs: [run],
      catalog: { fixtures: [{ id: 'check', stage: 'build' }], probes: [], sentinels: [], semanticReviews: [] },
      landedParts: [], now: s.f.now, constructs: [], observations: [], separations: [], bootstrapRules: [],
      boundaries: register.shape.kinds.map(kind => ({ kind: kind.name, language: 'TypeScript',
        impossible: [], swept: [], residual: [] })),
      claims: register.shape.kinds.map(kind => ({ kind: kind.name, complete: false })) };
    expect(value(runRegisterChecks(register, checks, s.context, provider)).graph.totals['held-unreviewed']).toBe(1);
  });
});
