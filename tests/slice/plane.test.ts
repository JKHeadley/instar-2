import { it, expect } from 'vitest';
import { minimalPlaneProjectionIds, minimalPlaneProjections } from './plane-fixture.js';

const KINDS = ['intake-receipt', 'intake-resolved', 'intake-admitted', 'intake-held', 'intake-expired', 'intake-collapse',
  'intake-mismatch', 'intake-stop', 'intake-stop-signal', 'conversation-binding', 'genesis-grant', 'slice-context-evidence',
  'slice-accountable-owner', 'slice-placement', 'slice-reply-source', 'slice-delivery-evidence', 'slice-obligation',
  'transport-Lease', 'transport-AdmissionReservation', 'transport-LoopRecord', 'transport-RecoveryRecord',
  'judgment-JudgmentRequest', 'judgment-JudgmentAttemptRecord', 'judgment-JudgmentResolution',
  'effect-OperationDefinition', 'effect-OutboundMessage', 'effect-EffectRequest', 'effect-EffectValidation',
  'effect-OperationObservation', 'effect-EffectSettlement', 'run-opening', 'run-transition', 'session-grounding'];

it('P11-NF-24 every minimal-plane projection declares every admitted fact kind as consumed or ignored', () => {
  const projections = minimalPlaneProjections(KINDS);
  expect(projections.map(p => p.id)).toEqual([...minimalPlaneProjectionIds]);
  expect(projections).toHaveLength(6);
  for (const projection of projections) {
    expect(Object.keys(projection.decisions).sort()).toEqual([...KINDS].sort());
    for (const [kind, decision] of Object.entries(projection.decisions)) {
      if (decision.kind === 'ignores') expect(decision.reason.trim().length, `${projection.id}:${kind}`).toBeGreaterThan(0);
      else { expect(decision.identity.length).toBeGreaterThan(0); expect(decision.value.length).toBeGreaterThan(0); }
    }
  }
});

it('P11-NF-26 no minimal-plane projection is authority-answering', () => {
  for (const projection of minimalPlaneProjections(KINDS)) {
    expect(projection.class).toBe('informational');
    expect(projection.retention).toBe('all-identities');
    expect(Number.isFinite(projection.stalenessBound) && projection.stalenessBound > 0).toBe(true);
  }
});

it('P11-NF-25 a kind whose identity lives under an owner record is ignored with that exact reason', () => {
  const outbound = minimalPlaneProjections(KINDS).find(p => p.id === 'minimal.outbound-obligation')!;
  const nested = outbound.decisions['effect-EffectSettlement']!;
  expect(nested.kind).toBe('ignores');
  if (nested.kind === 'ignores') expect(nested.reason).toContain('top-level body fields');
  const folded = outbound.decisions['slice-obligation']!;
  expect(folded.kind).toBe('folds');
  if (folded.kind === 'folds') { expect(folded.merge).toBe('exclusive-singleton'); expect(folded.identity).toBe('operation'); }
});

it('P11-NF-24 a projection built for a different kind set still covers exactly that set', () => {
  const projections = minimalPlaneProjections(['intake-admitted', 'slice-obligation']);
  for (const projection of projections) expect(Object.keys(projection.decisions)).toHaveLength(2);
});
