/** The live journal runner's inventory, joined from its register inputs (Rules 9, 34, 39, 43, 62,
 * 72, 73, 76). The declarations live in `preview.declarations.json`, which the register's source
 * collector reads like every other `*.declarations.json`: the critical outcomes, sentinels,
 * stores and the features whose references the register resolves today. Declarations that name
 * a RECORD reference — a live user-facing feature's `liveProof`, a duty's `proof` — sit in
 * `preview.pending-declarations.json`: the register's current replay phase accepts no record
 * provider, so it cannot resolve them yet; they are reported as pending registration, never
 * dropped (`register-proof-provider.mjs` resolves them once regeneration runs with a provider).
 * This module does not restate either file; it joins them to what the register cannot see from
 * here — the proof plan behind each probe reference, whether a capability repairs an existing
 * experience (Rule 76), what enables it in a launch, the source files whose content is its
 * version, its test tiers, and the journal outcome a live-surface proof of it must show. A
 * missing join stays in the denominator as a gap. */
import { PREVIEW_PROOF_PLANS, probeId, replyTurn, requestedSummaryTurn, statusTurn } from './proofs.js';
import type { LiveProofRecord, PlanPosture, ProofRecord } from './proofs.js';
import { isJournalUpdate } from './journal.js';
import type { JournalView, Turn } from './journal.js';

export type Adjectives = Readonly<Record<'critical' | 'significant' | 'userFacing' | 'irreversible', boolean>>;
export type FeatureStatus = 'live' | 'dark' | 'soaking' | 'retired';
export interface FeatureProfile { type: 'Profile'; schemaVersion: 1; consequence: string; reversibility: string; reach: string; surface: string;
  repeats: { kind: 'no' } | { kind: 'bounded'; by: string } | { kind: 'unbounded' } }
interface Hold { rule: number; class: string; evidence: { kind: string; id: string; stage: string }; portion: string; remainder: string }
interface Declared<K extends string, F> { type: 'Declaration'; schemaVersion: 1; id: string; kind: K; status: FeatureStatus; requiredFacts: F;
  standards: number[]; holds: Hold[] }
export interface FeatureDeclaration extends Declared<'features', { metrics: string[]; gate?: { test: string; deadline: number }; liveProof?: string }> {
  profile: FeatureProfile }
export interface OutcomeDeclaration extends Declared<'critical outcomes', { probe: string; cadence: number }> { profile: FeatureProfile }
export type DutyDeclaration = Declared<'duties of observation', { proof: string; watcher: string; cadence: number }>;
export interface SentinelDeclaration extends Declared<'sentinels', { freshnessProbe: string; scope: 'live' | 'retrospective';
  authority: 'signal' | 'block'; irreversibleMoment?: string }> { profile: FeatureProfile }
export type StoreDeclaration = Declared<'stores', Record<string, unknown>>;
export type PreviewDeclaration = FeatureDeclaration | OutcomeDeclaration | DutyDeclaration | SentinelDeclaration | StoreDeclaration;

/** The journal outcome a live-surface proof of a capability must show. `desk` additionally needs the desk's
 * recorded semantic/arrival observation: an API acceptance alone cannot show that memory was used well. */
export type OutcomeKind = 'reply' | 'reviewed-reply' | 'held-notice' | 'reminder' | 'requested-summary' | 'status'
  | 'spend-cap-hold' | 'stop' | 'memory-change';
export interface Acceptance { outcome: OutcomeKind; tier: 'journal-outcome' | 'desk-semantic' }
export interface CapabilityMeta {
  change: 'capability' | 'repair';
  /** What turns it on in a launch. Only a default-on capability protects every launch. */
  enabledBy: 'default' | 'option:step-check' | 'option:agent-state-dir';
  /** The capability's version is the digest of these files. */
  sources: string[];
  evidence: { unit: string[]; integration: string[]; procedure: string | null };
  acceptance?: Acceptance;
}
export interface PreviewCapability extends CapabilityMeta { declaration: FeatureDeclaration }

const RUNNER = ['tests/preview/journal-agent.mjs', 'tests/preview/journal.ts'];
/** The dark step observer's recorded evaluation target (README, Dark Jev step check): 2026-09-30 00:00 UTC. */
export const STEP_CHECK_GRADUATION_DEADLINE = 1790726400000;
const outcome = (kind: OutcomeKind, tier: Acceptance['tier'] = 'journal-outcome'): Acceptance => ({ outcome: kind, tier });

export const PREVIEW_CAPABILITY_META: Readonly<Record<string, CapabilityMeta>> = Object.freeze({
  'preview.reply': { change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/journal-envelope.ts'],
    evidence: { unit: ['tests/preview/journal.test.ts', 'tests/preview/successive.test.ts'],
      integration: ['tests/preview/journal-agent.test.ts', 'tests/preview/journal-cutover.test.ts'], procedure: 'tests/preview/core-journey-live-test.md' },
    acceptance: outcome('reply') },
  'preview.reply-review': { change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/reply-check.ts'],
    evidence: { unit: ['tests/preview/reply-check.test.ts', 'tests/preview/reply-review-corpus.test.ts'],
      integration: ['tests/preview/review-layers-canary.test.ts', 'tests/preview/reviewer-thinking-bound.test.ts'], procedure: 'tests/preview/jev-live-test.md' },
    acceptance: outcome('reviewed-reply') },
  'preview.held-reply-notice': { change: 'repair', enabledBy: 'default', sources: [...RUNNER],
    evidence: { unit: ['tests/preview/held-reply-replay.test.ts', 'tests/preview/journal-long-message.test.ts'],
      integration: ['tests/preview/held-reply-notice.test.ts'], procedure: 'tests/preview/held-reply-notice-live-test.md' },
    acceptance: outcome('held-notice') },
  'preview.memory': { change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/memory-export.ts'],
    evidence: { unit: ['tests/preview/journal-memory-correction.test.ts', 'tests/preview/journal-undo-memory.test.ts'],
      integration: ['tests/preview/journal-people.test.ts', 'tests/preview/memory-export.test.ts'], procedure: 'tests/preview/memory-health-live-test.md' },
    acceptance: outcome('memory-change', 'desk-semantic') },
  'preview.reminders': { change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/dated-memory.ts'],
    evidence: { unit: ['tests/preview/journal-dated-memory.test.ts'], integration: ['tests/preview/journal-reminder-launcher.test.ts'],
      procedure: 'tests/preview/dated-memory-live-test.md' }, acceptance: outcome('reminder') },
  'preview.requested-summaries': { change: 'capability', enabledBy: 'default', sources: [...RUNNER],
    evidence: { unit: ['tests/preview/journal-requested-summary-timing.test.ts'], integration: ['tests/preview/journal-requested-summary.test.ts'],
      procedure: null }, acceptance: outcome('requested-summary') },
  'preview.rolling-summary': { change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/summary-check.ts', 'tests/preview/summary-faithfulness.ts'],
    evidence: { unit: ['tests/preview/summary-faithfulness.test.ts', 'tests/preview/journal-compaction.test.ts'],
      integration: ['tests/preview/summary-check.test.ts'], procedure: 'tests/preview/summary-supervisor-live-test.md' } },
  'preview.coherence-check': { change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/coherence-check.ts'],
    evidence: { unit: ['tests/preview/coherence-check.test.ts'], integration: ['tests/preview/coherence-check.test.ts'], procedure: null } },
  'preview.step-check': { change: 'capability', enabledBy: 'option:step-check', sources: [...RUNNER, 'tests/preview/step-check.ts'],
    evidence: { unit: ['tests/preview/step-check.test.ts'], integration: [], procedure: 'tests/preview/jev-step-supervisor-live-test.md' } },
  'preview.obligations': { change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/obligations.ts'],
    evidence: { unit: ['tests/preview/journal-obligations.test.ts'], integration: ['tests/preview/journal-obligations.test.ts'], procedure: null },
    acceptance: outcome('reply', 'desk-semantic') },
  'preview.status-pull': { change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/status-command.ts', 'tests/preview/self-state.ts'],
    evidence: { unit: ['tests/preview/status-command.test.ts', 'tests/preview/self-state.test.ts'],
      integration: ['tests/preview/self-state-launcher.test.ts'], procedure: 'tests/preview/live-tests-archive/status-command-live-test.md' }, acceptance: outcome('status') },
  'preview.channel-memory': { change: 'capability', enabledBy: 'option:agent-state-dir', sources: [...RUNNER, 'tests/preview/channel-source.mjs'],
    evidence: { unit: ['tests/preview/channel-source.test.ts'], integration: ['tests/preview/channel-source-launcher.test.ts'],
      procedure: 'tests/preview/channel-source-live-test.md' }, acceptance: outcome('reply', 'desk-semantic') },
  'preview.spend-cap': { change: 'capability', enabledBy: 'default', sources: [...RUNNER],
    evidence: { unit: ['tests/preview/limit-hold.test.ts'], integration: ['tests/preview/journal-spend-cap.test.ts'], procedure: 'tests/preview/spend-cap-live-test.md' },
    acceptance: outcome('spend-cap-hold') },
  'preview.stop': { change: 'capability', enabledBy: 'default', sources: [...RUNNER],
    evidence: { unit: ['tests/preview/journal.test.ts'], integration: ['tests/preview/journal-agent.test.ts'], procedure: null }, acceptance: outcome('stop') },
  'preview.durable-intake': { change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/self-state.ts'],
    evidence: { unit: ['tests/preview/journal-compaction.test.ts', 'tests/preview/journal-upgrade-compat.test.ts'],
      integration: ['tests/preview/journal-cutover.test.ts', 'tests/preview/journal-handoff.test.ts'], procedure: 'tests/preview/journal-restart-continuity-live-test.md' },
    acceptance: outcome('reply', 'desk-semantic') },
  'preview.proofs': { change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/proofs.ts', 'tests/preview/capabilities.ts', 'tests/preview/proof-log.ts'],
    evidence: { unit: ['tests/preview/proofs.test.ts', 'tests/preview/capabilities.test.ts'], integration: ['tests/preview/proofs-launcher.test.ts'], procedure: null },
    acceptance: outcome('status', 'desk-semantic') },
  'preview.answer-provenance': { change: 'capability', enabledBy: 'default', sources: [...RUNNER],
    evidence: { unit: ['tests/preview/journal-reply-grounding.test.ts', 'tests/preview/journal-questions.test.ts'],
      integration: ['tests/preview/answer-provenance.test.ts', 'tests/preview/journal-why.test.ts'], procedure: 'tests/preview/answer-provenance-live-test.md' },
    acceptance: outcome('reply', 'desk-semantic') },
});

/** Critical outcomes whose probe cannot execute on the runner, with the owner of their proof. */
export const RUNTIME_UNAVAILABLE: Readonly<Record<string, string>> = Object.freeze({
  [probeId('stop-honored')]: 'the runner refuses to run after a stop; the stop is proven by the desk-recorded live proof (record-live-proof preview.stop)',
});

export interface PreviewInventory {
  capabilities: PreviewCapability[]; outcomes: OutcomeDeclaration[]; duties: DutyDeclaration[];
  sentinels: SentinelDeclaration[]; stores: StoreDeclaration[];
  /** Joins that did not resolve; each stays in the report as a gap. */
  gaps: string[];
  /** Declarations the register cannot hold yet (record references in its replay phase). */
  pending: string[];
}
const plansById = new Map(PREVIEW_PROOF_PLANS.map(plan => [probeId(plan.id), plan]));
/** Join the register inputs to the runner's plans and capability facts. Nothing here restates a declaration. */
export function previewInventory(declarations: readonly PreviewDeclaration[], pending: readonly PreviewDeclaration[] = []): PreviewInventory {
  const inventory: PreviewInventory = { capabilities: [], outcomes: [], duties: [], sentinels: [], stores: [], gaps: [], pending: pending.map(d => d.id) };
  const ids = new Set<string>();
  for (const declaration of [...declarations, ...pending]) {
    if (ids.has(declaration.id)) inventory.gaps.push(`${declaration.id}: duplicate declaration`);
    ids.add(declaration.id);
    if (declaration.kind === 'features') {
      const meta = PREVIEW_CAPABILITY_META[declaration.id];
      if (!meta) inventory.gaps.push(`${declaration.id}: feature has no runner facts (enablement, sources, tests)`);
      else inventory.capabilities.push({ ...structuredClone(meta), declaration });
    } else if (declaration.kind === 'critical outcomes') inventory.outcomes.push(declaration);
    else if (declaration.kind === 'duties of observation') inventory.duties.push(declaration);
    else if (declaration.kind === 'sentinels') inventory.sentinels.push(declaration);
    else inventory.stores.push(declaration);
  }
  for (const id of Object.keys(PREVIEW_CAPABILITY_META)) if (!inventory.capabilities.some(item => item.declaration.id === id))
    inventory.gaps.push(`${id}: runner facts name an undeclared feature`);
  for (const item of inventory.outcomes) {
    if (!inventory.capabilities.some(capability => item.id.startsWith(`${capability.declaration.id}.`)))
      inventory.gaps.push(`${item.id}: critical outcome names no declared feature`);
    if (!plansById.has(item.requiredFacts.probe) && !RUNTIME_UNAVAILABLE[item.requiredFacts.probe])
      inventory.gaps.push(`${item.id}: probe ${item.requiredFacts.probe} has no runner plan`);
  }
  for (const item of inventory.duties) {
    if (!plansById.has(probeId(item.requiredFacts.proof.replace(/^proofs\.jsonl#/u, ''))))
      inventory.gaps.push(`${item.id}: proof ${item.requiredFacts.proof} has no runner plan`);
    if (!inventory.sentinels.some(sentinel => sentinel.id === item.requiredFacts.watcher))
      inventory.gaps.push(`${item.id}: watcher ${item.requiredFacts.watcher} is not a declared sentinel`);
  }
  for (const item of inventory.sentinels) if (!plansById.has(item.requiredFacts.freshnessProbe))
    inventory.gaps.push(`${item.id}: freshness probe ${item.requiredFacts.freshnessProbe} has no runner plan`);
  for (const plan of PREVIEW_PROOF_PLANS) if (![...inventory.outcomes.map(item => item.requiredFacts.probe),
    ...inventory.sentinels.map(item => item.requiredFacts.freshnessProbe)].includes(probeId(plan.id)))
    inventory.gaps.push(`${plan.id}: runner plan is not declared by any outcome or sentinel`);
  return inventory;
}
/** The critical outcomes a capability must still produce. */
export const outcomesOf = (inventory: PreviewInventory, id: string) => inventory.outcomes.filter(item => item.id.startsWith(`${id}.`));

/** The register's feature invariants plus Rules 34, 43 and 76, over the joined inventory. Every finding names its rule. */
export function capabilityFindings(inventory: PreviewInventory, classify: (p: FeatureProfile) => Adjectives, now: number): string[] {
  const findings = [...inventory.gaps];
  for (const capability of inventory.capabilities) {
    const d = capability.declaration, facts = d.requiredFacts, adjectives = classify(d.profile);
    if (!facts.metrics.length) findings.push(`${d.id}: Rule 39 — metrics cannot be empty`);
    if (d.status === 'dark' || d.status === 'soaking') {
      if (!facts.gate?.test || !Number.isSafeInteger(facts.gate.deadline)) findings.push(`${d.id}: Rule 72 — a ${d.status} capability needs a graduation test and deadline`);
      else if (facts.gate.deadline <= now) findings.push(`${d.id}: Rule 72 — graduation overdue; graduate it, retire it, or record a new deadline`);
    }
    if (d.status === 'live' && capability.enabledBy !== 'default' && capability.change === 'repair')
      findings.push(`${d.id}: Rule 76 — a user-facing repair ships on by default`);
    if (capability.change === 'repair' && adjectives.userFacing && d.status !== 'live')
      findings.push(`${d.id}: Rule 76 — a user-facing repair cannot be ${d.status}`);
    if (adjectives.userFacing && d.status !== 'dark' && !facts.liveProof) findings.push(`${d.id}: Rule 62 — a user-facing capability names its live proof`);
    if (facts.liveProof && !capability.acceptance) findings.push(`${d.id}: Rule 62 — a live proof needs the outcome it must show`);
    const tests = [...capability.evidence.unit, ...capability.evidence.integration];
    if (tests.some(path => !path.endsWith('.test.ts'))) findings.push(`${d.id}: Rule 34 — evidence tiers name executed tests, not documents`);
    if (adjectives.critical && d.status === 'live' && !outcomesOf(inventory, d.id).length)
      findings.push(`${d.id}: Rule 43 — a critical capability declares the outcomes it must still produce`);
    if (adjectives.significant && d.status === 'live') {
      if (!capability.evidence.unit.length) findings.push(`${d.id}: Rule 34 — significant capability without unit evidence`);
      if (!capability.evidence.integration.length) findings.push(`${d.id}: Rule 34 — significant capability without integration evidence`);
      if (!facts.liveProof) findings.push(`${d.id}: Rule 34 — significant capability without a live-proof reference`);
    }
  }
  return findings;
}

/** A dotted status path is reached when the status output carries a value there. */
export function metricReached(status: Readonly<Record<string, unknown>>, path: string): boolean {
  let value: unknown = status;
  for (const part of path.split('.')) {
    if (value === null || typeof value !== 'object') return false;
    value = (value as Record<string, unknown>)[part];
  }
  return value !== undefined;
}

export interface OutcomeRow { id: string; capability: string; plan: string | null; posture: string; confirmed: boolean; owner: string | null }
export type Protection = 'confirmed' | 'unconfirmed' | 'unproven' | 'gap' | 'dark' | 'off-in-this-launch';
export interface CapabilityRow {
  id: string; status: FeatureStatus; change: CapabilityMeta['change']; enabled: boolean; version: string;
  /** False while the declaration waits in the pending file for the register to resolve its record reference. */
  registered: boolean;
  critical: boolean; significant: boolean; userFacing: boolean;
  /** Rules 43/73: `confirmed` only when enabled and every declared outcome is currently proven; a critical
   * capability with no declared outcome is a `gap`; `unproven` is enabled with nothing to prove it. */
  protection: Protection;
  outcomes: OutcomeRow[];
  metrics: { declared: number; unreached: string[] };
  liveProof: { state: 'recorded' | 'stale-version' | 'missing' | 'not-required'; recordedAt: number | null; update: number | null };
  /** Rule 72: the stages this runtime can observe. The preview is the development-agent stage; the other stages
   * and the promotion decision are not observable here and stay unavailable (owner: the desk's promotion record). */
  graduation: { deadline: number; overdue: boolean; stages: Record<'test-agent' | 'development-agent' | 'fleet', 'observed' | 'missing' | 'unavailable'>;
    promotion: 'unavailable' } | null;
}
export interface CapabilityInputs {
  classify(p: FeatureProfile): Adjectives;
  versions: Readonly<Record<string, string>>;
  enabled: Readonly<Record<CapabilityMeta['enabledBy'], boolean>>;
  status: Readonly<Record<string, unknown>>;
  liveProofs: readonly LiveProofRecord[];
  proofs: readonly PlanPosture[];
  now: number;
}
/** Runtime truth per capability: enabled, outcomes currently proven, reached metrics, live proof at the current version. */
export function capabilityRows(inventory: PreviewInventory, input: CapabilityInputs): CapabilityRow[] {
  return inventory.capabilities.map(capability => {
    const d = capability.declaration, adjectives = input.classify(d.profile), version = input.versions[d.id] ?? 'unknown';
    const enabled = d.status !== 'retired' && input.enabled[capability.enabledBy];
    const proofs = input.liveProofs.filter(row => row.liveProof === d.requiredFacts.liveProof && row.capability === d.id);
    const current = proofs.filter(row => row.version === version).at(-1), stale = proofs.at(-1);
    const outcomes = outcomesOf(inventory, d.id).map(item => {
      const plan = PREVIEW_PROOF_PLANS.find(candidate => probeId(candidate.id) === item.requiredFacts.probe);
      const posture = plan ? input.proofs.find(row => row.plan === plan.id)?.posture ?? 'unknown' : 'unavailable';
      const owner = plan ? null : RUNTIME_UNAVAILABLE[item.requiredFacts.probe] ?? 'no runner plan';
      return { id: item.id, capability: d.id, plan: plan?.id ?? null, posture, owner,
        confirmed: posture === 'healthy' || !plan && current !== undefined };
    });
    const protection: Protection = d.status === 'dark' || d.status === 'soaking' ? 'dark' : !enabled ? 'off-in-this-launch'
      : adjectives.critical && !outcomes.length ? 'gap' : !outcomes.length ? 'unproven'
        : outcomes.every(row => row.confirmed) ? 'confirmed' : 'unconfirmed';
    const developed = input.proofs.some(row => row.capability === d.id && row.lastSuccessAt !== null);
    return { id: d.id, status: d.status, change: capability.change, enabled, version, registered: !inventory.pending.includes(d.id),
      critical: adjectives.critical, significant: adjectives.significant, userFacing: adjectives.userFacing, protection, outcomes,
      metrics: { declared: d.requiredFacts.metrics.length, unreached: enabled ? d.requiredFacts.metrics.filter(path => !metricReached(input.status, path)) : [] },
      liveProof: !d.requiredFacts.liveProof ? { state: 'not-required', recordedAt: null, update: null }
        : current ? { state: 'recorded', recordedAt: current.recordedAt, update: current.update }
          : stale ? { state: 'stale-version', recordedAt: stale.recordedAt, update: stale.update } : { state: 'missing', recordedAt: null, update: null },
      graduation: d.requiredFacts.gate ? { deadline: d.requiredFacts.gate.deadline, overdue: input.now >= d.requiredFacts.gate.deadline,
        stages: { 'test-agent': 'unavailable', 'development-agent': developed ? 'observed' : 'missing', fleet: 'unavailable' }, promotion: 'unavailable' } : null };
  });
}

/** Plain lines for the operator's status pull: what is proven, what is not, and why. */
export function proofStatusLines(proofs: readonly PlanPosture[], rows: readonly CapabilityRow[]): string[] {
  const required = proofs.filter(row => row.required), healthy = required.filter(row => row.posture === 'healthy');
  const problems = required.filter(row => row.posture === 'failed' || row.posture === 'stale').map(row => `${row.plan} ${row.posture}`);
  const unobserved = required.filter(row => row.posture === 'unknown').length;
  const count = (value: Protection) => rows.filter(row => row.protection === value).length;
  const liveMissing = rows.filter(row => row.enabled && row.liveProof.state !== 'recorded' && row.liveProof.state !== 'not-required').length;
  const overdue = rows.filter(row => row.graduation?.overdue).map(row => row.id);
  const dark = rows.filter(row => row.protection === 'dark').map(row => row.id);
  const gaps = rows.filter(row => row.protection === 'gap').map(row => row.id);
  return [
    `Proofs: ${healthy.length}/${required.length} healthy${problems.length ? `; ${problems.join(', ')}` : ''}${unobserved ? `; ${unobserved} not currently observed` : ''}.`,
    `Capabilities: ${count('confirmed')} confirmed, ${count('unconfirmed')} unconfirmed, ${dark.length} dark${dark.length ? ` (${dark.join(', ')})` : ''}${gaps.length ? `, gaps: ${gaps.join(', ')}` : ''}; ${liveMissing} without a live proof at their current version${overdue.length ? `; graduation overdue: ${overdue.join(', ')}` : ''}.`,
  ];
}

/** What a live-surface proof of a capability must find in the journal, for the named operator update. */
export interface LiveProofInput {
  capability: PreviewCapability; view: JournalView; update: number; deskObservation: string | null;
  /** The operator's stop latch, when one was recorded. */
  stopLatch: { latchedAt: number } | null;
  /** The run log's launches and the durable startup proofs: together they name the launch that executed the outcome. */
  launches: readonly { at: number; exit?: number; reason?: string }[];
  startups: readonly ProofRecord[];
  now: number;
}
export type LiveProofResult = { ok: true; record: LiveProofRecord } | { ok: false; reason: string };
const CAP_HOLDS = new Set(['call cap', 'reply cap']);
/** The capability's acceptance predicate against the actual outcome, bound to the launch that executed it:
 * an unrelated turn, a capability the executing launch had off, and an outcome from another version all refuse. */
export function resolveLiveProof(input: LiveProofInput): LiveProofResult {
  const { capability, view, update } = input, d = capability.declaration;
  const refuse = (reason: string): LiveProofResult => ({ ok: false, reason });
  if (!d.requiredFacts.liveProof || !capability.acceptance) return refuse('capability names no live proof');
  if (capability.acceptance.tier === 'desk-semantic' && !input.deskObservation?.trim())
    return refuse('this capability needs the desk-recorded semantic observation (--desk-observation)');
  if (!isJournalUpdate(update)) return refuse('the update is outside the journal\'s update domain');
  const turn = view.order.find(item => item.update === update);
  const sent = (item: Turn | undefined) => item?.sent !== undefined && item.sentAt !== undefined ? { message: item.sent, at: item.sentAt } : null;
  let found: { message: number | null; at: number } | null = null;
  switch (capability.acceptance.outcome) {
    case 'reply': found = turn && replyTurn(turn) ? sent(turn) : null; break;
    case 'reviewed-reply': found = turn && replyTurn(turn) && turn.replyChecks?.some(check => check.verdict === 'pass') ? sent(turn) : null; break;
    case 'status': found = turn && statusTurn(turn) ? sent(turn) : null; break;
    case 'requested-summary': found = turn && requestedSummaryTurn(turn) ? sent(turn) : null; break;
    case 'memory-change': found = turn && replyTurn(turn) && view.memory.some(change => change.trigger === turn.id) ? sent(turn) : null; break;
    case 'held-notice': found = turn?.heldNoticeSent !== undefined && turn.heldNoticeSentAt !== undefined
      ? { message: turn.heldNoticeSent, at: turn.heldNoticeSentAt } : null; break;
    case 'reminder': {
      const reminder = turn && [...view.reminders.values()].filter(item => item.sent !== undefined && item.sentAt !== undefined
        && item.items.some(ref => ref.source === turn.id)).at(-1);
      found = reminder ? { message: reminder.sent!, at: reminder.sentAt! } : null; break;
    }
    case 'spend-cap-hold': {
      const hold = turn && view.awayEvents.filter(event => event.kind === 'hold' && event.id === turn.id && CAP_HOLDS.has(event.reason ?? '')).at(-1);
      found = hold && view.calls <= view.limits.maxCalls && view.replies <= view.limits.maxReplies ? { message: null, at: hold.at } : null; break;
    }
    case 'stop': {
      // Proven by what did not happen: a launch running at the latch ended on it, none started after, nothing was sent past it.
      const latch = input.stopLatch;
      const running = latch && input.launches.find(run => run.at <= latch.latchedAt && (run.exit ?? Number.MAX_SAFE_INTEGER) >= latch.latchedAt);
      const ranPast = latch && input.launches.some(run => run.at > latch.latchedAt);
      // Every send the journal accepts counts: replies, held notices and reminders alike.
      const sentAfter = latch && (view.order.some(item => (item.sentAt ?? 0) > latch.latchedAt || (item.heldNoticeSentAt ?? 0) > latch.latchedAt)
        || [...view.reminders.values()].some(item => (item.sentAt ?? 0) > latch.latchedAt));
      found = latch && Number.isSafeInteger(latch.latchedAt) && (!running || running.reason === 'operator stop latched')
        && !ranPast && !sentAfter && update === view.cursor ? { message: null, at: latch.latchedAt } : null; break;
    }
  }
  if (!found) return refuse(`update ${update} does not show the ${capability.acceptance.outcome} outcome ${d.id} must produce`);
  // The launch that executed it: the run covering the outcome's time, and the startup proof it recorded.
  let index = input.launches.findIndex((run, i) => run.at <= found.at
    && found.at <= (run.exit ?? input.launches[i + 1]?.at ?? Number.MAX_SAFE_INTEGER));
  // A stop latched between launches is honoured by the code the last launch ran.
  if (index < 0 && capability.acceptance.outcome === 'stop') index = input.launches.map(run => run.at <= found.at).lastIndexOf(true);
  if (index < 0) return refuse('no recorded launch covers the outcome');
  const floor = input.launches[index - 1]?.exit ?? input.launches[index - 1]?.at ?? -1;
  const startup = input.startups.filter(row => row.plan === 'startup' && row.startedAt > floor && row.startedAt <= input.launches[index]!.at).at(-1);
  if (!startup) return refuse('the executing launch recorded no startup proof, so its version is unknown');
  const version = startup.observed[`version:${d.id}`], enabled = capability.enabledBy === 'default' ? true
    : startup.observed[capability.enabledBy === 'option:step-check' ? 'stepCheck' : 'agentState'] === true;
  if (typeof version !== 'string') return refuse('the executing launch declared no version for this capability');
  if (!enabled) return refuse(`the executing launch had ${d.id} off`);
  return { ok: true, record: { v: 1, liveProof: d.requiredFacts.liveProof, capability: d.id, version, generation: startup.generation,
    fact: capability.acceptance.tier === 'desk-semantic' ? 'desk-observed' : 'outcome-observed', update, messageId: found.message,
    observedAt: found.at, recordedAt: input.now, deskObservation: capability.acceptance.tier === 'desk-semantic' ? input.deskObservation!.trim() : null } };
}
