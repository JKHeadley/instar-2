// The effect doorway's admission on the live answer and work path (Part Twelve §§2–3, docs/12-the-effect-doorway.md;
// the purpose's four consequential-effect tests, docs/00-the-purpose.md). Pure: every input is passed in, so the
// executable tool hook, the runner and the tests run the same functions, and the hook needs no loader.
//
// Only a proposed effect that could be consequential reaches it. Ordinary work in the agent's own workspace (file
// tools, searches, the sandboxed shell) is admitted by the tool hook without a doorway call: the sandbox, not a
// classification, bounds what it can reach. A proposal is classified against the four tests, once, from its
// registered classification (or the worst reachable one when nothing is registered):
//   irreversible    — it cannot be undone by the agent alone (the register's `irreversible` term over its profile);
//   resources       — it commits money or a resource above the level the operator names (an unknown cost is above it);
//   scope           — it reaches outside the scope the operator granted for the work (nothing outward by default);
//   policySensitive — it touches a matter the operator marked policy-sensitive.
// All four false: ordinary, admitted. Any true: consequential, admitted only when every held test is answered —
// an irreversible effect only as an operation of the installation's accepted closed set (on one machine that set is
// fixed by the purpose's single-machine Rule, so no tool effect joins it),
// a resource or policy-sensitive effect only under a recorded operator grant that names it. A refusal names the
// tests that held and what would admit the effect.

export const CONSEQUENTIAL_TESTS = Object.freeze(['irreversible', 'resources', 'scope', 'policySensitive']);
const TEST_WORDS = Object.freeze({
  irreversible: 'it cannot be undone by the agent alone',
  resources: 'it may commit money or a resource above the level the operator named',
  scope: 'it reaches outside the scope the operator granted for this work',
  policySensitive: 'it touches a matter the operator marked policy-sensitive' });
/** The register's own `irreversible` term (register-source/bootstrap-shape.json derivedFrom.irreversible); the runner
 * passes the committed term, and a test holds this copy equal to it. */
export const IRREVERSIBLE_TERM = Object.freeze({ field: 'reversibility', in: Object.freeze(['irreversible']) });
/** Reach that stays inside the agent's own processes: the scope every piece of work is granted. */
const INTERNAL_REACH = Object.freeze(['internal', 'agent']);
const REVERSIBILITY = Object.freeze(['reversible', 'costly', 'irreversible']);
const REACH = Object.freeze(['internal', 'agent', 'user', 'operator', 'world']);
const CONSEQUENCE = Object.freeze(['none', 'attention', 'data', 'money', 'identity', 'control', 'security', 'external']);

/** The worst reachable classification of each tool effect when the operator has registered none: an MCP tool or an
 * unsandboxed shell can send, publish or delete outside the agent's custody and may spend; a web read reaches the world
 * (its spend stays inside the turn's own bounded model budget). */
export const TOOL_EFFECT_DEFAULTS = Object.freeze({
  'tool:mcp': Object.freeze({ consequence: 'external', reversibility: 'irreversible', reach: 'world', costUsd: null }),
  'tool:unsandboxed': Object.freeze({ consequence: 'control', reversibility: 'irreversible', reach: 'world', costUsd: null }),
  'tool:network': Object.freeze({ consequence: 'external', reversibility: 'reversible', reach: 'world', costUsd: 0 }) });

/** Nothing outward by default: no grant, no registration, a zero resource level and nothing marked sensitive. */
export const DEFAULT_EFFECT_POLICY = Object.freeze({ type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: Object.freeze([]),
  registered: Object.freeze([]), grants: Object.freeze([]) });

/** The marker the runner hands the hook when its configured effect policy could not be read at a turn: distinct from
 * "no policy configured", so the operator's restrictions are never silently replaced by the empty default. */
export const UNAVAILABLE_EFFECT_POLICY = 'PreviewEffectPolicyUnavailable';

const text = (value, max = 256) => typeof value === 'string' && value.length > 0 && value.length <= max;
const strings = (value, max = 64) => Array.isArray(value) && value.length <= max && value.every(item => text(item));
const level = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const effectId = value => text(value, 64) && /^[a-z]+:[a-z0-9:-]+$/u.test(value);

/** Decodes an operator effect policy (the file `--effect-policy` names). Closed: an unknown field, a grant without its
 * recorded operator source, custodian and recovery obligation (nothing outward by default: a grant names its surface,
 * custodian and recovery), or a registration outside the profile vocabulary refuses the whole policy. */
export function decodeEffectPolicy(value) {
  const fail = why => { throw Error(`effect policy: ${why}`); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('not an object');
  const known = ['type', 'resourceLevelUsd', 'policySensitive', 'registered', 'grants'];
  for (const key of Object.keys(value)) if (!known.includes(key)) fail(`unknown field ${key}`);
  if (value.type !== 'PreviewEffectPolicy') fail('type');
  if (!level(value.resourceLevelUsd)) fail('resourceLevelUsd');
  if (!strings(value.policySensitive)) fail('policySensitive');
  if (!Array.isArray(value.registered) || value.registered.length > 64) fail('registered');
  const registered = value.registered.map(entry => {
    if (!entry || typeof entry !== 'object' || !effectId(entry.effect) || (entry.target !== undefined && !text(entry.target))
      || !CONSEQUENCE.includes(entry.consequence) || !REVERSIBILITY.includes(entry.reversibility) || !REACH.includes(entry.reach)
      || !(entry.costUsd === null || level(entry.costUsd)) || (entry.matters !== undefined && !strings(entry.matters)) || !text(entry.source))
      fail('registration');
    return Object.freeze({ ...entry, ...(entry.matters ? { matters: Object.freeze([...entry.matters]) } : {}) });
  });
  if (!Array.isArray(value.grants) || value.grants.length > 64) fail('grants');
  const grants = value.grants.map(grant => {
    if (!grant || typeof grant !== 'object' || !text(grant.id, 128) || !effectId(grant.effect) || (grant.target !== undefined && !text(grant.target))
      || !Array.isArray(grant.approves) || grant.approves.length === 0
      || !grant.approves.every(test => ['scope', 'resources', 'policySensitive'].includes(test))
      || (grant.approves.includes('resources') ? !level(grant.resourceLevelUsd) : grant.resourceLevelUsd !== undefined) || !text(grant.source)
      || !text(grant.custodian) || !text(grant.recovery, 1024)
      || (grant.expiresAt !== undefined && !Number.isSafeInteger(grant.expiresAt))) fail(`grant ${String(grant?.id)}`);
    return Object.freeze({ ...grant, approves: Object.freeze([...grant.approves]) });
  });
  // The decoded policy keeps its type, so the runner can hand it on to the hook's config and the hook decodes it again.
  return Object.freeze({ type: 'PreviewEffectPolicy', resourceLevelUsd: value.resourceLevelUsd, policySensitive: Object.freeze([...value.policySensitive]),
    registered: Object.freeze(registered), grants: Object.freeze(grants) });
}

/** Evaluates one register term expression over a profile (part one's `deriveProfile`, the same three forms). */
export function termHolds(term, profile, depth = 0) {
  if (depth > 32 || !term || typeof term !== 'object') throw Error('effect doorway: malformed term');
  if ('field' in term) return term.in.includes(profile[term.field]);
  if ('any' in term) return term.any.some(child => termHolds(child, profile, depth + 1));
  if ('all' in term) return term.all.every(child => termHolds(child, profile, depth + 1));
  throw Error('effect doorway: malformed term');
}

const covers = (entry, proposal) => entry.effect === proposal.effect && (entry.target === undefined || entry.target === proposal.target);
const live = (grant, now) => grant.expiresAt === undefined || (Number.isSafeInteger(now) && now < grant.expiresAt);

/** The configured effect policy as it reads at this moment (`read` returns the file's text): decoded, or, when it cannot
 * be read or does not decode, the unavailable marker, never the empty default (a policy being rewritten, removed or made
 * unreadable after launch must not lapse its restrictions). */
export function currentEffectPolicy(read) {
  try { return decodeEffectPolicy(JSON.parse(read())); }
  catch (error) { return { type: UNAVAILABLE_EFFECT_POLICY, reason: error?.code ? `it cannot be read (${String(error.code)})` : 'it does not decode' }; }
}

/**
 * Classifies one proposal `{effect, target, matters?}` against the four tests. The classification is the operator's
 * registration for exactly this effect (and target, when the registration names one) or the effect's worst reachable
 * default; an effect with neither is classified worst-case on every test. A live scope grant for this effect places it
 * inside the granted scope. Returns {profile, tests, consequential, registration}.
 */
export function classifyEffect(proposal, policy = DEFAULT_EFFECT_POLICY, { irreversibleTerm = IRREVERSIBLE_TERM, now } = {}) {
  const registration = policy.registered.find(entry => covers(entry, proposal)) ?? null;
  const base = registration ?? TOOL_EFFECT_DEFAULTS[proposal.effect]
    ?? { consequence: 'external', reversibility: 'irreversible', reach: 'world', costUsd: null };
  const profile = { consequence: base.consequence, reversibility: base.reversibility, reach: base.reach, surface: 'none' };
  const grants = policy.grants.filter(grant => covers(grant, proposal) && live(grant, now));
  const matters = [proposal.effect, ...(proposal.target ? [proposal.target] : []), ...(proposal.matters ?? []), ...(registration?.matters ?? [])];
  const tests = Object.freeze({
    irreversible: termHolds(irreversibleTerm, profile),
    resources: base.costUsd === null || base.costUsd > policy.resourceLevelUsd,
    scope: !INTERNAL_REACH.includes(profile.reach) && !grants.some(grant => grant.approves.includes('scope')),
    policySensitive: matters.some(item => policy.policySensitive.includes(item)) });
  return { profile, costUsd: base.costUsd, tests, consequential: CONSEQUENTIAL_TESTS.some(test => tests[test]),
    registration: registration ? registration.source : null, grants };
}

/** What would admit an effect, for each test that held (the honest second half of a refusal). */
function admitsBy(test, proposal, operations) {
  if (test === 'irreversible') return `a second enrolled machine and ${proposal.effect} registered as an operation with replicated durability `
    + `(one machine dispatches irreversible effects only for its fixed closed set: ${operations.join(', ') || 'none'})`;
  if (test === 'resources') return `a registered cost for it within the level an operator grant names`;
  if (test === 'scope') return `an operator grant placing ${proposal.effect} in this work's scope (nothing outward is on by default)`;
  return `an operator grant approving ${proposal.effect} for this policy-sensitive matter`;
}

/**
 * The doorway's admission of one proposal. `operations` is the installation's accepted closed operation set (P-08).
 * Returns {effect, target, tests, consequential, admitted, disposition: 'ordinary' | 'granted' | 'closed-set' | 'refused',
 * grant?, reason, admits?}. A refusal's `reason` names the tests that held, what would admit the effect, and asks the
 * answer to say so plainly: the model reads it as the tool result.
 */
export function admitEffect(proposal, policy = DEFAULT_EFFECT_POLICY, operations = [], options = {}) {
  const c = classifyEffect(proposal, policy, options);
  const held = CONSEQUENTIAL_TESTS.filter(test => c.tests[test]);
  const head = { effect: proposal.effect, ...(proposal.target ? { target: proposal.target } : {}), tests: c.tests, consequential: c.consequential };
  if (!c.consequential) return { ...head, admitted: true, disposition: 'ordinary',
    reason: `effect doorway: ${proposal.effect} is ordinary (none of the four consequential-effect tests holds); admitted` };
  const inClosedSet = operations.includes(proposal.effect);
  const unanswered = held.filter(test => {
    if (test === 'irreversible') return !inClosedSet;
    if (test === 'scope') return true;
    // A grant names its own level; an unknown cost is above every level, so only a registered cost can be approved.
    if (test === 'resources') return !(c.costUsd !== null && c.grants.some(grant => grant.approves.includes('resources')
      && c.costUsd <= grant.resourceLevelUsd));
    return !c.grants.some(grant => grant.approves.includes('policySensitive'));
  });
  if (!unanswered.length) {
    const grant = c.grants.find(item => item.approves.some(test => held.includes(test)));
    return { ...head, admitted: true, disposition: grant ? 'granted' : 'closed-set', ...(grant ? { grant: grant.id } : {}),
      reason: `effect doorway: ${proposal.effect} is consequential (${held.map(test => TEST_WORDS[test]).join('; ')}); admitted `
        + (grant ? `under the operator's recorded grant ${grant.id}` : 'as an operation in the installation\'s accepted closed set') };
  }
  const admits = unanswered.map(test => admitsBy(test, proposal, operations)).join('; and ');
  return { ...head, admitted: false, disposition: 'refused', admits,
    reason: `effect doorway refused ${proposal.effect}${proposal.target ? ` (${proposal.target})` : ''}: it is consequential because `
      + `${held.map(test => TEST_WORDS[test]).join('; ')}. What would admit it: ${admits}. Nothing was done; tell the user plainly that this `
      + 'step was refused, why, and what would admit it.' };
}

/** The proposal a consequential tool call makes, or null for ordinary in-workspace work (never routed here). */
export function toolEffectProposal(tool, input) {
  if (tool.startsWith('mcp__')) return { effect: 'tool:mcp', target: tool.slice(0, 256) };
  if (tool === 'WebFetch') {
    let host = null; try { host = new URL(String(input?.url ?? '')).hostname || null; } catch { host = null; }
    return { effect: 'tool:network', ...(host ? { target: host.slice(0, 256) } : {}) };
  }
  if (tool === 'WebSearch') return { effect: 'tool:network', target: 'web-search' };
  if (tool === 'Bash' && input?.dangerouslyDisableSandbox) return { effect: 'tool:unsandboxed' };
  return null;
}

/** A plain sentence for each refused effect of an answer's tool turns, carried below the answer by the runner so the
 * refusal is reported even when the model's own words omit it. Keyed per turn, attempt and call. */
export const EFFECT_NOTICE_MAX_CHARS = 600;
export function refusedEffectNotices(decisions, turn) {
  return decisions.filter(item => item.disposition === 'refused' && (turn === undefined || item.turn === turn)).map(item => {
    const line = `Effect doorway: a ${item.effect} step${item.target ? ` (${item.target})` : ''} was refused, because `
      + `${CONSEQUENTIAL_TESTS.filter(test => item.tests[test]).map(test => TEST_WORDS[test]).join('; ')}. `
      + `What would admit it: ${item.admits ?? 'a recorded operator grant naming it'}.`;
    return { key: `effect:${item.turn}#${String(item.attempt)}:${String(item.n)}`,
      line: line.length > EFFECT_NOTICE_MAX_CHARS ? `${line.slice(0, EFFECT_NOTICE_MAX_CHARS - 1)}…` : line };
  });
}

/** Status lines for the doorway's decisions (Rule 84): counts and the most recent decisions, never inputs. */
export function effectDoorwayStatusLines(stats) {
  const s = stats ?? { proposed: 0, ordinary: 0, granted: 0, closedSet: 0, refused: 0, recent: [] };
  const lines = [`Effect doorway: ${s.proposed} effect(s) reached it from tool turns (${s.ordinary} ordinary, ${s.granted} admitted under an `
    + `operator grant, ${s.closedSet} admitted in the accepted closed set, ${s.refused} refused); ordinary work in the turn's own `
    + 'workspace is admitted without it. Replies and model calls go through the installation\'s accepted closed set (provider call, '
    + 'ordinary replies), and limit or end-date changes only through your approved request.'];
  for (const item of (s.recent ?? []).slice(-3)) lines.push(`  ${item.disposition}: ${item.effect}${item.target ? ` (${item.target})` : ''}`
    + ` — tests held: ${CONSEQUENTIAL_TESTS.filter(test => item.tests[test]).join(', ') || 'none'}.`);
  return lines;
}
