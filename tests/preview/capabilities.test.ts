// Build 9: the preview's register inputs (preview.declarations.json) generate through the register, join to the
// runner's plans with every gap kept, and bind live proofs to actual outcomes (Rules 34, 39, 43, 62, 72, 73, 76).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { deriveProfile, decode } from '../../src/index.js';
import type { ProfileTermsReadPort } from '../../src/index.js';
import { generateRegister } from '../../src/register/index.js';
import { setup, shapeInput, value } from '../register/fixtures.js';
import { PREVIEW_CAPABILITY_META, RUNTIME_UNAVAILABLE, STEP_CHECK_GRADUATION_DEADLINE, capabilityFindings, capabilityRows, metricReached,
  outcomesOf, previewInventory, proofStatusLines, resolveLiveProof } from './capabilities.js';
import type { FeatureProfile, LiveProofInput, PreviewDeclaration } from './capabilities.js';
import { PREVIEW_PROOF_PLANS, probeId } from './proofs.js';
import type { PlanPosture, ProofRecord } from './proofs.js';
import type { JournalView, Turn } from './journal.js';

const REGISTERED = JSON.parse(readFileSync('tests/preview/preview.declarations.json', 'utf8')) as PreviewDeclaration[];
const PENDING = JSON.parse(readFileSync('tests/preview/preview.pending-declarations.json', 'utf8')) as PreviewDeclaration[];
const DECLARATIONS = [...REGISTERED, ...PENDING];
const s = setup();
const ids = DECLARATIONS.map(d => d.id);
const register = { ...s.f.ctx.register, entries: [...s.f.ctx.register.entries, ...ids] };
const types = { ...s.f.ctx, register };
const terms = { owner: 'part-three', derivedFrom: shapeInput().derivedFrom } as ProfileTermsReadPort;
const classify = (profile: FeatureProfile) => value(deriveProfile(value(decode('Profile', profile, types)), terms, s.f.ctx.preserved));
const NOW = 1790000000000; // 2026-09-22, before the recorded step-check target
const inventory = previewInventory(REGISTERED, PENDING);
const edit = (id: string, change: (d: PreviewDeclaration) => PreviewDeclaration | null) =>
  previewInventory(DECLARATIONS.flatMap(d => d.id === id ? [change(structuredClone(d))].filter(x => x !== null) : [d]) as PreviewDeclaration[]);
/** The references a regeneration supplies: probes and fixtures (the part-nine owner manifest) and proof records (a provider). */
const referencesOf = (declarations: readonly PreviewDeclaration[]) => declarations.flatMap(d => {
  const facts = d.requiredFacts as Record<string, unknown>, out: { provider: string; id: string; kind?: string }[] = [];
  for (const field of ['probe', 'freshnessProbe']) if (typeof facts[field] === 'string') out.push({ provider: 'probe', id: facts[field] as string });
  if (typeof facts.liveProof === 'string') out.push({ provider: 'record', id: facts.liveProof, kind: 'e2e-run' });
  if (typeof facts.proof === 'string') out.push({ provider: 'record', id: facts.proof, kind: 'observation-proof' });
  const gate = facts.gate as { test: string } | undefined; if (gate) out.push({ provider: 'fixture', id: gate.test });
  for (const agreement of (facts.agreesWith as { check: string }[] | undefined) ?? []) out.push({ provider: 'fixture', id: agreement.check });
  return out;
});

describe('the preview inventory is register input', () => {
  it('the collected file generates with probe and fixture references alone; the pending file needs record references', () => {
    const withRefs = (refs: ReturnType<typeof referencesOf>) => ({ ...s.context, types, register, references: [...(s.context.references ?? []), ...refs] });
    expect(referencesOf(REGISTERED).every(r => r.provider === 'probe' || r.provider === 'fixture')).toBe(true);
    const generated = value(generateRegister(s.input(REGISTERED), withRefs(referencesOf(REGISTERED))));
    expect(generated.entries.map(e => e.declaration.id).sort()).toEqual(REGISTERED.map(d => d.id).sort());
    // Every pending declaration names a record reference; with the records supplied, the whole inventory generates.
    for (const d of PENDING) expect(referencesOf([d]).some(r => r.provider === 'record'), d.id).toBe(true);
    expect(value(generateRegister(s.input(DECLARATIONS), withRefs(referencesOf(DECLARATIONS)))).entries).toHaveLength(ids.length);
    // Without those records the register refuses rather than guessing.
    expect(generateRegister(s.input(DECLARATIONS), withRefs(referencesOf(REGISTERED))).kind).toBe('Refused');
    expect(inventory.pending.sort()).toEqual(PENDING.map(d => d.id).sort());
  });
  it('every declaration joins: no gap, every plan declared, every critical feature has its outcomes', () => {
    expect(inventory.gaps).toEqual([]);
    expect(capabilityFindings(inventory, classify, NOW)).toEqual([]);
    const critical = inventory.capabilities.filter(c => classify(c.declaration.profile).critical).map(c => c.declaration.id);
    expect(critical.sort()).toEqual(['preview.durable-intake', 'preview.held-reply-notice', 'preview.reminders', 'preview.reply',
      'preview.reply-review', 'preview.requested-summaries', 'preview.spend-cap', 'preview.status-pull', 'preview.stop']);
    for (const id of critical) expect(outcomesOf(inventory, id).length, id).toBeGreaterThan(0);
    for (const plan of PREVIEW_PROOF_PLANS) expect(inventory.outcomes.some(o => o.requiredFacts.probe === probeId(plan.id))
      || inventory.sentinels.some(o => o.requiredFacts.freshnessProbe === probeId(plan.id)), plan.id).toBe(true);
  });
  it('a missing join stays visible as a gap or finding, never silently dropped', () => {
    const noOutcome = DECLARATIONS.filter(d => !d.id.startsWith('preview.reminders.'));
    expect(capabilityFindings(previewInventory(noOutcome), classify, NOW).join('\n'))
      .toMatch(/preview\.reminders: Rule 43 — a critical capability declares the outcomes/u);
    expect(edit('preview.reply.delivered', d => ({ ...d, requiredFacts: { probe: 'P9-PREVIEW-nothing', cadence: 1 } }) as PreviewDeclaration).gaps.join('\n'))
      .toMatch(/probe P9-PREVIEW-nothing has no runner plan/u);
    expect(edit('preview.duty.every-reply-reviewed', d => ({ ...d, requiredFacts: { ...d.requiredFacts, watcher: 'nobody' } }) as PreviewDeclaration).gaps.join('\n'))
      .toMatch(/watcher nobody is not a declared sentinel/u);
    expect(edit('preview.proofs', () => null).gaps.join('\n')).toMatch(/preview\.proofs: runner facts name an undeclared feature/u);
    expect(edit('preview.sentinel.summary-review', () => null).gaps.join('\n')).toMatch(/summary-checked: runner plan is not declared/u);
  });
  it('each finding fails on its counter-case', () => {
    const cases: [string, (d: PreviewDeclaration) => PreviewDeclaration, RegExp][] = [
      ['preview.reply', d => { const { liveProof: _drop, ...facts } = d.requiredFacts as Record<string, unknown>; return { ...d, requiredFacts: facts } as PreviewDeclaration; }, /Rule 62/u],
      ['preview.step-check', d => { const { gate: _drop, ...facts } = d.requiredFacts as Record<string, unknown>; return { ...d, requiredFacts: facts } as PreviewDeclaration; }, /Rule 72 — a dark capability needs/u],
      ['preview.stop', d => ({ ...d, requiredFacts: { ...d.requiredFacts, metrics: [] } }) as PreviewDeclaration, /Rule 39/u],
      ['preview.held-reply-notice', d => ({ ...d, status: 'dark', requiredFacts: { ...d.requiredFacts, gate: { test: 'x', deadline: NOW + 1 } } }) as PreviewDeclaration, /Rule 76 — a user-facing repair cannot be dark/u],
    ];
    for (const [id, change, finding] of cases) expect(capabilityFindings(edit(id, change), classify, NOW).join('\n')).toMatch(finding);
    const noIntegration = previewInventory(DECLARATIONS);
    noIntegration.capabilities.find(c => c.declaration.id === 'preview.reply')!.evidence = { unit: ['tests/preview/journal.test.ts'], integration: [], procedure: null };
    expect(capabilityFindings(noIntegration, classify, NOW).join('\n')).toMatch(/Rule 34 — significant capability without integration evidence/u);
    const documentTier = previewInventory(DECLARATIONS);
    documentTier.capabilities.find(c => c.declaration.id === 'preview.reply')!.evidence.unit = ['tests/preview/core-journey-live-test.md'];
    expect(capabilityFindings(documentTier, classify, NOW).join('\n')).toMatch(/Rule 34 — evidence tiers name executed tests/u);
    expect(capabilityFindings(inventory, classify, STEP_CHECK_GRADUATION_DEADLINE).join('\n')).toMatch(/preview\.step-check: Rule 72 — graduation overdue/u);
  });
  it('enforces graduation deadlines against the real clock (Rule 72: an overdue dark capability fails the build)', () => {
    expect(capabilityFindings(inventory, classify, Date.now()).join("|")).toBe("");
    expect(new Date(STEP_CHECK_GRADUATION_DEADLINE).toISOString()).toBe('2026-09-30T00:00:00.000Z');
    expect(readFileSync('tests/preview/README.md', 'utf8')).toContain("observation's evaluation target is 2026-09-30");
  });
  it('names real sources and executed tests; a procedure is a document, never evidence', () => {
    for (const [id, meta] of Object.entries(PREVIEW_CAPABILITY_META)) {
      for (const path of [...meta.sources, ...meta.evidence.unit, ...meta.evidence.integration]) expect(existsSync(path), `${id}: ${path}`).toBe(true);
      if (meta.evidence.procedure) expect(meta.evidence.procedure).toMatch(/\.md$/u);
    }
  });
});

const turn = (update: number, fields: Partial<Turn>): Turn => ({ id: `u${update}`, update, text: 'what is the plan', raw: '', accepted: true,
  at: NOW, reserved: false, answer: 'Here.', intent: 'PREVIEW — Here.', ...fields });
const view = (order: Turn[], fields: Partial<JournalView> = {}) => ({ order, turns: new Map(order.map(t => [t.id, t])), memory: [], reminders: new Map(),
  awayEvents: [], calls: 0, replies: 0, limits: { maxCalls: 50, maxReplies: 50 }, cursor: order.at(-1)?.update ?? 0, ...fields }) as unknown as JournalView;
const startup = (at: number, options: { stepCheck?: boolean; agentState?: boolean; version?: string } = {}): ProofRecord => ({ v: 1, plan: 'startup',
  planVersion: 'p', generation: `g${at}`, startedAt: at, completedAt: at, disposition: 'passed', detail: '', observedAt: at, capture: null,
  observed: { stepCheck: options.stepCheck ?? false, agentState: options.agentState ?? false,
    ...Object.fromEntries(Object.keys(PREVIEW_CAPABILITY_META).map(id => [`version:${id}`, options.version ?? 'v1'])) } });
const capability = (id: string) => inventory.capabilities.find(c => c.declaration.id === id)!;
const proof = (id: string, update: number, v: JournalView, extra: Partial<LiveProofInput> = {}) => resolveLiveProof({ capability: capability(id), view: v,
  update, deskObservation: null, stopLatch: null, launches: [{ at: NOW - 10 }], startups: [startup(NOW - 20)], now: NOW + 100, ...extra });

describe('a live proof binds the capability to its own actual outcome in the launch that executed it (Rule 62)', () => {
  const question = turn(1, { sent: 11, sentAt: NOW });
  const status = turn(2, { text: 'status', sent: 12, sentAt: NOW + 1 });
  it('accepts the capability’s own outcome, bound to the executing launch’s version', () => {
    const result = proof('preview.reply', 1, view([question, status]));
    expect(result).toMatchObject({ ok: true, record: { capability: 'preview.reply', version: 'v1', generation: `g${NOW - 20}`, update: 1, messageId: 11, fact: 'outcome-observed' } });
    expect(proof('preview.status-pull', 2, view([question, status]))).toMatchObject({ ok: true, record: { messageId: 12 } });
  });
  it('refuses an unrelated turn: an ordinary question is not a status pull, a reminder or a reply review; status is not a reply', () => {
    const v = view([question, status]);
    expect(proof('preview.reply', 2, v)).toMatchObject({ ok: false });
    expect(proof('preview.status-pull', 1, v)).toMatchObject({ ok: false });
    expect(proof('preview.reminders', 1, v)).toMatchObject({ ok: false });
    expect(proof('preview.reply-review', 1, v)).toMatchObject({ ok: false });
    expect(proof('preview.held-reply-notice', 1, v)).toMatchObject({ ok: false });
  });
  it('refuses a capability the executing launch had off, and a semantic capability without the desk’s observation', () => {
    expect(proof('preview.channel-memory', 1, view([question]), { deskObservation: 'arrival checked' })).toMatchObject({ ok: false, reason: expect.stringMatching(/had preview\.channel-memory off/u) });
    expect(proof('preview.channel-memory', 1, view([question]), { deskObservation: 'arrival checked', startups: [startup(NOW - 20, { agentState: true })] }))
      .toMatchObject({ ok: true, record: { fact: 'desk-observed', deskObservation: 'arrival checked' } });
    expect(proof('preview.memory', 1, view([question]))).toMatchObject({ ok: false, reason: expect.stringMatching(/desk-recorded semantic observation/u) });
  });
  it('refuses an outcome with no launch or no startup record, and binds an old outcome to its own old version', () => {
    expect(proof('preview.reply', 1, view([question]), { launches: [] })).toMatchObject({ ok: false });
    expect(proof('preview.reply', 1, view([question]), { startups: [] })).toMatchObject({ ok: false, reason: expect.stringMatching(/no startup proof/u) });
    // Two launches: the reply was sent in the first, so the proof carries the first launch's version, not the newest.
    const launches = [{ at: NOW - 10, exit: NOW + 5 }, { at: NOW + 50 }];
    const result = proof('preview.reply', 1, view([question]), { launches, startups: [startup(NOW - 20, { version: 'old' }), startup(NOW + 40, { version: 'new' })] });
    expect(result).toMatchObject({ ok: true, record: { version: 'old' } });
  });
  it('reminders, requested summaries and cap holds need their own outcomes', () => {
    const asked = turn(3, { text: 'remind me at 5 to call Sam' });
    const reminders = new Map([['r', { items: [{ source: 'u3', quote: 'call Sam', when: '17:00' }], text: 'x', day: '2026-09-22', at: NOW, sent: 21, sentAt: NOW + 2 }]]);
    expect(proof('preview.reminders', 3, view([asked], { reminders } as Partial<JournalView>))).toMatchObject({ ok: true, record: { messageId: 21, observedAt: NOW + 2 } });
    const { answer: _answer, intent: _intent, ...held } = turn(4, {}) as Turn & { answer?: string; intent?: string };
    expect(proof('preview.spend-cap', 4, view([held]))).toMatchObject({ ok: false });
    expect(proof('preview.spend-cap', 4, view([held], { awayEvents: [{ kind: 'hold', at: NOW + 3, id: 'u4', reason: 'call cap' }] } as Partial<JournalView>)))
      .toMatchObject({ ok: true, record: { messageId: null } });
  });
});

describe('capability rows count only enabled, currently proven protection', () => {
  const versions = Object.fromEntries(inventory.capabilities.map(c => [c.declaration.id, `v:${c.declaration.id}`]));
  const posture = (plan: string, value: string): PlanPosture => ({ plan, kind: 'critical-outcome', capability: '', rules: [], required: true,
    posture: value as PlanPosture['posture'], undecodable: 0, last: null, lastSuccessAt: value === 'healthy' ? NOW : null, dueAt: 0, overdueBy: 0 });
  const base = { classify, versions, enabled: { default: true, 'option:step-check': false, 'option:agent-state-dir': false } as const,
    status: { replies: 0, calls: 0, replyTimings: {}, lastReplyTiming: null, callOutcomeCounts: {} }, liveProofs: [], proofs: [], now: NOW };
  it('confirmed needs every declared outcome healthy; a stop is confirmed only by its current live proof', () => {
    const healthy = PREVIEW_PROOF_PLANS.map(p => posture(p.id, 'healthy'));
    const rows = new Map(capabilityRows(inventory, { ...base, proofs: healthy }).map(r => [r.id, r]));
    expect(rows.get('preview.reply')!.protection).toBe('confirmed');
    expect(rows.get('preview.stop')).toMatchObject({ protection: 'unconfirmed', outcomes: [{ posture: 'unavailable', owner: RUNTIME_UNAVAILABLE[probeId('stop-honored')] }] });
    const stopProof = { v: 1 as const, liveProof: 'live-proof:preview.stop', capability: 'preview.stop', version: 'v:preview.stop', generation: 'g',
      fact: 'outcome-observed' as const, update: 1, messageId: null, observedAt: NOW, recordedAt: NOW, deskObservation: null };
    expect(capabilityRows(inventory, { ...base, proofs: healthy, liveProofs: [stopProof] }).find(r => r.id === 'preview.stop')!.protection).toBe('confirmed');
    const degraded = new Map(capabilityRows(inventory, { ...base, proofs: healthy.map(p => p.plan === 'reply-delivered' ? posture(p.plan, 'unknown') : p) }).map(r => [r.id, r]));
    expect(degraded.get('preview.reply')!.protection).toBe('unconfirmed');
    expect(degraded.get('preview.step-check')).toMatchObject({ protection: 'dark', graduation: { overdue: false, stages: { 'development-agent': 'missing', fleet: 'unavailable' } } });
    expect(degraded.get('preview.channel-memory')!.protection).toBe('off-in-this-launch');
    expect(degraded.get('preview.memory')!.protection).toBe('unproven');
    const lines = proofStatusLines(healthy, [...degraded.values()]);
    expect(lines[1]).toMatch(/confirmed, \d+ unconfirmed, 1 dark \(preview\.step-check\)/u);
  });
  it('reports unreached metrics and live proof state by version', () => {
    const rows = new Map(capabilityRows(inventory, { ...base, liveProofs: [
      { v: 1, liveProof: 'live-proof:preview.reply', capability: 'preview.reply', version: 'v:preview.reply', generation: 'g', fact: 'outcome-observed', update: 4, messageId: 9, observedAt: NOW, recordedAt: NOW, deskObservation: null },
      { v: 1, liveProof: 'live-proof:preview.memory', capability: 'preview.memory', version: 'old', generation: 'g', fact: 'desk-observed', update: 5, messageId: 10, observedAt: NOW, recordedAt: NOW, deskObservation: 'x' }] }).map(r => [r.id, r]));
    expect(rows.get('preview.reply')).toMatchObject({ metrics: { unreached: [] }, liveProof: { state: 'recorded', update: 4 } });
    expect(rows.get('preview.memory')!.liveProof.state).toBe('stale-version');
    expect(rows.get('preview.obligations')!.liveProof.state).toBe('missing');
    expect(rows.get('preview.rolling-summary')!.liveProof.state).toBe('not-required');
    expect(rows.get('preview.stop')!.metrics.unreached).toEqual(['stop']);
    expect(metricReached({ a: { b: 0 } }, 'a.b')).toBe(true);
    expect(metricReached({ a: { b: 0 } }, 'a.c')).toBe(false);
  });
});
