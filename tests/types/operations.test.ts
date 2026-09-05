import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canonical, compare, consumeResult, decode, deriveProfile, resolveConflict, schemas } from '../../src/index.js';
import type { Conflict, ProfileExpression, ProfileTermsReadPort, Result } from '../../src/index.js';
import { digest, fixture, inventoryFixtures, raw, value } from '../fixtures.js';
const refused = <T>(result: Result<T>, text: string) => consumeResult(result, {
  Success: () => { throw new Error('expected refusal'); }, Refused: r => expect(r.detail).toContain(text),
});
function conflictFixture(authority = false) {
  const f = fixture();
  const left = value(decode('Intent', f.intentInput(), f.ctx));
  const right = value(decode('Intent', f.intentInput({ raw: f.capture('conflicting input') }), f.ctx));
  const grantRight = authority ? f.grant({ expiresAt: 200 }) : f.g;
  const comparison = authority ? compare('StandingGrant', f.g, grantRight, 'identity', f.scope, f.ctx.preserved)
    : compare('Intent', left, right, 'identity', f.scope, f.ctx.preserved);
  const conflict = value(comparison) as Conflict;
  const decision = (principal = f.alice) => {
    const input = f.decisionInput({ by: principal, conclusion: { subject: digest(conflict), predicate: 'resolve-to-hash', value: digest(authority ? f.g : left), evidence: ['e1'] } });
    const { floor: _f, ...withoutFloor } = input;
    return value(decode('Decision', withoutFloor, f.ctx));
  };
  return { ...f, conflict, decision, left };
}
describe('pure constitutional operations', () => {
  it('NF-75 conflict resolution refuses requester and wrong scope', () => {
    const f = conflictFixture();
    refused(resolveConflict(f.conflict, f.decision(f.bob), f.g, f.now, f.ctx), 'standing');
    const narrow = f.grant({ id: 'wrong-scope', scope: value(decode('Scope', raw('Scope', { kind: 'project', members: ['project-b'] }), f.ctx)) });
    refused(resolveConflict(f.conflict, f.decision(), narrow, f.now, f.ctx), 'scope');
    const delegate = f.grant({ id: 'delegate', standing: 'delegate', actions: ['work'] });
    expect(value(resolveConflict(f.conflict, f.decision(), delegate, f.now, f.ctx))).toEqual(f.left);
  });
  it('NF-76 authority conflicts require operator standing', () => {
    const f = conflictFixture(true); const delegate = f.grant({ id: 'delegate', standing: 'delegate', actions: ['work'] });
    refused(resolveConflict(f.conflict, f.decision(), delegate, f.now, f.ctx), 'operator');
    expect(value(resolveConflict(f.conflict, f.decision(), f.g, f.now, f.ctx))).toEqual(f.g);
  });
  it('NF-50 canonical schema-1 bytes and SHA-256 are pinned', () => {
    const f = fixture();
    const actual = value(canonical(value(decode('Profile', f.profileInput(), f.ctx))));
    expect(actual).toEqual({
      bytes: '{"consequence":"attention","reach":"user","repeats":{"by":"bound","kind":"bounded"},"reversibility":"reversible","schemaVersion":1,"surface":"chat","type":"Profile"}',
      hash: 'sha256:1bdd51c82dd1b6d9cf85d037d0f36f0420f9353f4914245578116f1f18b62dc5',
    });
    expect(value(canonical({ z: 'é', a: 1 }))).toEqual(value(canonical({ a: 1, z: 'é' })));
    expect(value(canonical({ '2': true, '10': false })).bytes).toBe('{"10":false,"2":true}');
    const hashes = JSON.parse(readFileSync('tests/schema1-canonical.json', 'utf8'));
    expect(Object.fromEntries(Object.entries(inventoryFixtures()).map(([name, record]) => [name, digest(record)]))).toEqual(hashes);
  });
  it('the closed inventory is exactly the 18 shared schema names', () => {
    expect(Object.keys(schemas).sort()).toEqual(['VerifiedPrincipal', 'StandingGrant', 'Revocation', 'Intent', 'Directive', 'Result', 'Measurement', 'Profile', 'Evidence', 'Decision', 'Authorization', 'Scope', 'ActionFloor', 'Outcome', 'SecretRef', 'Provenance', 'Conflict', 'UnresolvedInput'].sort());
    for (const schema of Object.values(schemas)) expect(schema).toMatchObject({ schemaVersion: 1, posture: 'shared', hashAlgorithm: 'sha256' });
  });
  it('evaluates the same derivedFrom expressions supplied by the terms owner', () => {
    const f = fixture();
    const critical: ProfileExpression = { any: [{ field: 'consequence', in: ['identity', 'security', 'money', 'control', 'external'] }, { all: [{ field: 'consequence', in: ['data'] }, { field: 'reversibility', in: ['irreversible'] }] }] };
    const userFacing: ProfileExpression = { any: [{ field: 'reach', in: ['user', 'operator'] }, { field: 'surface', in: ['chat', 'dashboard', 'link', 'device'] }] };
    const terms: ProfileTermsReadPort = { owner: 'part-three', derivedFrom: { critical, userFacing, irreversible: { field: 'reversibility', in: ['irreversible'] }, significant: { any: [critical, userFacing, { field: 'reach', in: ['world'] }] } } };
    expect(value(deriveProfile(value(decode('Profile', f.profileInput(), f.ctx)), terms, f.ctx.preserved))).toEqual({ critical: false, significant: true, userFacing: true, irreversible: false });
    expect(value(deriveProfile(value(decode('Profile', f.profileInput({ consequence: 'data', reversibility: 'irreversible', reach: 'internal', surface: 'none' }), f.ctx)), terms, f.ctx.preserved))).toEqual({ critical: true, significant: true, userFacing: false, irreversible: true });
    expect(value(deriveProfile(value(decode('Profile', f.profileInput({ consequence: 'none', reach: 'internal', surface: 'none' }), f.ctx)), terms, f.ctx.preserved))).toEqual({ critical: false, significant: false, userFacing: false, irreversible: false });
  });
});
