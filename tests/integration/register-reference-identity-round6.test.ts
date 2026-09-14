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

const validation = <T>(result: Result<T>): Validation<T> => consumeResult<T, Validation<T>>(result, {
  Success: decoded => ({ ok: true, value: decoded }),
  Refused: refusal => ({ ok: false, reason: refusal.reason, detail: refusal.detail }),
});

describe.skip('round-six workflow record reference identity SKIPPED: GRANT:NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment', () => {
  it('P3-NF-28 accepts the existing body or envelope id and refuses an invented id with matching bytes', () => {
    const s = setup(), v = verificationRuntimeFixture();
    const raw = JSON.parse(JSON.stringify(json('CheckRunRecord', { id: 'check-run:resolved', commit: 'commit:1',
      branch: 'main', providerRun: 'ci:123', outcome: 'passed', fixtures: [], at: v.clock(100) }))) as Json;
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
    const authority = createPartTwoRegisterAuthority({ facts: v.context, scope: v.scope,
      landing: { owner: 'part-ten', merges: [] }, context: s.context });
    const provider = createPartTwoRegisterProvider({ store: v.store, authority, horizon: { lineages: {
      'machine-a': { head: { epoch: 0, position: 0 }, observedAt: 100, closed: false },
    }, stalenessBound: 100 }, context: s.context });
    expect(value(provider.verifyRecord({ id: signed.id, kind: 'check-run-record' }, run, v.clock(100)))).toBe(true);
    expect(value(provider.verifyRecord({ id: run.id, kind: 'check-run-record' }, run, v.clock(100)))).toBe(true);
    expect(detail(provider.verifyRecord({ id: 'invented:absent', kind: 'check-run-record' }, run, v.clock(100))))
      .toContain('Part Two record invented:absent is absent');
  });
});
