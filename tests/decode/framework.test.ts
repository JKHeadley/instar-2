import { describe, expect, it } from 'vitest';
import { compare, consumeResult, decode, defineDecoder, rehydrateConflict, rehydrateOutcome, rehydrateResult, resolveConflict } from '../../src/index.js';
import type { BoundaryContext, Conflict, Json, Result, Validation } from '../../src/index.js';
import { clone, digest, fixture, raw, value } from '../fixtures.js';
const refused = <T>(result: Result<T>, text: string) => consumeResult(result, { Success: () => { throw new Error('expected refusal'); }, Refused: r => expect(r.detail).toContain(text) });
const validator = (version: number) => (input: Json): Validation<Json> => {
  const v = input as Record<string, Json>;
  return typeof v.id === 'string' && typeof v[version === 1 ? 'oldName' : 'name'] === 'string' ? { ok: true, value: input } : { ok: false, detail: 'name/id missing' };
};
function framework() {
  const f = fixture(); const context: BoundaryContext = { preserved: f.ctx.preserved, site: 'types.decode', register: f.ctx.register };
  const definition = {
    name: 'ExampleDeclaration', owner: 'part-three', currentVersion: 2,
    versions: { 1: { validate: validator(1) }, 2: { validate: validator(2) } },
    migrations: { 1: (input: Json): Json => { const v = input as Record<string, Json>; return { type: 'ExampleDeclaration', schemaVersion: 2, id: v.id!, name: v.oldName! }; } },
    decodeCurrent: (input: Json) => ({ ok: true as const, value: input }),
  };
  return { f, context, definition, decoder: value(defineDecoder(definition, f.ctx.preserved)) };
}
describe('downstream decoder extension and historical value reads', () => {
  it('NF-68 migration precedes comparison and alone causes no conflict', () => {
    const { decoder, context } = framework();
    const old = { type: 'ExampleDeclaration', schemaVersion: 1, id: 'd', oldName: 'same content' };
    const current = { type: 'ExampleDeclaration', schemaVersion: 2, id: 'd', name: 'same content' };
    expect(value(decoder.decode(old, context))).toEqual(value(decoder.decode(current, context)));
    expect(old).toEqual({ type: 'ExampleDeclaration', schemaVersion: 1, id: 'd', oldName: 'same content' });
  });
  it('missing migrations, extra versions, and constitutional name capture refuse registration', () => {
    const { definition, f } = framework();
    refused(defineDecoder({ ...definition, migrations: {} }, f.ctx.preserved), 'migration');
    refused(defineDecoder({ ...definition, name: 'VerifiedPrincipal' }, f.ctx.preserved), 'inventory');
    refused(defineDecoder({ ...definition, versions: { ...definition.versions, 3: { validate: validator(2) } } }, f.ctx.preserved), 'extra');
  });
  it('validates old shapes before migration and the migrated shape again', () => {
    const { definition, context, decoder, f } = framework();
    refused(decoder.decode({ type: definition.name, schemaVersion: 1, id: 'x' }, context), 'missing');
    const invalid = value(defineDecoder({ ...definition, migrations: { 1: () => ({ type: definition.name, schemaVersion: 2, id: 'x' }) } }, f.ctx.preserved));
    refused(invalid.decode({ type: definition.name, schemaVersion: 1, id: 'x', oldName: 'valid' }, context), 'missing');
    refused(decoder.decode({ type: definition.name, schemaVersion: 3, id: 'x', name: 'future' }, context), 'unknown');
  });
  it('extension validators that throw remain typed refusals and preserve input', () => {
    const { definition, context, f } = framework();
    const throwing = value(defineDecoder({ ...definition, decodeCurrent: () => { throw new Error('bad data'); } }, f.ctx.preserved));
    refused(throwing.decode({ type: definition.name, schemaVersion: 2, id: 'x', name: 'valid' }, context), 'bad data');
  });
  it('rehydrates recorded Success and Refused without downstream constructors', () => {
    const f = fixture();
    const success = raw('Result', { kind: 'Success', value: f.profileInput(), capacity: { kind: 'applied', bound: 'bound', action: 'coalesced' } });
    const recorded = value(rehydrateResult(success, f.ctx, payload => decode('Profile', payload, f.ctx)));
    consumeResult(recorded, { Success: (v, capacity) => { expect(v.type).toBe('Profile'); expect(capacity.kind).toBe('applied'); }, Refused: () => { throw new Error('unexpected refusal'); } });
    const refusal = value(rehydrateResult(f.refusedInput(), f.ctx, payload => decode('Profile', payload, f.ctx)));
    consumeResult(refusal, { Success: () => { throw new Error('refusal changed to success'); }, Refused: r => expect(r.reason).toBe('policy') });
  });
  it('rehydrates Outcome with evidence validation', () => { const f = fixture(); expect(value(rehydrateOutcome(raw('Outcome', { kind: 'uncertain', evidence: ['e1'] }), f.ctx)).kind).toBe('uncertain'); refused(rehydrateOutcome(raw('Outcome', { kind: 'uncertain', evidence: ['missing'] }), f.ctx), 'unresolved'); });
  it('rehydrates Conflict by deriving it again; altered fields refuse', () => {
    const f = fixture(); const left = value(decode('Intent', f.intentInput(), f.ctx)); const right = value(decode('Intent', f.intentInput({ raw: f.capture('other input') }), f.ctx));
    const conflict = value(compare('Intent', left, right, 'identity', f.scope, f.ctx.preserved)) as Conflict;
    expect(value(rehydrateConflict(clone(conflict), f.ctx))).toEqual(conflict);
    refused(rehydrateConflict({ ...clone(conflict), fields: [] }, f.ctx), 'disagrees');
  });
  it('NF-75 R1 refuses altered Conflict subject and wrong-jurisdiction resolution', () => {
    const f = fixture(); const left = value(decode('Intent', f.intentInput(), f.ctx)); const right = value(decode('Intent', f.intentInput({ raw: f.capture('other') }), f.ctx));
    const conflict = value(compare('Intent', left, right, 'identity', f.scope, f.ctx.preserved)) as Conflict;
    const projectB = value(decode('Scope', raw('Scope', { kind: 'project', members: ['project-b'] }), f.ctx));
    const moved = { ...clone(conflict), subject: projectB };
    expect(value(rehydrateConflict(clone(conflict), f.ctx))).toEqual(conflict);
    refused(rehydrateConflict(moved, f.ctx), 'authoritative record context');
    const wrongGrant = f.grant({ id: 'wrong-jurisdiction', scope: projectB });
    const { floor: _f, ...decisionInput } = f.decisionInput({ by: f.alice, conclusion: { subject: digest(moved), predicate: 'resolve-to-hash', value: digest(left), evidence: ['e1'] } });
    const decision = value(decode('Decision', decisionInput, f.ctx));
    const attempted = consumeResult(rehydrateConflict(moved, f.ctx), {
      Refused: r => r,
      Success: restored => resolveConflict(restored, decision, wrongGrant, f.now, f.ctx),
    });
    refused(attempted, 'authoritative record context');
    refused(resolveConflict(conflict, decision, wrongGrant, f.now, f.ctx), 'scope');
    refused(rehydrateConflict(clone(conflict), { ...f.ctx, recordSubjects: {} }), 'independent admission context');
  });
});
