// Role admission, the purpose's five sign-off conditions, and durability are separate.
// The legacy `tests`/`consequential` fields remain the journal and never-twice protocol:
// irreversible work still uses a stable identity even when it needs no sign-off.
// `operations` comes from the installation owner, never a role grant. On one machine
// it remains P-08's fixed provider/Telegram/Slack set; replicated operations must
// pass the existing effect owner's exact durable-prefix check before dispatch.
export const SIGN_OFF_TESTS = Object.freeze(['resources', 'irreversibleOutsideRole', 'publicInPersonName', 'widensAuthority', 'policySensitive']);
const SIGN_OFF_WORDS = Object.freeze({
  resources: 'it may commit money or a resource above the level the person named',
  irreversibleOutsideRole: 'it cannot be undone and falls outside the recorded role',
  publicInPersonName: 'it speaks publicly in the person’s name',
  widensAuthority: 'it widens the agent’s own role or authority',
  policySensitive: 'it touches a matter the person marked sensitive' });
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
  'tool:network-write': Object.freeze({ consequence: 'external', reversibility: 'irreversible', reach: 'world', costUsd: null }),
  'tool:unsandboxed': Object.freeze({ consequence: 'control', reversibility: 'irreversible', reach: 'world', costUsd: null }),
  'tool:network': Object.freeze({ consequence: 'external', reversibility: 'reversible', reach: 'world', costUsd: 0 }) });

/** Before onboarding there is no recorded role. Onboarding records its standing grants here. */
export const DEFAULT_EFFECT_POLICY = Object.freeze({ type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: Object.freeze([]),
  registered: Object.freeze([]), grants: Object.freeze([]) });

/** The marker the runner hands the hook when its configured effect policy could not be read at a turn: distinct from
 * "no policy configured", so the operator's restrictions are never silently replaced by the empty default. */
export const UNAVAILABLE_EFFECT_POLICY = 'PreviewEffectPolicyUnavailable';

const text = (value, max = 256) => typeof value === 'string' && value.length > 0 && value.length <= max;
const strings = (value, max = 64) => Array.isArray(value) && value.length <= max && value.every(item => text(item));
const level = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const requestScope = (entry) => entry.request === undefined || (entry.effect === 'tool:network-write'
  && entry.request && Object.keys(entry.request).length === 2 && /^[A-Z]+$/u.test(entry.request.method)
  && text(entry.request.path, 2048) && entry.request.path.startsWith('/'));
const effectId = value => text(value, 64) && /^[a-z]+:[a-z0-9:-]+$/u.test(value);

/** Decodes an operator effect policy (the file `--effect-policy` names). Closed: an unknown field, a grant without its
 * recorded operator source, custodian and recovery obligation (a role grant names its surface,
 * custodian and recovery), or a registration outside the profile vocabulary refuses the whole policy. */
export function decodeEffectPolicy(value) {
  const fail = why => { throw Error(`effect policy: ${why}`); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('not an object');
  const known = ['type', 'resourceLevelUsd', 'policySensitive', 'registered', 'grants', 'role'];
  for (const key of Object.keys(value)) if (!known.includes(key)) fail(`unknown field ${key}`);
  if (value.type !== 'PreviewEffectPolicy') fail('type');
  if (!level(value.resourceLevelUsd)) fail('resourceLevelUsd');
  if (!strings(value.policySensitive)) fail('policySensitive');
  if (!Array.isArray(value.registered) || value.registered.length > 64) fail('registered');
  const registered = value.registered.map(entry => {
    if (!entry || typeof entry !== 'object' || !effectId(entry.effect) || (entry.target !== undefined && !text(entry.target))
      || !CONSEQUENCE.includes(entry.consequence) || !REVERSIBILITY.includes(entry.reversibility) || !REACH.includes(entry.reach)
      || ['publicInPersonName', 'widensAuthority'].some(key => entry[key] !== undefined && typeof entry[key] !== 'boolean')
      || !requestScope(entry) || !(entry.costUsd === null || level(entry.costUsd)) || (entry.matters !== undefined && !strings(entry.matters)) || !text(entry.source))
      fail('registration');
    return Object.freeze({ ...entry, ...(entry.matters ? { matters: Object.freeze([...entry.matters]) } : {}) });
  });
  if (!Array.isArray(value.grants) || value.grants.length > 64) fail('grants');
  const grants = value.grants.map(grant => {
    if (!grant || typeof grant !== 'object' || !text(grant.id, 128) || !effectId(grant.effect) || (grant.target !== undefined && !text(grant.target))
      || !requestScope(grant) || !Array.isArray(grant.approves) || grant.approves.length === 0
      || !grant.approves.every(test => ['scope', 'resources', 'policySensitive', 'publicInPersonName', 'widensAuthority'].includes(test))
      || (grant.approves.includes('resources') ? !level(grant.resourceLevelUsd) : grant.resourceLevelUsd !== undefined) || !text(grant.source)
      || !text(grant.custodian) || !text(grant.recovery, 1024)
      || (grant.expiresAt !== undefined && !Number.isSafeInteger(grant.expiresAt))) fail(`grant ${String(grant?.id)}`);
    return Object.freeze({ ...grant, approves: Object.freeze([...grant.approves]) });
  });
  if (value.role !== undefined && (!value.role || !text(value.role.description, 2048)
    || !strings(value.role.accounts) || !strings(value.role.channels) || !text(value.role.trust, 1024))) fail('role');
  const role = value.role === undefined ? {} : { role: Object.freeze({ description: value.role.description,
    accounts: Object.freeze([...value.role.accounts]), channels: Object.freeze([...value.role.channels]), trust: value.role.trust }) };
  const policy = { type: 'PreviewEffectPolicy', resourceLevelUsd: value.resourceLevelUsd,
    policySensitive: Object.freeze([...value.policySensitive]), registered, grants: Object.freeze(grants), ...role };
  // Recompute on every decode: editing grants/limits cannot retain a stale registration verdict.
  // Expiring grants are rechecked at use, so this record is registration-time classification only.
  policy.registered = Object.freeze(registered.map(entry => {
    const c = classifyEffect(entry, policy);
    return Object.freeze({ ...entry, classification: Object.freeze({ signOff: c.signOff, durability: c.durability }) });
  }));
  return Object.freeze(policy);
}

/** Evaluates one register term expression over a profile (part one's `deriveProfile`, the same three forms). */
export function termHolds(term, profile, depth = 0) {
  if (depth > 32 || !term || typeof term !== 'object') throw Error('effect doorway: malformed term');
  if ('field' in term) return term.in.includes(profile[term.field]);
  if ('any' in term) return term.any.some(child => termHolds(child, profile, depth + 1));
  if ('all' in term) return term.all.every(child => termHolds(child, profile, depth + 1));
  throw Error('effect doorway: malformed term');
}

const covers = (entry, proposal) => entry.effect === proposal.effect && (entry.target === undefined || entry.target === proposal.target)
  && (entry.request === undefined || (entry.request.method === proposal.request?.method && entry.request.path === proposal.request?.path));
const live = (grant, now) => grant.expiresAt === undefined || (Number.isSafeInteger(now) && now < grant.expiresAt);

/** The configured effect policy as it reads at this moment (`read` returns the file's text): decoded, or, when it cannot
 * be read or does not decode, the unavailable marker, never the empty default (a policy being rewritten, removed or made
 * unreadable after launch must not lapse its restrictions). */
export function currentEffectPolicy(read) {
  try { return decodeEffectPolicy(JSON.parse(read())); }
  catch (error) { return { type: UNAVAILABLE_EFFECT_POLICY, reason: error?.code ? `it cannot be read (${String(error.code)})` : 'it does not decode' }; }
}

/**
 * Classifies one proposal against role, the five sign-off cases, and durability separately. The classification is the operator's
 * registration for exactly this effect (and target, when the registration names one) or the effect's worst reachable
 * default; an effect with neither is classified worst-case on every test. A live scope grant for this effect places it
 * inside the granted scope. Legacy risk flags are retained for never-twice identity, not sign-off.
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
  const signOff = Object.freeze({
    resources: tests.resources && !(base.costUsd !== null && grants.some(grant => grant.approves.includes('resources')
      && base.costUsd <= grant.resourceLevelUsd)),
    irreversibleOutsideRole: tests.irreversible && tests.scope,
    publicInPersonName: base.publicInPersonName === true,
    widensAuthority: base.widensAuthority === true,
    policySensitive: tests.policySensitive });
  const durability = Object.freeze({ irreversible: tests.irreversible,
    demand: tests.irreversible ? 'installed-operation' : 'local-durable',
    rule: tests.irreversible ? 'an irreversible act follows its durable cause' : 'ordinary bounded operations retain their whole cause at least locally' });
  return { profile, costUsd: base.costUsd, tests, signOff, signOffRequired: SIGN_OFF_TESTS.some(test => signOff[test]), durability,
    consequential: CONSEQUENTIAL_TESTS.some(test => tests[test]) || SIGN_OFF_TESTS.some(test => signOff[test]),
    registration: registration ? registration.source : null, grants };
}

/** What would admit an effect, for each test that held (the honest second half of a refusal). */
function admitsBy(test, proposal, operations) {
  if (test === 'irreversible') return `a second enrolled machine and ${proposal.effect} registered as an operation with replicated durability `
    + `(one machine dispatches irreversible effects only for its fixed closed set: ${operations.join(', ') || 'none'})`;
  if (test === 'resources') return `a registered cost for it within the level an operator grant names`;
  if (test === 'scope') return `an operator grant placing ${proposal.effect}${proposal.target ? ` (${proposal.target})` : ''} in this work's scope (purpose: a role is granted once, at onboarding)`;
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
  const head = { effect: proposal.effect, ...(proposal.target ? { target: proposal.target } : {}), tests: c.tests,
    consequential: c.consequential, signOff: c.signOff, signOffRequired: c.signOffRequired, durability: c.durability };
  const inClosedSet = operations.includes(proposal.effect);
  const missingSignOff = SIGN_OFF_TESTS.filter(test => c.signOff[test]
    && !c.grants.some(grant => grant.approves.includes(test)));
  // Unknown or above-level cost cannot be covered by a resource grant merely naming the test.
  if (c.signOff.resources && !missingSignOff.includes('resources')) missingSignOff.push('resources');
  const missing = [];
  if (c.tests.irreversible && !inClosedSet) missing.push(['durability',
    'purpose: a single-machine installation is a supported deployment shape; an irreversible act follows its durable cause',
    admitsBy('irreversible', proposal, operations)]);
  if (c.tests.scope) missing.push(['role', 'purpose: a role is granted once, at onboarding', admitsBy('scope', proposal, operations)]);
  if (missingSignOff.length) missing.push(['sign-off', 'purpose: sign-off is kept for a short, fixed list',
    missingSignOff.map(test => test === 'resources' || test === 'policySensitive' ? admitsBy(test, proposal, operations)
      : `the person’s sign-off for ${proposal.effect}: ${SIGN_OFF_WORDS[test]}`).join('; ')]);
  if (missing.length) {
    const admits = missing.map(item => item[2]).join('; and ');
    return { ...head, admitted: false, disposition: 'refused', refusedFor: missing.map(item => item[0]), admits,
      reason: `effect doorway refused ${proposal.effect}${proposal.target ? ` (${proposal.target})` : ''}: `
        + missing.map(item => `${item[0]} (${item[1]})`).join('; ') + `. What would admit it: ${admits}. Nothing was done; `
        + 'tell the user plainly that this step was refused, why, and what would admit it.' };
  }
  const grant = c.grants.find(item => item.approves.some(test => c.tests[test] || c.signOff[test]));
  const disposition = !c.consequential ? 'ordinary' : grant ? 'granted' : 'closed-set';
  return { ...head, admitted: true, disposition, ...(grant ? { grant: grant.id } : {}),
    reason: `effect doorway: ${proposal.effect} is ${disposition}; admitted under its recorded role and installed durability path` };
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
      + `${item.refusedFor?.length ? item.refusedFor.join('; ') : CONSEQUENTIAL_TESTS.filter(test => item.tests[test]).map(test => TEST_WORDS[test]).join('; ')}. `
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
