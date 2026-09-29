// Rules 7/82/90, P2-NF-38..45/71. Approval is authority; landing is a checked locator.
import { isValid, scopeIncludes } from '../index.js';
import type { Authorization, Json, Result, Scope } from '../index.js';
import { boundary, encoding, fields, object, requireFact, string, strings } from './boundary.js';
import type { FactContext, ConflictClass } from './contracts.js';
import { contextBoundary } from './contracts.js';
import { causalStanding } from './admission.js';

export interface GovernedVersion {
  readonly id: string; readonly subject: string; readonly content: Json; readonly contentHash: string;
  readonly since: string; readonly supersedes: readonly string[];
  readonly approvedIn: Authorization; readonly base: string;
  readonly landedIn: string | null;
}
export interface LandingReadPort {
  // Part ten owns host/git I/O. This port supplies recorded resolutions at append.
  readonly owner: 'part-ten';
  readonly merges: readonly { readonly commit: string; readonly onMain: boolean; readonly parentCount: number; readonly reviewedBase: string }[];
}
export function decodeVersion(input: unknown, context: FactContext, scope: Scope,
  versions: readonly GovernedVersion[], landing: LandingReadPort): Result<GovernedVersion> {
  return boundary('GovernedVersion', input, contextBoundary(context), raw => {
    const v = object(raw); fields(v, ['id', 'subject', 'content', 'contentHash', 'since', 'supersedes', 'approvedIn', 'base', 'landedIn']);
    const id = string(v.id, 'id'), subject = string(v.subject, 'subject');
    requireFact(!versions.some(x => x.id === id), 'in-place version edit forbidden');
    const since = string(v.since, 'since'); const sinceFact = context.facts.find(f => f.id === since); requireFact(sinceFact, 'since fact missing');
    const atApproval = causalStanding(sinceFact, context, false);
    const supersedes = strings(v.supersedes, 'supersedes'); requireFact(supersedes.length <= 2 && !supersedes.includes(id), 'supersession cycle or invalid arity');
    for (const parent of supersedes) requireFact(versions.some(x => x.id === parent && x.subject === subject), 'supersedes missing or wrong subject');
    const base = string(v.base, 'base'), contentHash = encoding(v.content).hash;
    requireFact(contentHash === v.contentHash, 'version content hash differs', 'integrity');
    const authorization = context.decode.authorizations?.find(a => a.id === v.approvedIn);
    requireFact(authorization && authorization.explicitYes.class === 'verified' && ['approval', 'review-approval', 'signed-yes', 'dashboard-yes'].includes(authorization.explicitYes.authenticated.recordType), 'approvedIn must name verified explicit yes, never merge', 'standing');
    requireFact(base === authorization.base, 'version base differs from approved base', 'stale-base');
    requireFact(isValid(authorization, context.decode.currentBase ?? base, contentHash, atApproval.now, atApproval.decode) === 'valid', 'approval content/base/standing invalid', 'stale-base');
    requireFact(scopeIncludes(authorization.action.scope, scope), 'approval scope does not cover version', 'standing');
    if (supersedes.length === 2) requireFact(atApproval.decode.grants?.some(g => g.id === authorization.under && g.standing === 'operator' && scopeIncludes(g.scope, scope)), 'fork merge requires operator standing', 'standing');
    const repository = context.decode.register.actions[authorization.action.kind]?.repository;
    let landedIn: string | null = null;
    if (repository) {
      landedIn = string(v.landedIn, 'landedIn');
      requireFact(landing.owner === 'part-ten' && landing.merges.some(m => m.commit === landedIn && m.onMain && m.parentCount >= 2 && m.reviewedBase === base), 'landing must be a real merge on main at approved base');
    } else requireFact(v.landedIn === null, 'runtime version has no repository landing');
    return { id, subject, content: v.content!, contentHash, since, supersedes, approvedIn: authorization, base, landedIn };
  });
}
export function walkVersions(versions: readonly GovernedVersion[]): { current: readonly GovernedVersion[]; conflicts: readonly ConflictClass[];
  duplicates: readonly string[]; collapsed: Readonly<Record<string, string>> } {
  // `seen` keeps the first payload of EVERY input id, collapsed aliases included, so a
  // changed version reusing an alias id is refused as a mutation rather than dropped.
  const unique = new Map<string, GovernedVersion>(), seen = new Map<string, GovernedVersion>(), duplicateIds = new Map<string, string>();
  for (const version of [...versions].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
    requireFact(encoding(version.content).hash === version.contentHash && version.approvedIn.artifact === version.contentHash, 'governing version content/approval mismatch');
    const existingId = seen.get(version.id); requireFact(!existingId || encoding(existingId).bytes === encoding(version).bytes, 'in-place version mutation');
    // An identical same-id replay is the version itself, not an alias: nothing to collapse.
    if (existingId) continue;
    seen.set(version.id, version);
    const duplicate = [...unique.values()].find(v => v.subject === version.subject && v.contentHash === version.contentHash && v.approvedIn.id === version.approvedIn.id && encoding(v.supersedes).bytes === encoding(version.supersedes).bytes);
    if (duplicate) { duplicateIds.set(version.id, duplicate.id); continue; }
    unique.set(version.id, version);
  }
  const done = new Set<string>(), active = new Set<string>();
  const resolve = (id: string): GovernedVersion | undefined => unique.get(duplicateIds.get(id) ?? id);
  const visit = (v: GovernedVersion) => {
    requireFact(!active.has(v.id), 'version chain cycle'); if (done.has(v.id)) return;
    active.add(v.id);
    for (const p of v.supersedes) { const parent = resolve(p); requireFact(parent && parent.subject === v.subject, 'version chain gap'); visit(parent); }
    active.delete(v.id); done.add(v.id);
  };
  unique.forEach(visit);
  const conflicts: ConflictClass[] = [], current: GovernedVersion[] = [];
  for (const subject of new Set([...unique.values()].map(v => v.subject))) {
    const members = [...unique.values()].filter(v => v.subject === subject);
    const parents = new Set(members.flatMap(v => v.supersedes.map(p => duplicateIds.get(p) ?? p)));
    const heads = members.filter(v => !parents.has(v.id));
    if (heads.length === 1) { current.push(heads[0]!); continue; }
    const ancestorIds = (v: GovernedVersion): Set<string> => { const set = new Set<string>(); const scan = (x: GovernedVersion) => { for (const p of x.supersedes) { const parent = resolve(p)!; if (!set.has(parent.id)) { set.add(parent.id); scan(parent); } } }; scan(v); return set; };
    const common = members.filter(v => heads.every(h => ancestorIds(h).has(v.id)));
    const incumbent = common.filter(v => !common.some(other => other.id !== v.id && ancestorIds(other).has(v.id)));
    requireFact(incumbent.length === 1, 'fork has no unique reviewed incumbent'); current.push(incumbent[0]!);
    const ids = heads.map(v => v.id).sort(); conflicts.push({ key: `version:${subject}:${ids.join(':')}`, kind: 'version-fork', facts: heads.map(v => v.since).sort(), detail: 'concurrent governing versions; incumbent remains in force' });
  }
  // `collapsed` publishes the replay collapse (P2-NF-71) so a reader can resolve a
  // superseded reference to the retained version instead of re-deriving the rule.
  return { current: current.sort((a, b) => a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0), conflicts,
    duplicates: [...duplicateIds.keys()].sort(),
    collapsed: Object.fromEntries([...duplicateIds.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)) };
}
