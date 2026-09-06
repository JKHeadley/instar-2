import { decode, deriveProfile } from '../index.js';
import type { Json, Profile } from '../index.js';
import type { CanFailEvidence, Declaration, Hold, Reference, RegisterContext, ShapeEntries } from './types.js';
import { checked, exact, list, number, object, requireThat, strings, take, text, validated } from './boundary.js';
import { boundaryRungs, rungFields } from './rungs.js';
import { validateFact } from './fact-schema.js';

const invariants: Readonly<Record<string, (facts: Readonly<Record<string, Json>>, status: string, profile: Profile | undefined, context: RegisterContext) => void>> = {
  'live-sentinel-moment': facts => { if (facts.scope === 'live') text(facts.irreversibleMoment, 'live sentinel irreversible moment'); },
  'memory-not-deleted': facts => requireThat(!(facts.growth === 'deletes' && facts.holdsAgentMemory === 'yes'), 'P3-NF-20: agent memory cannot be deleted'),
  'feature-metrics': facts => requireThat(list(facts.metrics, 'metrics').length > 0, 'P3-NF-20: metrics cannot be empty'),
  'feature-gate': (facts, status) => {
    if (status === 'dark' || status === 'soaking') { const gate = object(facts.gate!); text(gate.test, 'gate.test'); number(gate.deadline, 'gate.deadline'); }
  },
  'feature-live-proof': (facts, status, profile, context) => {
    requireThat(profile, 'feature requires profile');
    const derived = take(deriveProfile(profile, { owner: 'part-three', derivedFrom: context.shape.derivedFrom }, context.preserved));
    // The existing optional field's absence explicitly means unavailable while
    // dark. A real gate/deadline remains mandatory; promotion is not evidence.
    if (derived.userFacing && status !== 'dark') text(facts.liveProof, 'P3-NF-20: user-facing feature liveProof');
  },
  'governed-state-reference': facts => {
    const rungs = boundaryRungs(facts);
    for (const rung of rungs) if (rung.decidesAlone === 'governed-state') {
      const e = object(rung.enforces!); text(e.record, 'P3-NF-26: enforces.record'); text(e.decoder, 'P3-NF-26: enforces.decoder');
    }
  },
  'term-shape': facts => {
    if (facts.kind === 'adjective') object(facts.derivedFrom!);
    if (facts.kind === 'field') requireThat(list(facts.allowedValues, 'allowedValues').length > 0, 'field needs allowedValues');
  },
  'judgment-floor': (facts, _status, _profile, context) => { take(decode('ActionFloor', facts.floor, context.types)); },
};
export function invariantCoverage(shape: ShapeEntries, implemented: readonly string[], context: RegisterContext) {
  return checked('InvariantCoverage', { expected: shape.kinds.flatMap(k => k.invariants), implemented }, context, input => {
    const v = object(input); const actual = strings(v.implemented, 'implemented');
    for (const name of strings(v.expected, 'expected')) requireThat(actual.includes(name), `P3-NF-20: missing invariant implementation ${name}`);
    return true;
  });
}
export const implementedInvariants = Object.freeze(Object.keys(invariants));
function evidence(input: Json): CanFailEvidence {
  const e = object(input); exact(e, ['kind', 'id', 'stage']); const kind = text(e.kind, 'evidence.kind');
  requireThat(['fixture', 'probe', 'sentinel'].includes(kind), 'unknown can-fail evidence kind');
  return { kind: kind as CanFailEvidence['kind'], id: text(e.id, 'evidence.id'), stage: text(e.stage, 'evidence.stage') };
}
function hold(input: Json): Hold {
  const h = object(input); const rule = number(h.rule, 'holds.rule');
  requireThat(Number.isSafeInteger(rule) && rule > 0, 'holds.rule must be positive integer');
  switch (h.class) {
    case 'held': exact(h, ['rule', 'class', 'evidence', 'semanticallyReviewed']);
      return { rule, class: 'held', evidence: evidence(h.evidence!), semanticallyReviewed: text(h.semanticallyReviewed, 'semanticallyReviewed') };
    case 'partial': exact(h, ['rule', 'class', 'evidence', 'portion', 'remainder']);
      return { rule, class: 'partial', evidence: evidence(h.evidence!), portion: text(h.portion, 'portion'), remainder: text(h.remainder, 'remainder') };
    case 'deferred': exact(h, ['rule', 'class', 'part', 'ceiling', 'owner', 'overdueAction']);
      return { rule, class: 'deferred', part: number(h.part, 'part'), ceiling: number(h.ceiling, 'ceiling'),
        owner: text(h.owner, 'owner'), overdueAction: text(h.overdueAction, 'overdueAction') };
    default: throw new Error('gap is generated; unknown declared honesty class');
  }
}
export function decodeDeclaration(input: unknown, context: RegisterContext) {
  return validated<Declaration, RegisterContext>('Declaration', input, context, (v, ctx) => {
    exact(v, ['type', 'schemaVersion', 'id', 'kind', 'status', 'requiredFacts', 'profile', 'standards', 'holds', 'family']);
    // The provenance must be a value made at the existing constitutional boundary.
    requireThat(ctx.provenance.type === 'Provenance', 'build provenance must come from part one');
    requireThat(ctx.source.path.length > 0 && ctx.source.symbol.length > 0, 'declaration site missing');
    const id = text(v.id, 'id'); const kind = text(v.kind, 'kind');
    const shape = ctx.shape.kinds.find(k => k.name === kind);
    requireThat(shape, `P3-NF-03: unknown kind ${kind}`);
    const status = text(v.status, 'status'); requireThat(['live', 'dark', 'soaking', 'retired'].includes(status), 'unknown status');
    const facts = object(v.requiredFacts!);
    for (const field of shape.fields) {
      const value = facts[field.name];
      const inRungs = kind === 'blocking sites' && facts.rungs !== undefined && (rungFields as readonly string[]).includes(field.name);
      requireThat(inRungs || !field.required || value !== undefined, `P3-NF-02: ${kind}.${field.name} is required`);
      if (value === undefined) continue;
      if (field.schema) validateFact(value, field.schema, `${kind}.${field.name}`);
      const matches = field.format === 'text' ? typeof value === 'string' && value.length > 0
        : field.format === 'number' ? typeof value === 'number'
        : field.format === 'boolean' ? typeof value === 'boolean'
        : field.format === 'array' ? Array.isArray(value)
        : field.format === 'scalar' ? typeof value === 'string' || typeof value === 'number'
        : value !== null && typeof value === 'object' && !Array.isArray(value);
      requireThat(matches, `P3-NF-05: ${kind}.${field.name} wrong format`);
      requireThat(field.values.length === 0 || (typeof value === 'string' && field.values.includes(value)),
        `P3-NF-${kind === 'terms' && field.name === 'kind' ? '12' : '05'}: ${kind}.${field.name} outside closed list`);
    }
    exact(facts, shape.fields.map(f => f.name));
    requireThat(!shape.profile || v.profile !== undefined, 'P3-NF-06: five-fact profile required');
    // P1's decoder resolves bound ids in the explicit tree horizon. P3 generation
    // subsequently verifies the target is a live, paired critical-outcome entry.
    const profile = v.profile === undefined ? undefined : take(decode('Profile', v.profile, ctx.types));
    const standards = list(v.standards, 'standards').map(v => number(v, 'standard'));
    requireThat(standards.every(n => Number.isSafeInteger(n) && n > 0), 'invalid standards');
    const holds = list(v.holds, 'holds').map(hold);
    requireThat(shape.holder || holds.length === 0, 'P3-NF-18: non-holder declares holds');
    requireThat(new Set(holds.map(h => h.rule)).size === holds.length, 'duplicate holder/rule edge');
    for (const name of shape.invariants) {
      requireThat(invariants[name], `P3-NF-20: missing invariant implementation ${name}`);
      invariants[name]!(facts, status, profile, ctx);
    }
    let family: Declaration['family'];
    if (v.family !== undefined) { const f = object(v.family); exact(f, ['source', 'mode']);
      requireThat(f.mode === 'commit-extract', 'P3-NF-30: runtime-only family source');
      family = { source: text(f.source, 'family.source'), mode: 'commit-extract' }; }
    return { type: 'Declaration', schemaVersion: 1, id, kind, status, requiredFacts: facts, standards, holds,
      declaredBy: ctx.source, ...(profile ? { profile } : {}), ...(family ? { family } : {}) } as unknown as Declaration;
  });
}
export function decodeReference(input: unknown, context: RegisterContext) {
  return validated<Reference, RegisterContext>('Reference', input, context, v => {
    exact(v, ['type', 'schemaVersion', 'id', 'target']); const id = text(v.id, 'reference.id');
    requireThat(context.register.entries.includes(id), `unresolved reference ${id}`);
    return { type: 'Reference', schemaVersion: 1, id, target: text(v.target, 'reference.target') } as Reference;
  });
}
