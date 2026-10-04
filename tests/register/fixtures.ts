import { readFileSync } from 'node:fs';
import { canonical, consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeShape, decodeDeclaration, decodeExtract, generateRegister, generationOf } from '../../src/register/index.js';
import type { GeneratedRegister, RegisterContext } from '../../src/register/index.js';
import { fixture, value, clone } from '../fixtures.js';

export { value, clone };
export const json = <F extends object>(type: string, fields: F) => ({ type, schemaVersion: 1, ...fields });
export const shapeInput = () => JSON.parse(readFileSync('register-source/bootstrap-shape.json', 'utf8')) as Record<string, unknown>;
// Closed-graph scanner tests supply their core dependencies explicitly, just as
// readCommit supplies the full committed src graph in the shipped composition.
export const wiringSources = () => Object.fromEntries(['src/index.ts', 'src/decode/decode.ts',
  'src/register/index.ts', 'src/register/governance.ts'].map(path => [path, readFileSync(path, 'utf8')]));
export function setup() {
  const f = fixture(); const shape = value(decodeShape(shapeInput(), { site: 'types.decode', preserved: f.ctx.preserved, register: f.ctx.register }));
  const proof = f.proof({ commit: 'commit:1' });
  const context: RegisterContext = { site: 'types.decode', preserved: f.ctx.preserved, register: f.ctx.register, types: f.ctx,
    shape, provenance: proof.p, source: { path: 'src/example.ts', symbol: 'example' },
    references: [{ provider: 'probe', id: 'probe' }, { provider: 'fixture', id: 'check' }, { provider: 'decoder', id: 'decode:Profile' }] };
  const declaration = (id = 'store', kind = 'stores', requiredFacts: object = { growth: 'compacts', holdsAgentMemory: 'yes', machineScope: { kind: 'shared' }, agreesWith: [] }, extra: object = {}) =>
    json('Declaration', { id, kind, status: 'live', requiredFacts, standards: [], holds: [], ...extra });
  const extract = json('ChainExtract', { vector: { owner: 'part-two', name: 'FactPositionVector', id: 'vector:genesis' }, rows: [] });
  const source = (d: object, path = 'src/example.ts', symbol = 'example') => ({ declaration: d, path, symbol });
  const input = (declarations: readonly object[] = [declaration()], extra: object = {}) => ({ commit: 'commit:1', complete: true, sources: declarations.map(d => source(d)), extract, instances: {}, ...extra });
  const build = (declarations: readonly object[] = [declaration()], extra: object = {}) => value(generateRegister(input(declarations, extra), context));
  const rule = (n = 7, extra: object = {}) => declaration(`rule:${n}`, 'rules', { number: n, name: `Rule ${n}`, statement: 'Keep the record.',
    held: 'script', parent: 'root', rootReason: 'independent fixture rule', termRefs: [], checkDescription: 'fixture', deadline: 1000, owner: 'operator-route', overdueAction: 'surface overdue', ...extra });
  const holder = (holds: readonly object[], extra: object = {}) => declaration('holder', 'blocking sites', {
    authority: 'block', decidesAlone: 'ruled-three', decidesAloneBasis: 'operator-emergency-stop', criticality: 'exact irreversible match', failDirection: 'closed', preservesInput: 'capture:input', inspectedBy: 'check',
  }, { profile: f.profileInput({ consequence: 'none', reach: 'internal', surface: 'none', repeats: { kind: 'no' } }), holds, ...extra });
  const profile = f.profileInput({ consequence: 'none', reach: 'internal', surface: 'none', repeats: { kind: 'no' } });
  const bound = declaration('bound', 'critical outcomes', { probe: 'probe', cadence: 100 }, { profile });
  return { f, context, declaration, extract, source, input, build, rule, holder, profile, bound };
}
// A ruled-three rung must name its rule 4 admission and no other rung may carry one, so a
// fixture that re-points `holder` at another category drops the basis rather than blanking it:
// a key whose value is undefined is not finite JSON and refuses at the decode boundary.
export function withoutBasis(facts: object): Record<string, unknown> {
  const { decidesAloneBasis: _basis, ...rest } = facts as Record<string, unknown>; return rest;
}
export function detail<T>(r: Result<T>): string { return consumeResult(r, { Success: () => { throw new Error('expected refusal'); }, Refused: r => r.detail }); }
export function hash(v: unknown) { return value(canonical(v)).hash; }
