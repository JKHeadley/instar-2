// Build 9: the preview's shipped capabilities are declared in the register's feature vocabulary and held to its
// invariants, graduation deadlines and Rules 34/62/76 (Rules 34, 39, 62, 72, 73, 76).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { deriveProfile, decode } from '../../src/index.js';
import type { ProfileTermsReadPort } from '../../src/index.js';
import { decodeDeclaration } from '../../src/register/index.js';
import { setup, shapeInput, value } from '../register/fixtures.js';
import { PREVIEW_CAPABILITIES, STEP_CHECK_GRADUATION_DEADLINE, capabilityFindings, capabilityRows, metricReached, proofStatusLines } from './capabilities.js';
import type { FeatureProfile, PreviewCapability } from './capabilities.js';
import { PREVIEW_PROOF_PLANS } from './proofs.js';

const s = setup();
// The preview's declarations are register entries of their own set: a bound names the declaration that holds it.
const ids = PREVIEW_CAPABILITIES.map(c => c.declaration.id);
const register = { ...s.f.ctx.register, entries: [...s.f.ctx.register.entries, ...ids] };
const types = { ...s.f.ctx, register };
const terms = { owner: 'part-three', derivedFrom: shapeInput().derivedFrom } as ProfileTermsReadPort;
const classify = (profile: FeatureProfile) => value(deriveProfile(value(decode('Profile', profile, types)), terms, s.f.ctx.preserved));
const NOW = 1790000000000; // 2026-09-22, before the recorded step-check target
const variant = (id: string, change: (c: PreviewCapability) => PreviewCapability) =>
  PREVIEW_CAPABILITIES.map(c => c.declaration.id === id ? change(structuredClone(c) as PreviewCapability) : c);

describe('preview capabilities in the register feature vocabulary', () => {
  it('every declaration decodes through the register decoder, feature invariants included', () => {
    for (const capability of PREVIEW_CAPABILITIES) {
      const context = { ...s.context, types, register, source: { path: 'tests/preview/capabilities.ts', symbol: capability.declaration.id } };
      expect(() => value(decodeDeclaration(capability.declaration, context)), capability.declaration.id).not.toThrow();
    }
  });
  it('the declared set passes every finding today, and each finding fails on its counter-case', () => {
    expect(capabilityFindings(PREVIEW_CAPABILITIES, classify, NOW)).toEqual([]);
    const cases: [string, (c: PreviewCapability) => PreviewCapability, RegExp][] = [
      ['preview.held-reply-notice', c => ({ ...c, declaration: { ...c.declaration, status: 'dark', requiredFacts: { ...c.declaration.requiredFacts, gate: { test: 'x', deadline: NOW + 1 } } } }), /Rule 76 — a user-facing repair cannot be dark/u],
      ['preview.held-reply-notice', c => ({ ...c, enabledBy: 'option:step-check' }), /Rule 76 — a user-facing repair ships on by default/u],
      ['preview.reply', c => ({ ...c, evidence: { ...c.evidence, integration: [] } }), /Rule 34 — significant capability without integration evidence/u],
      ['preview.reply', c => ({ ...c, evidence: { ...c.evidence, unit: ['tests/preview/core-journey-live-test.md'] } }), /Rule 34 — evidence tiers name executed tests/u],
      ['preview.reply', c => { const { liveProof: _drop, ...facts } = c.declaration.requiredFacts; return { ...c, declaration: { ...c.declaration, requiredFacts: facts } }; }, /Rule 62/u],
      ['preview.step-check', c => { const { gate: _drop, ...facts } = c.declaration.requiredFacts; return { ...c, declaration: { ...c.declaration, requiredFacts: facts } }; }, /Rule 72 — a dark capability needs/u],
      ['preview.stop', c => ({ ...c, declaration: { ...c.declaration, requiredFacts: { ...c.declaration.requiredFacts, metrics: [] } } }), /Rule 39/u],
    ];
    for (const [id, change, finding] of cases) expect(capabilityFindings(variant(id, change), classify, NOW).join('\n')).toMatch(finding);
    expect(capabilityFindings(PREVIEW_CAPABILITIES, classify, STEP_CHECK_GRADUATION_DEADLINE).join('\n'))
      .toMatch(/preview\.step-check: Rule 72 — graduation overdue/u);
  });
  it('enforces graduation deadlines against the real clock (Rule 72: an overdue dark capability fails the build)', () => {
    expect(capabilityFindings(PREVIEW_CAPABILITIES, classify, Date.now())).toEqual([]);
  });
  it('the recorded step-check evaluation target is the deadline the check consumes (Rule 73)', () => {
    expect(readFileSync('tests/preview/README.md', 'utf8')).toContain("observation's evaluation target is 2026-09-30");
    expect(new Date(STEP_CHECK_GRADUATION_DEADLINE).toISOString()).toBe('2026-09-30T00:00:00.000Z');
  });
  it('names real sources and executed tests; a procedure is a document, never evidence', () => {
    for (const capability of PREVIEW_CAPABILITIES) {
      for (const path of [...capability.sources, ...capability.evidence.unit, ...capability.evidence.integration])
        expect(existsSync(path), `${capability.declaration.id}: ${path}`).toBe(true);
      if (capability.evidence.procedure) expect(capability.evidence.procedure).toMatch(/\.md$/u);
    }
    for (const plan of PREVIEW_PROOF_PLANS) expect(PREVIEW_CAPABILITIES.some(c => c.declaration.id === plan.capability), plan.id).toBe(true);
  });
  it('classifies through the purpose-aligned shape: sends are critical, the dark observer is ordinary', () => {
    const byId = new Map(PREVIEW_CAPABILITIES.map(c => [c.declaration.id, classify(c.declaration.profile)]));
    expect(byId.get('preview.reply')).toMatchObject({ critical: true, significant: true, userFacing: true });
    expect(byId.get('preview.held-reply-notice')).toMatchObject({ critical: true, irreversible: true });
    expect(byId.get('preview.step-check')).toMatchObject({ critical: false, significant: false });
  });
});

describe('capability rows count only enabled, reached protection and current-version live proof', () => {
  const versions = Object.fromEntries(PREVIEW_CAPABILITIES.map(c => [c.declaration.id, `v:${c.declaration.id}`]));
  const base = { classify, versions, enabled: { default: true, 'option:step-check': false, 'option:agent-state-dir': false } as const,
    status: { replies: 0, calls: 0, replyTimings: {}, lastReplyTiming: null, callOutcomeCounts: {} }, liveProofs: [], proofs: [], now: NOW };
  it('reports unreached metrics, dark and off capabilities, and live proof state by version', () => {
    const rows = new Map(capabilityRows(PREVIEW_CAPABILITIES, { ...base, liveProofs: [
      { v: 1, liveProof: 'live-proof:preview.reply', capability: 'preview.reply', version: 'v:preview.reply', fact: 'reply-accepted', update: 4, messageId: 9, recordedAt: NOW },
      { v: 1, liveProof: 'live-proof:preview.memory', capability: 'preview.memory', version: 'old', fact: 'reply-accepted', update: 5, messageId: 10, recordedAt: NOW }] }).map(r => [r.id, r]));
    expect(rows.get('preview.reply')).toMatchObject({ protection: 'enabled', metrics: { unreached: [] }, liveProof: { state: 'recorded', update: 4 } });
    expect(rows.get('preview.memory')!.liveProof.state).toBe('stale-version');
    expect(rows.get('preview.obligations')!.liveProof.state).toBe('missing');
    expect(rows.get('preview.rolling-summary')!.liveProof.state).toBe('not-required');
    expect(rows.get('preview.stop')!.metrics.unreached).toEqual(['stop']);
    expect(rows.get('preview.step-check')).toMatchObject({ protection: 'dark', enabled: false, graduation: { overdue: false } });
    expect(rows.get('preview.channel-memory')).toMatchObject({ protection: 'off-in-this-launch', metrics: { unreached: [] } });
    const lines = proofStatusLines([], [...rows.values()]);
    expect(lines[1]).toMatch(/1 dark \(preview\.step-check\)/u);
    expect(metricReached({ a: { b: 0 } }, 'a.b')).toBe(true);
    expect(metricReached({ a: { b: 0 } }, 'a.c')).toBe(false);
  });
});
