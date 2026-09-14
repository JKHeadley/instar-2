import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { Json, Result, Validation } from '../../src/index.js';
import { authorAndAppend, createFactStore, registerOwnedBody } from '../../src/facts/index.js';
import type { FactSchema, OwnedBodyRegistration } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeCheckRun,
  decodeRegisteredFact, generationOf, loadRegister, readRegisterEntry } from '../../src/register/index.js';
import { privateKey, factsFixture } from '../facts/fixtures.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { detail, json, setup, value } from '../register/fixtures.js';
import { generationRegistration, ownedPolicy, ownedSchema, vectorAt } from '../register/normal-provider-fixture.js';

function registerFixture() {
  let reads = 0;
  let onRead = (_read: number) => {};
  const f = factsFixture(), s = setup(), root = f.fact();
  const vector = vectorAt(root);
  const register = s.build(undefined, { extract: { ...s.extract, vector } });
  const generation = value(generationOf(register, s.context));
  const record = json('GenerationRecord', { generation, at: f.now });
  const registration = generationRegistration(record, s.context, f);
  const context = { ...f.ctx, facts: [], schemas: [f.schema,
    ownedSchema('generation-record', 'part-three', 'GenerationRecord', f.scope),
    { ...f.schema, kind: 'retraction', fields: { target: { kind: 'reference' as const },
      reason: { kind: 'text' as const, maxLength: 100 } } }], ownedBodies: [registration] };
  const force = f.next(root, { kind: 'generation-record', body: { record } }, context);
  const rows = [root, force];
  const lineages = { 'machine-a': { head: { epoch: 0, position: 1 }, observedAt: 100, closed: false } };
  const store = createFactStore(context, { owner: 'part-ten', read: () => {
    reads++; onRead(reads); return rows;
  }, append: () => { throw new Error('read-only fixture'); } });
  const authority = createPartTwoRegisterAuthority({ facts: context, scope: f.scope,
    landing: { owner: 'part-ten', merges: [] }, context: s.context });
  const provider = createPartTwoRegisterProvider({ store, authority,
    horizon: { lineages, stalenessBound: 100 }, context: s.context });
  return { f, s, context, root, force, rows, lineages, provider, register, generation, vector,
    arm(fn: (read: number) => void) { reads = 0; onRead = fn; } };
}

const validation = <T,>(result: Result<T>): Validation<T> => consumeResult<T, Validation<T>>(result, {
  Success: decoded => ({ ok: true, value: decoded }),
  Refused: refusal => ({ ok: false, reason: refusal.reason, detail: refusal.detail }),
});

describe('round-fourteen independent normal-provider conformance cases', () => {
  it('mixed-snapshot-read P3-NF-21/23 derives entering force and currency from one refreshed snapshot', () => {
    const x = registerFixture();
    const loaded = value(loadRegister(x.register, x.generation, x.s.context, x.provider, x.f.now));
    expect(value(readRegisterEntry('store', loaded, x.s.context)).declaration.id).toBe('store');
    const now = x.f.clock(201);
    (x.s.context.types as unknown as { now: typeof now }).now = now;
    expect(value(x.provider.isCurrent(x.vector, now))).toBe(false);
    const withdrawal = x.f.next(x.force, { kind: 'retraction', at: now,
      body: { target: x.force.id, reason: 'withdrawn on refreshed replica' } }, x.context);
    x.arm(read => {
      if (read === 10) {
        x.rows.push(withdrawal);
        x.lineages['machine-a'].head.position = 2;
        x.lineages['machine-a'].observedAt = 201;
      }
    });
    expect(detail(readRegisterEntry('store', loaded, x.s.context))).toContain('current entering-force');
    x.arm(() => {});
    expect(detail(x.provider.enteringForce(x.generation))).toContain('no unique current entering-force');
  });

  it('withdrawal-all-boundaries refuses every loaded read whose owner snapshot changed during a read', () => {
    const acceptedAfterWithdrawal: number[] = [];
    for (let cut = 1; cut <= 36; cut++) {
      const x = registerFixture();
      const loaded = value(loadRegister(x.register, x.generation, x.s.context, x.provider, x.f.now));
      const withdrawal = x.f.next(x.force, { kind: 'retraction', body: {
        target: x.force.id, reason: 'withdrawn at use',
      } }, x.context);
      let fired = false;
      x.arm(read => {
        if (read === cut) {
          fired = true; x.rows.push(withdrawal); x.lineages['machine-a'].head.position = 2;
        }
      });
      const answer = consumeResult(readRegisterEntry('store', loaded, x.s.context), {
        Success: () => 'accepted', Refused: () => 'refused',
      });
      if (fired && answer === 'accepted') acceptedAfterWithdrawal.push(cut);
    }
    expect(acceptedAfterWithdrawal).toEqual([]);
  });

  it('fact-id-conflict P3-NF-28 gives owned and enclosing CheckRunRecord references one verdict', () => {
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
    expect(value(provider.verifyRecord({ id: signed.id, kind: 'check-run-record' }, passed, v.clock(100)))).toBe(true);
    expect(value(provider.verifyRecord({ id: passed.id, kind: 'check-run-record' }, passed, v.clock(100)))).toBe(true);
    const failedRaw = { ...(raw as Readonly<Record<string, Json>>), outcome: 'failed',
      fixtures: [{ id: 'check', stage: 'build', outcome: 'failed' }] } as Json;
    value(authorAndAppend({ kind: 'check-run-record', schemaVersion: 1, machine: 'machine-a',
      principal: JSON.parse(JSON.stringify(v.alice)), provenance: JSON.parse(JSON.stringify(v.alice.provenance)),
      at: JSON.parse(JSON.stringify(v.clock(100))), body: { record: failedRaw }, required: [] },
    v.context, v.store, privateKey));
    for (const requestedId of [passed.id, signed.id])
      for (const expected of [passed, value(decodeCheckRun(failedRaw, s.context))])
        expect(detail(provider.verifyRecord({ id: requestedId, kind: 'check-run-record' }, expected, v.clock(100))))
          .toContain('inconsistent owned values');
  });

  it('missing-use-clock P3-NF-23 refuses reference currency without a measured use clock', () => {
    const x = registerFixture();
    (x.s.context.types as unknown as { now?: typeof x.f.now }).now = x.f.clock(100);
    expect(value(x.provider.resolveReference({ provider: 'record', id: x.root.id, kind: 'note' }))).toBe(true);
    (x.s.context.types as unknown as { now?: typeof x.f.now }).now = x.f.clock(201);
    expect(detail(x.provider.resolveReference({ provider: 'record', id: x.root.id, kind: 'note' }))).toMatch(/stale|current/);
    delete (x.s.context.types as unknown as { now?: typeof x.f.now }).now;
    expect(detail(x.provider.resolveReference({ provider: 'record', id: x.root.id, kind: 'note' })))
      .toContain('explicit use clock');
  });
});
