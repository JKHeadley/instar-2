import { decode, grantLiveness, scopeIncludes } from '../index.js';
import type { Json, Scope, VerifiedPrincipal } from '../index.js';
import type { Declaration, EnforcementBoundary, GeneratedRegister, Reference, RegisterContext, RegisterValue, StandingContext } from './types.js';
import { checked, encoding, list, object, requireThat, strings, take, text } from './boundary.js';
import { decodeReference } from './declarations.js';

export type GovernedConstruct = RegisterValue<'GovernedConstruct'> & Readonly<{ kind: string; declaration: Reference }>;
export function readRegisterEntry(id: string, register: GeneratedRegister, context: RegisterContext) {
  return checked('RegisterEntryRead', { id }, context, () => {
    const entry = register.entries.find(e => e.declaration.id === id);
    requireThat(entry, `unresolved register entry ${id}`); return entry;
  });
}
export function constructGoverned(kind: string, id: string, register: GeneratedRegister, context: RegisterContext) {
  return checked<GovernedConstruct, RegisterContext>('GovernedConstruct', { kind, id }, context, () => {
    const entry = register.entries.find(e => e.declaration.id === id && e.declaration.kind === kind && e.declaration.status !== 'retired');
    requireThat(entry, `P3-NF-04: missing live ${kind} declaration ${id}`);
    const reference = take(decodeReference({ type: 'Reference', schemaVersion: 1, id, target: kind }, { ...context,
      register: { ...context.register, entries: register.entries.map(e => e.declaration.id) } }));
    return { type: 'GovernedConstruct', schemaVersion: 1, kind, declaration: reference } as GovernedConstruct;
  });
}
export interface ConstructObservation { readonly id: string; readonly path: string; readonly symbol: string }
export function checkPairing(register: GeneratedRegister, constructs: readonly ConstructObservation[], context: RegisterContext) {
  return checked('DeclarationPairing', { register, constructs }, context, () => {
    const warnings: string[] = [];
    for (const construct of constructs) requireThat(register.entries.some(e => e.declaration.id === construct.id), `P3-NF-04: construct ${construct.id} has no declaration`);
    for (const { declaration: d } of register.entries) {
      const paired = constructs.some(c => c.id === d.id && c.path === d.declaredBy.path && c.symbol === d.declaredBy.symbol);
      if (!paired) warnings.push(`phantom declaration: ${d.id}`);
      for (const e of register.entries) if (e.declaration.profile?.repeats.kind === 'bounded' && e.declaration.profile.repeats.by === d.id)
        requireThat(paired, `P3-NF-19: load-bearing bound ${d.id} has no paired construct`);
    }
    return { warnings };
  });
}
export function checkBoundaryCoverage(boundaries: readonly EnforcementBoundary[], claims: readonly { kind: string; complete: boolean }[], context: RegisterContext) {
  return checked('BoundaryCoverage', { boundaries, claims }, context, () => {
    for (const claim of claims) {
      const matches = boundaries.filter(b => b.kind === claim.kind);
      requireThat(matches.length > 0 && matches.every(b => b.language.length > 0), `P3-NF-29: missing boundary for ${claim.kind}`);
      requireThat(!claim.complete || matches.every(b => b.residual.length === 0), `P3-NF-29: ${claim.kind} has residual forms and cannot claim complete enumeration`);
    }
    return boundaries;
  });
}
export interface GovernedStateObservation {
  readonly site: string; readonly record: string; readonly decoder: string;
  readonly reads: readonly string[]; readonly invokes: readonly string[];
}
export function checkGovernedState(observations: readonly GovernedStateObservation[], register: GeneratedRegister, context: RegisterContext) {
  return checked('GovernedStateWiring', observations, context, () => {
    for (const { declaration: d } of register.entries.filter(e => e.declaration.kind === 'blocking sites')) {
      const rungs = d.requiredFacts.rungs ? list(d.requiredFacts.rungs, 'rungs').map(object) : [d.requiredFacts];
      for (const rung of rungs) if (rung.decidesAlone === 'governed-state') {
        const enforced = object(rung.enforces!); const record = text(enforced.record, 'enforced record'); const decoder = text(enforced.decoder, 'decoder');
        requireThat(register.entries.some(e => e.declaration.id === record && !('state' in e.approvedIn)), `P3-NF-26: enforced record ${record} lacks approved history`);
        const observed = observations.find(o => o.site === d.id && o.record === record && o.decoder === decoder);
        requireThat(observed?.reads.includes(record) && observed.invokes.includes(decoder), `P3-NF-26: ${d.id} does not read record and invoke named decoder`);
      }
    }
    return true;
  });
}
export function checkSeparation(execution: StandingContext, writer: VerifiedPrincipal, scope: Scope, action: string, context: RegisterContext) {
  return checked('GovernedStateStanding', { execution, writer, scope, action }, context, () => {
    // Both actors must actually pass P1's provenance-bound principal decoder.
    for (const principal of [execution.principal, writer]) take(decode('VerifiedPrincipal', {
      type: 'VerifiedPrincipal', schemaVersion: 1, id: principal.id, kind: principal.kind,
    }, { ...context.types, provenance: principal.provenance }));
    const live = execution.grants.filter(g => grantLiveness(g, execution.revocations, execution.now) === 'live' && scopeIncludes(g.scope, scope));
    const canWrite = (principal: string) => live.some(g => g.grantee.id === principal && (g.standing === 'operator' || g.actions.includes(action)));
    requireThat(canWrite(writer.id), 'P3-NF-27: named writer lacks standing');
    requireThat(!canWrite(execution.principal.id), 'P3-NF-27: executing principal can author enforced record');
    // A delegate with a delegation action could grant a bypass without the operator.
    requireThat(!live.some(g => g.standing === 'delegate' && g.actions.includes('delegate')), 'P3-NF-27: record authority grantable below operator');
    return true;
  });
}
export function verifyGenerated(actual: unknown, expected: unknown, context: RegisterContext) {
  return checked('GeneratedOutputCheck', { actual, expected }, context, raw => {
    const v = object(raw); requireThat(encoding(v.actual).bytes === encoding(v.expected).bytes, 'P3-NF-01: committed output differs from fresh generation'); return true;
  });
}
export function verifyLandingCompletion(before: GeneratedRegister, after: GeneratedRegister, context: RegisterContext) {
  return checked('LandingCompletionCheck', { before, after }, context, () => {
    requireThat(before.commit === after.commit && encoding(before.shape).bytes === encoding(after.shape).bytes && before.entries.length === after.entries.length,
      'P3-NF-22: completion changed source commit, shape or entry roster');
    for (let i = 0; i < before.entries.length; i++) {
      const a = before.entries[i]!; const b = after.entries[i]!;
      requireThat(encoding(a.declaration).bytes === encoding(b.declaration).bytes && a.owner === b.owner && a.base === b.base
        && encoding(a.supersedes).bytes === encoding(b.supersedes).bytes, 'P3-NF-22: completion changed reviewed declaration or lineage');
      for (const field of ['since', 'approvedIn', 'landedIn'] as const) {
        const old = a[field]; const next = b[field];
        if (old && typeof old === 'object' && 'state' in old) requireThat(!(next && typeof next === 'object' && 'state' in next), 'completion left pending field');
        else requireThat(encoding(old).bytes === encoding(next).bytes, 'P3-NF-22: completion changed settled field');
      }
      for (const row of a.history) requireThat(b.history.some(r => encoding(r).bytes === encoding(row).bytes), 'P3-NF-22: history erased');
      const additions = b.history.filter(r => !a.history.some(old => old.version === r.version));
      for (const row of additions) requireThat('state' in a.approvedIn && row.id === a.declaration.id
        && encoding(row.approvedIn).bytes === encoding(b.approvedIn).bytes && row.landedIn === b.landedIn && row.since === b.since,
      'P3-NF-22: unrelated extract completion');
    }
    const allowedRows = after.entries.flatMap(e => e.history);
    requireThat(after.extract.rows.every(r => allowedRows.some(a => encoding(a).bytes === encoding(r).bytes)), 'P3-NF-22: extract contains unrelated row');
    return true;
  });
}
