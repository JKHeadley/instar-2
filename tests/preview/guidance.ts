/** The guidance sentinel family (Part 18 §16, docs/18-sentinel-holders/16-the-guidance-sentinel-family.md).
 *
 * Guidance sentinels empower: they read the agent's own outbound reply and nudge or correct it, never remove an
 * ability. They are ported in substance from Instar 1.x (the outbound tone gate and its self-stop family, the
 * deferral detector and action-claim follow-through, claim verification, correction and preference learning), and
 * they are not a second gate: every member is a set of named questions on the ONE pre-send reply review that
 * already judges each model-written reply (Jev plus the batched full-context review, reply-check.ts). Their authority
 * is a signal (Rules 4, 57, 86); the only whole-reply floor is the credential wall, which belongs to the reply
 * review and is not a guidance member.
 *
 * Measurement needs no new store (Rules 39, 41, 58, 116): each member's verdict on each reviewed reply is projected
 * from records the journal already keeps (the checks, the agent's disposition of each objection, and what the send
 * actually carried), so the quality counts below are recomputed from durable history on every read. */
import type { Turn } from './journal.js';
import type { ObjectionDecision, ReplyCheckResult, ReplyRule } from './reply-check.js';

export type GuidanceMember = 'tone-self-stop' | 'deferral' | 'claim-verification' | 'correction-learning';
export interface GuidanceMemberDefinition {
  id: GuidanceMember;
  /** The Instar 1.x mechanism whose substance the member carries forward. */
  legacy: string;
  /** Its questions on the reply review: the live arm. */
  rules: readonly ReplyRule[];
  /** Its arm on the existing retrospective consumer (retrospective.ts gravity wells and duties). */
  retrospective: readonly string[];
  /** How the member corrects rather than removes: the path its objection takes back to the agent. */
  correction: string;
}

export const GUIDANCE_FAMILY: readonly GuidanceMemberDefinition[] = Object.freeze([
  { id: 'tone-self-stop', legacy: 'Outbound Message Gate: tone rules and the self-stop family (quitting on itself, a false cannot-do, work handed back)',
    rules: ['raw_path', 'cli_command', 'config_key', 'api_endpoint', 'quits_on_self', 'claims_blocked', 'parks_on_user', 'unrecorded_blocker'],
    retrospective: ['fatigue-stop', 'needless-deferral'],
    correction: 'the agent revises once and answers each objection; a real limit is kept and recorded as an investigation, never talked away' },
  { id: 'deferral', legacy: 'Deferral detector and Action-Claim Follow-Through (a promise of later work becomes tracked work)',
    rules: ['defers_work'], retrospective: ['needless-deferral'],
    correction: 'the agent does the work now or declares the deferral as a tracked loop the runner admits' },
  { id: 'claim-verification', legacy: 'Claim Verification (a factual claim about the agent itself, checked against its own records)',
    rules: ['self_state_claim'], retrospective: ['false-completion', 'invented-memory', 'false-certainty'],
    correction: 'the agent restates the claim to match its recorded state' },
  { id: 'correction-learning', legacy: 'Correction & Preference Learning, with its self-violation signal (a learned preference the agent then breaks)',
    rules: ['breaks_preference'], retrospective: ['feedback'],
    correction: 'the agent brings the reply back within the active preference; a restated preference is counted as a recurrence' },
] as const);

/** What one member concluded about one reviewed reply.
 *  - `fired`: its objection reached the agent (a confirmed review violation, or a deterministic link signal);
 *  - `unconfirmed`: Jev flagged it but no full-context verdict was obtained, so it travelled as a bare signal;
 *  - `clear`: it was judged and found nothing;
 *  - `not-asked`: no check judged any of its questions on this reply (a context question rides only a review that ran). */
export type GuidanceVerdictKind = 'fired' | 'unconfirmed' | 'clear' | 'not-asked';
/** Where a fired objection went: the agent's revision was sent, the named claim was removed, the named claim could not
 * be located in the reply, the reply was held, or the reply was sent unchanged with the objection recorded.
 * A sent landing needs the transport's receipt (Rules 26, 58): the intent row records what the send WOULD carry before
 * dispatch, so an intent with no receipt (a crash, a refusal, an unknown outcome, or an older capture that kept no
 * receipt) is `no-receipt`, with what it selected kept beside it; it is never counted as landed.
 * `unrecorded`: an older turn written before send records named their objections, so where it went is not known. */
export type GuidanceLanding = 'revised' | 'excised' | 'unlocated' | 'held' | 'unchanged' | 'no-receipt' | 'unrecorded';
export type GuidanceSelection = 'revised' | 'excised' | 'unlocated' | 'unchanged';
export interface GuidanceVerdict {
  turn: string; update: number; member: GuidanceMember; verdict: GuidanceVerdictKind;
  rules: ReplyRule[]; decisions: ObjectionDecision[]; landing?: GuidanceLanding;
  /** On `no-receipt` only: what the unconfirmed send intent selected. */
  selected?: GuidanceSelection;
}

/** The questions one check actually judged. Jev answers every question it was asked; a full-context review with
 * per-rule findings judged exactly those rules; a legacy combined verdict judged at least the rules it names. */
function judged(check: ReplyCheckResult): ReplyRule[] {
  if (check.verdict === 'unavailable') return [];
  if (check.path === 'jev') return check.scores ? Object.keys(check.scores) as ReplyRule[] : check.ruleIds;
  if (check.findings) return check.findings.map(finding => finding.rule);
  return check.ruleIds;
}

/** One verdict per member for every reply the review saw, derived only from the turn's recorded history. */
export function guidanceVerdicts(turns: readonly Turn[]): GuidanceVerdict[] {
  const verdicts: GuidanceVerdict[] = [];
  const byId = new Map(turns.map(item => [item.id, item]));
  for (const turn of turns) {
    const checks = turn.replyChecks ?? [];
    if (!checks.length || checks.every(check => check.path === 'operator-echo')) continue;
    const sent = turn.release ?? turn.heldReview;
    // The last check that reached a verdict. When it is Jev's, no full-context verdict confirmed its flags.
    const decisive = checks.filter(check => check.verdict !== 'unavailable' && check.path !== 'operator-echo').at(-1);
    const objections = new Set<string>(sent ? sent.objections
      : decisive && decisive.verdict !== 'pass' ? decisive.ruleIds : []);
    const unconfirmed = sent ? turn.release?.review === 'unavailable' : decisive?.path === 'jev';
    const asked = new Set(checks.flatMap(judged));
    const withheld = turn.release?.withheld ?? turn.heldReview?.withheld;
    for (const member of GUIDANCE_FAMILY) {
      const rules = member.rules.filter(rule => objections.has(rule));
      const decisions = rules.map(rule => sent?.dispositions?.find(item => item.objection === rule)?.decision ?? 'no-decision');
      const base = { turn: turn.id, update: turn.update, member: member.id, rules, decisions };
      if (!rules.length) {
        verdicts.push({ ...base, verdict: member.rules.some(rule => asked.has(rule)) ? 'clear' : 'not-asked' });
        continue;
      }
      const verdict = unconfirmed ? 'unconfirmed' as const : 'fired' as const;
      if (!sent || turn.heldReview) { verdicts.push({ ...base, verdict, landing: sent ? 'held' : 'unrecorded' }); continue; }
      const named = withheld?.rules.some(rule => rules.includes(rule as ReplyRule));
      const selected: GuidanceSelection = turn.release?.revised ? 'revised'
        : named && withheld!.removed.length ? 'excised' : named && withheld!.unlocated.length ? 'unlocated' : 'unchanged';
      // A grouped turn's send is its leader's; the receipt is the only evidence the reply went out.
      const receipt = (turn.groupedInto === undefined ? turn : byId.get(turn.groupedInto))?.sent;
      verdicts.push(receipt === undefined ? { ...base, verdict, landing: 'no-receipt', selected } : { ...base, verdict, landing: selected });
    }
  }
  return verdicts;
}

export interface GuidanceQuality {
  member: GuidanceMember; replies: number; fired: number; unconfirmed: number; clear: number; notAsked: number;
  decisions: Record<ObjectionDecision, number>;
  landing: Record<GuidanceLanding, number>;
}
/** Per-member counts for quality measurement: how often each member fired, how the agent answered it, and whether
 * its correction actually reached the sent reply. "Unchanged" is a recorded signal that did not change the send; a
 * landing counts only with the send's receipt, and an intent without one is counted as `no-receipt`. */
export function guidanceQuality(verdicts: readonly GuidanceVerdict[]): GuidanceQuality[] {
  return GUIDANCE_FAMILY.map(member => {
    const mine = verdicts.filter(verdict => verdict.member === member.id);
    const count = (kind: GuidanceVerdictKind) => mine.filter(verdict => verdict.verdict === kind).length;
    const decisions: Record<ObjectionDecision, number> = { accept: 0, reject: 0, 'no-decision': 0 };
    const landing: Record<GuidanceLanding, number> = { revised: 0, excised: 0, unlocated: 0, held: 0, unchanged: 0, 'no-receipt': 0, unrecorded: 0 };
    for (const verdict of mine) {
      for (const decision of verdict.decisions) decisions[decision]++;
      if (verdict.landing) landing[verdict.landing]++;
    }
    return { member: member.id, replies: mine.length, fired: count('fired'), unconfirmed: count('unconfirmed'),
      clear: count('clear'), notAsked: count('not-asked'), decisions, landing };
  });
}

/** Correction learning's recurrence measure. A durable reply preference is one exact clause; the journal keeps each
 * statement of it and carries ONE active preference from the latest. The operator stating the same clause again after
 * it was already on file is a correction that recurred, meaning the stored preference did not hold in between (1.x's
 * self-violation signal). Exact clause identity, the journal's own key, not a keyword match (Rule 10). */
export interface PreferenceRecurrence { quote: string; sources: string[]; restatements: number }
type PreferenceChange = { mode: string; source: string; quote: string; in?: string };
export function preferenceRecurrences(memory: readonly PreferenceChange[]): PreferenceRecurrence[] {
  const byQuote = new Map<string, string[]>();
  for (const change of memory) {
    // Only the operator's own statements: a preference recorded from the agent's reply is not a correction.
    if (change.mode !== 'prefer' || change.in === 'reply') continue;
    const sources = byQuote.get(change.quote) ?? [];
    if (!sources.includes(change.source)) sources.push(change.source);
    byQuote.set(change.quote, sources);
  }
  return [...byQuote].filter(([, sources]) => sources.length > 1)
    .map(([quote, sources]) => ({ quote, sources, restatements: sources.length - 1 }));
}

/** The runner's read-only status block for the family: per-member quality and recurring preferences (by source id,
 * never the clause text, which the preferences view already shows redacted). */
export function guidanceReport(view: { order: readonly Turn[]; memory: readonly PreferenceChange[] }) {
  return { members: guidanceQuality(guidanceVerdicts(view.order)),
    recurringPreferences: preferenceRecurrences(view.memory).map(item => ({ sources: item.sources, restatements: item.restatements })) };
}
