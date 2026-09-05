import { describe, expect, it } from 'vitest';
import { compare, consumeResult, decode, decodeMeasurement, defineDecoder, deriveThrough, rehydrateConflict, rehydrateOutcome, rehydrateResult, resolveConflict } from '../../src/index.js';
import type { BoundaryContext, Conflict, DecodeContext, Intent, Json, Result, Validation } from '../../src/index.js';
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
  it('NF-68 migrates versioned inputs then compares actual constitutional values from two machines', () => {
    const f = fixture();
    const context = { ...f.ctx, site: 'types.decode' };
    // A fixture-owned transport schema migrates; no fictitious P1 schema-2 is installed.
    const validator = (key: string) => (input: Json): Validation<Json> => {
      const record = input as Record<string, Json>;
      return record[key] && typeof record[key] === 'object' ? { ok: true, value: input } : { ok: false, detail: 'record missing' };
    };
    const decoder = value(defineDecoder<Intent, DecodeContext & BoundaryContext>({
      name: 'IntentTransportFixture', owner: 'test', currentVersion: 2,
      versions: { 1: { validate: validator('oldRecord') }, 2: { validate: validator('record') } },
      migrations: { 1: input => ({ type: 'IntentTransportFixture', schemaVersion: 2, record: (input as Record<string, Json>).oldRecord! }) },
      decodeCurrent: (input, c) => consumeResult<Intent, Validation<Intent>>(decode('Intent', (input as Record<string, Json>).record, c), {
        Success: v => ({ ok: true as const, value: v }), Refused: r => ({ ok: false as const, detail: r.detail }),
      }),
    }, context.preserved));
    const left = f.intentInput();
    const machineB = value(decodeMeasurement('clock', f.clockRaw(101, 'machine-b'), f.ctx));
    const right = f.intentInput({ raw: f.capture('incompatible input from machine B'), receivedAt: machineB });
    const old = { type: decoder.name, schemaVersion: 1, oldRecord: clone(left) };
    const current = (record: unknown) => ({ type: decoder.name, schemaVersion: 2, record });
    const migrated = value(decoder.decode(old, context));
    const same = value(decoder.decode(current(left), context));
    expect(value(compare('Intent', migrated, same, 'version', f.scope, context.preserved))).toBe(true);
    const other = value(decoder.decode(current(right), context));
    const conflict = value(compare('Intent', migrated, other, 'identity', f.scope, context.preserved));
    expect(conflict).toMatchObject({ type: 'Conflict', fields: ['raw', 'receivedAt'], origins: ['machine-a', 'machine-b'] });
    expect(conflict).toEqual(value(compare('Intent', same, other, 'identity', f.scope, context.preserved)));
    expect(old.oldRecord).toEqual(left);
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
  for (const [site, direction] of [['delivery', 'open'], ['types.decode', 'closed']] as const) {
    for (const failure of ['unknown-version', 'null', 'accessor', 'bad-migration', 'thrown-migration', 'thrown-validator', 'thrown-current', 'explicit-validator', 'explicit-current', 'mutated-context', 'thrown-derivation'] as const) {
      it(`NF-17 R6 preserves ${site}/${direction} on ${failure}`, () => {
        const { definition, context: base, f } = framework();
        const context = { ...base, site: site as string, preserved: 'capture:extension-attempt' };
        const input = { type: definition.name, schemaVersion: 1, id: 'x', oldName: 'valid' };
        const throws = (): never => { throw new Error('callback failed'); };
        const rejects = (): Validation<Json> => ({ ok: false, detail: 'policy rejection', reason: 'policy' });
        const changes = failure === 'bad-migration' ? { migrations: { 1: () => null } }
          : failure === 'thrown-migration' ? { migrations: { 1: throws } }
          : failure === 'thrown-validator' ? { versions: { ...definition.versions, 1: { validate: throws } } }
          : failure === 'explicit-validator' ? { versions: { ...definition.versions, 1: { validate: rejects } } }
          : failure === 'thrown-current' ? { decodeCurrent: throws }
          : failure === 'explicit-current' ? { decodeCurrent: rejects }
          : failure === 'mutated-context' ? { decodeCurrent: () => { context.site = 'invented'; context.preserved = 'wrong'; return rejects(); } }
          : {};
        const decoder = value(defineDecoder<Json, BoundaryContext>({ ...definition, ...changes }, f.ctx.preserved));
        const data = failure === 'unknown-version' ? { ...input, schemaVersion: 99 }
          : failure === 'null' ? null
          : failure === 'accessor' ? { get type() { throw new Error('accessor'); } } : input;
        const result = failure === 'thrown-derivation' ? deriveThrough({ ...decoder, decode: throws }, data, context) : decoder.decode(data, context);
        consumeResult(result, { Success: () => { throw new Error('failure accepted'); }, Refused: r => {
          expect(r).toMatchObject({ site, failDirection: direction, preserved: 'capture:extension-attempt',
            reason: ['explicit-validator', 'explicit-current', 'mutated-context'].includes(failure) ? 'policy' : 'decode' });
          expect(r.detail.length).toBeGreaterThan(0);
        } });
      });
    }
  }
  it('NF-17 R6 uses a conservative fallback only for untrusted boundary metadata', () => {
    const { decoder, context } = framework();
    for (const bad of [{ ...context, site: 'invented' }, { ...context, register: { ...context.register, generation: { ...context.register.generation, id: '' } } }]) {
      consumeResult(decoder.decode(null, bad), { Success: () => { throw new Error('invalid metadata accepted'); }, Refused: r => {
        expect(r).toMatchObject({ site: 'types.decode', failDirection: 'closed', preserved: context.preserved });
        expect(r.detail).toContain('registered site and generation');
      } });
    }
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
