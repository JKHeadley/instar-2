/** The live journal runner's shipped capabilities, declared in the register's own `features`
 * vocabulary (Rules 34, 39, 62, 72, 73, 76). Each `declaration` is an exact register
 * Declaration — the register's decoder and deadline check accept it (capabilities.test.ts) —
 * so the preview is no longer outside the feature/proof/graduation accounting.
 *
 * Beside the declaration each capability names what the register cannot see from here:
 * whether it repairs an existing experience or adds a new one (Rule 76), what enables it in
 * a launch, the source files whose content is its version (a live proof binds to that
 * version, so an unrelated edit never voids it), and its executed evidence tiers. A written
 * live-test procedure is recorded as a procedure, never as evidence (Rule 62). */
import type { LiveFact, LiveProofRecord, PlanPosture } from './proofs.js';

export type Adjectives = Readonly<Record<'critical' | 'significant' | 'userFacing' | 'irreversible', boolean>>;
export type FeatureStatus = 'live' | 'dark' | 'soaking' | 'retired';
export interface FeatureProfile { type: 'Profile'; schemaVersion: 1; consequence: string; reversibility: string; reach: string; surface: string;
  repeats: { kind: 'no' } | { kind: 'bounded'; by: string } | { kind: 'unbounded' } }
export interface FeatureDeclaration {
  type: 'Declaration'; schemaVersion: 1; id: string; kind: 'features'; status: FeatureStatus;
  requiredFacts: { metrics: string[]; gate?: { test: string; deadline: number }; liveProof?: string };
  profile: FeatureProfile; standards: number[]; holds: [];
}
export interface PreviewCapability {
  declaration: FeatureDeclaration;
  change: 'capability' | 'repair';
  /** What turns it on in a launch. Only a default-on capability protects every launch. */
  enabledBy: 'default' | 'option:step-check' | 'option:agent-state-dir';
  /** The capability's version is the digest of these files. */
  sources: string[];
  evidence: { unit: string[]; integration: string[]; procedure: string | null };
  /** The journal fact a live-surface run of this capability produces; recorded only when actually observed. */
  liveFact?: LiveFact;
}

const profile = (consequence: string, reversibility: string, reach: string, surface: string,
  repeats: FeatureProfile['repeats'] = { kind: 'no' }): FeatureProfile =>
  ({ type: 'Profile', schemaVersion: 1, consequence, reversibility, reach, surface, repeats });
const feature = (id: string, status: FeatureStatus, metrics: string[], p: FeatureProfile, standards: number[],
  extra: Partial<FeatureDeclaration['requiredFacts']> = {}): FeatureDeclaration =>
  ({ type: 'Declaration', schemaVersion: 1, id, kind: 'features', status, requiredFacts: { metrics, ...extra }, profile: p, standards, holds: [] });
/** Every preview send and call is bounded by the journal's reply and model-call allowances, declared by preview.spend-cap. */
const BY_ALLOWANCE = { kind: 'bounded', by: 'preview.spend-cap' } as const;
const live = (id: string) => ({ liveProof: `live-proof:${id}` });
const RUNNER = ['tests/preview/journal-agent.mjs', 'tests/preview/journal.ts'];
/** The dark step observer's recorded evaluation target (README, Dark Jev step check): 2026-09-30 00:00 UTC. */
export const STEP_CHECK_GRADUATION_DEADLINE = 1790726400000;

export const PREVIEW_CAPABILITIES: readonly PreviewCapability[] = Object.freeze([
  { declaration: feature('preview.reply', 'live', ['replies', 'calls', 'replyTimings', 'lastReplyTiming', 'callOutcomeCounts'],
    profile('external', 'irreversible', 'operator', 'chat', BY_ALLOWANCE), [43, 62], live('preview.reply')),
  change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/journal-envelope.ts'],
  evidence: { unit: ['tests/preview/journal.test.ts', 'tests/preview/successive.test.ts'],
    integration: ['tests/preview/journal-agent.test.ts', 'tests/preview/journal-cutover.test.ts'], procedure: 'tests/preview/core-journey-live-test.md' } },
  { declaration: feature('preview.reply-review', 'live', ['replyChecks', 'replyCheckPaths', 'lastReplyReview', 'jevChecks'],
    profile('external', 'irreversible', 'operator', 'chat', BY_ALLOWANCE), [4, 38, 57], live('preview.reply-review')),
  change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/reply-check.ts'],
  evidence: { unit: ['tests/preview/reply-check.test.ts', 'tests/preview/reply-review-corpus.test.ts'],
    integration: ['tests/preview/review-layers-canary.test.ts', 'tests/preview/reviewer-thinking-bound.test.ts'], procedure: 'tests/preview/jev-live-test.md' } },
  { declaration: feature('preview.held-reply-notice', 'live', ['heldNotices', 'holds', 'tooLong'],
    profile('attention', 'irreversible', 'operator', 'chat', BY_ALLOWANCE), [42, 62, 76], live('preview.held-reply-notice')),
  change: 'repair', enabledBy: 'default', sources: [...RUNNER],
  evidence: { unit: ['tests/preview/held-reply-replay.test.ts', 'tests/preview/journal-long-message.test.ts'],
    integration: ['tests/preview/held-reply-notice.test.ts'], procedure: 'tests/preview/held-reply-notice-live-test.md' }, liveFact: 'held-notice-accepted' },
  { declaration: feature('preview.memory', 'live', ['memoryHealth', 'people', 'commitments', 'undos', 'conflicts', 'withheld'],
    profile('data', 'costly', 'agent', 'chat'), [6, 7, 62], live('preview.memory')),
  change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/memory-export.ts'],
  evidence: { unit: ['tests/preview/journal-memory-correction.test.ts', 'tests/preview/journal-undo-memory.test.ts'],
    integration: ['tests/preview/journal-people.test.ts', 'tests/preview/memory-export.test.ts'], procedure: 'tests/preview/memory-health-live-test.md' } },
  { declaration: feature('preview.reminders', 'live', ['reminders', 'dated'],
    profile('external', 'irreversible', 'operator', 'chat', BY_ALLOWANCE), [8, 62], live('preview.reminders')),
  change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/dated-memory.ts'],
  evidence: { unit: ['tests/preview/journal-dated-memory.test.ts'], integration: ['tests/preview/journal-reminder-launcher.test.ts'],
    procedure: 'tests/preview/dated-memory-live-test.md' } },
  { declaration: feature('preview.requested-summaries', 'live', ['requestedSummaries'],
    profile('external', 'irreversible', 'operator', 'chat', BY_ALLOWANCE), [52, 62], live('preview.requested-summaries')),
  change: 'capability', enabledBy: 'default', sources: [...RUNNER],
  evidence: { unit: ['tests/preview/journal-requested-summary-timing.test.ts'], integration: ['tests/preview/journal-requested-summary.test.ts'],
    procedure: null } },
  { declaration: feature('preview.rolling-summary', 'live', ['summaries', 'summaryChecks', 'lastSummaryFaithfulness', 'summaryPending'],
    profile('data', 'costly', 'agent', 'none'), [7, 38], {}),
  change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/summary-check.ts', 'tests/preview/summary-faithfulness.ts'],
  evidence: { unit: ['tests/preview/summary-faithfulness.test.ts', 'tests/preview/journal-compaction.test.ts'],
    integration: ['tests/preview/summary-check.test.ts'], procedure: 'tests/preview/summary-supervisor-live-test.md' } },
  { declaration: feature('preview.coherence-check', 'live', ['coherence'], profile('attention', 'reversible', 'agent', 'none'), [26], {}),
  change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/coherence-check.ts'],
  evidence: { unit: ['tests/preview/coherence-check.test.ts'], integration: ['tests/preview/coherence-check.test.ts'], procedure: null } },
  { declaration: feature('preview.step-check', 'dark', ['stepChecks'], profile('attention', 'reversible', 'agent', 'none'), [9, 38, 73],
    { gate: { test: 'tests/preview/jev-step-supervisor-live-test.md', deadline: STEP_CHECK_GRADUATION_DEADLINE } }),
  change: 'capability', enabledBy: 'option:step-check', sources: [...RUNNER, 'tests/preview/step-check.ts'],
  evidence: { unit: ['tests/preview/step-check.test.ts'], integration: [], procedure: 'tests/preview/jev-step-supervisor-live-test.md' } },
  { declaration: feature('preview.obligations', 'live', ['obligations', 'directives', 'blockers'],
    profile('attention', 'reversible', 'operator', 'chat'), [8, 46, 83, 93], live('preview.obligations')),
  change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/obligations.ts'],
  evidence: { unit: ['tests/preview/journal-obligations.test.ts'], integration: ['tests/preview/journal-obligations.test.ts'], procedure: null } },
  { declaration: feature('preview.status-pull', 'live', ['digest', 'self', 'obligations', 'proofs'],
    profile('attention', 'irreversible', 'operator', 'chat'), [62, 92], live('preview.status-pull')),
  change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/status-command.ts', 'tests/preview/self-state.ts'],
  evidence: { unit: ['tests/preview/status-command.test.ts', 'tests/preview/self-state.test.ts'],
    integration: ['tests/preview/self-state-launcher.test.ts'], procedure: 'tests/preview/operator-digest-live-test.md' } },
  { declaration: feature('preview.channel-memory', 'live', ['channelSources', 'channelItems'], profile('data', 'costly', 'agent', 'chat'), [32, 62],
    live('preview.channel-memory')),
  change: 'capability', enabledBy: 'option:agent-state-dir', sources: [...RUNNER, 'tests/preview/channel-source.mjs'],
  evidence: { unit: ['tests/preview/channel-source.test.ts'], integration: ['tests/preview/channel-source-launcher.test.ts'],
    procedure: 'tests/preview/channel-source-live-test.md' } },
  { declaration: feature('preview.spend-cap', 'live', ['calls', 'limits', 'capReports', 'tokenTotal'],
    profile('money', 'irreversible', 'operator', 'none', BY_ALLOWANCE), [15, 60, 75], live('preview.spend-cap')),
  change: 'capability', enabledBy: 'default', sources: [...RUNNER],
  evidence: { unit: ['tests/preview/limit-hold.test.ts'], integration: ['tests/preview/journal-spend-cap.test.ts'], procedure: 'tests/preview/spend-cap-live-test.md' },
  liveFact: 'held-notice-accepted' },
  { declaration: feature('preview.stop', 'live', ['stop'], profile('control', 'reversible', 'operator', 'none'), [4, 15], live('preview.stop')),
  change: 'capability', enabledBy: 'default', sources: [...RUNNER],
  evidence: { unit: ['tests/preview/journal.test.ts'], integration: ['tests/preview/journal-agent.test.ts'], procedure: null }, liveFact: 'stop-latched' },
  { declaration: feature('preview.durable-intake', 'live', ['cursor', 'turns', 'unknownSends', 'launches'],
    profile('data', 'irreversible', 'agent', 'none'), [2, 32, 46, 68], {}),
  change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/self-state.ts'],
  evidence: { unit: ['tests/preview/journal-compaction.test.ts', 'tests/preview/journal-upgrade-compat.test.ts'],
    integration: ['tests/preview/journal-cutover.test.ts', 'tests/preview/journal-handoff.test.ts'], procedure: 'tests/preview/journal-restart-continuity-live-test.md' } },
  { declaration: feature('preview.proofs', 'live', ['proofs', 'stepCoverage', 'proofLog'], profile('attention', 'reversible', 'operator', 'chat'),
    [9, 26, 39, 43, 72, 73], live('preview.proofs')),
  change: 'capability', enabledBy: 'default', sources: [...RUNNER, 'tests/preview/proofs.ts', 'tests/preview/capabilities.ts', 'tests/preview/proof-log.ts'],
  evidence: { unit: ['tests/preview/proofs.test.ts', 'tests/preview/capabilities.test.ts'], integration: ['tests/preview/proofs-launcher.test.ts'], procedure: null } },
  { declaration: feature('preview.answer-provenance', 'live', ['answerProvenance', 'replyGrounding', 'openQuestions'],
    profile('attention', 'reversible', 'operator', 'chat'), [41, 58, 62], live('preview.answer-provenance')),
  change: 'capability', enabledBy: 'default', sources: [...RUNNER],
  evidence: { unit: ['tests/preview/journal-reply-grounding.test.ts', 'tests/preview/journal-questions.test.ts'],
    integration: ['tests/preview/answer-provenance.test.ts', 'tests/preview/journal-why.test.ts'], procedure: 'tests/preview/answer-provenance-live-test.md' } },
] satisfies PreviewCapability[]);

/** The register's feature invariants plus Rules 34 and 76, over declared data. Every finding names its rule. */
export function capabilityFindings(capabilities: readonly PreviewCapability[], classify: (p: FeatureProfile) => Adjectives, now: number): string[] {
  const findings: string[] = [], ids = new Set<string>();
  for (const capability of capabilities) {
    const d = capability.declaration, facts = d.requiredFacts, adjectives = classify(d.profile);
    if (ids.has(d.id)) findings.push(`${d.id}: duplicate capability`);
    ids.add(d.id);
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
    const tests = [...capability.evidence.unit, ...capability.evidence.integration];
    if (tests.some(path => !path.endsWith('.test.ts'))) findings.push(`${d.id}: Rule 34 — evidence tiers name executed tests, not documents`);
    if (adjectives.significant && d.status === 'live') {
      if (!capability.evidence.unit.length) findings.push(`${d.id}: Rule 34 — significant capability without unit evidence`);
      if (!capability.evidence.integration.length) findings.push(`${d.id}: Rule 34 — significant capability without integration evidence`);
      if (adjectives.userFacing && !facts.liveProof) findings.push(`${d.id}: Rule 34 — significant capability without a live-proof reference`);
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

export interface CapabilityRow {
  id: string; status: FeatureStatus; change: PreviewCapability['change']; enabled: boolean; version: string;
  critical: boolean; significant: boolean; userFacing: boolean;
  /** Rule 73: protection counts only when enabled; a dark or off capability is named, never counted. */
  protection: 'enabled' | 'dark' | 'off-in-this-launch';
  metrics: { declared: number; unreached: string[] };
  liveProof: { state: 'recorded' | 'stale-version' | 'missing' | 'not-required'; recordedAt: number | null; update: number | null };
  graduation: { deadline: number; overdue: boolean } | null;
  proofs: { plan: string; posture: string }[];
}
export interface CapabilityInputs {
  classify(p: FeatureProfile): Adjectives;
  versions: Readonly<Record<string, string>>;
  enabled: Readonly<Record<PreviewCapability['enabledBy'], boolean>>;
  status: Readonly<Record<string, unknown>>;
  liveProofs: readonly LiveProofRecord[];
  proofs: readonly PlanPosture[];
  now: number;
}
/** Runtime truth per capability: enabled, reached metrics, live proof bound to the current version, graduation. */
export function capabilityRows(capabilities: readonly PreviewCapability[], input: CapabilityInputs): CapabilityRow[] {
  return capabilities.map(capability => {
    const d = capability.declaration, adjectives = input.classify(d.profile), version = input.versions[d.id] ?? 'unknown';
    const enabled = d.status !== 'retired' && input.enabled[capability.enabledBy];
    const proofs = input.liveProofs.filter(row => row.liveProof === d.requiredFacts.liveProof && row.capability === d.id);
    const current = proofs.filter(row => row.version === version).at(-1), stale = proofs.at(-1);
    return { id: d.id, status: d.status, change: capability.change, enabled, version,
      critical: adjectives.critical, significant: adjectives.significant, userFacing: adjectives.userFacing,
      protection: d.status === 'dark' || d.status === 'soaking' ? 'dark' : enabled ? 'enabled' : 'off-in-this-launch',
      metrics: { declared: d.requiredFacts.metrics.length, unreached: enabled ? d.requiredFacts.metrics.filter(path => !metricReached(input.status, path)) : [] },
      liveProof: !d.requiredFacts.liveProof ? { state: 'not-required', recordedAt: null, update: null }
        : current ? { state: 'recorded', recordedAt: current.recordedAt, update: current.update }
          : stale ? { state: 'stale-version', recordedAt: stale.recordedAt, update: stale.update } : { state: 'missing', recordedAt: null, update: null },
      graduation: d.requiredFacts.gate ? { deadline: d.requiredFacts.gate.deadline, overdue: input.now >= d.requiredFacts.gate.deadline } : null,
      proofs: input.proofs.filter(row => row.capability === d.id).map(row => ({ plan: row.plan, posture: row.posture })) };
  });
}

/** Plain lines for the operator's status pull: what is proven, what is not, and why. */
export function proofStatusLines(proofs: readonly PlanPosture[], rows: readonly CapabilityRow[]): string[] {
  const required = proofs.filter(row => row.required), healthy = required.filter(row => row.posture === 'healthy');
  const problems = required.filter(row => row.posture !== 'healthy').map(row => `${row.plan} ${row.posture}`);
  const liveMissing = rows.filter(row => row.enabled && row.liveProof.state !== 'recorded' && row.liveProof.state !== 'not-required').length;
  const overdue = rows.filter(row => row.graduation?.overdue).map(row => row.id);
  const dark = rows.filter(row => row.protection === 'dark').map(row => row.id);
  return [
    `Proofs: ${healthy.length}/${required.length} healthy${problems.length ? `; ${problems.join(', ')}` : ''}.`,
    `Capabilities: ${rows.filter(row => row.protection === 'enabled').length} on, ${dark.length} dark${dark.length ? ` (${dark.join(', ')})` : ''}; ${liveMissing} without a live proof at their current version${overdue.length ? `; graduation overdue: ${overdue.join(', ')}` : ''}.`,
  ];
}
