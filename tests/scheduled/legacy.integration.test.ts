import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { importLegacyScheduledJob } from '../../src/scheduled/index.js';
import { scheduledFixture, value } from './fixture.js';

const source = (overrides: Record<string, unknown> = {}) => JSON.stringify({ slug: 'maintenance', executionMode: 'model-session',
  livingSkills: { enabled: true }, serverComposition: 'default-with-integration-gate', perMachineIndependent: false,
  machineLocalEffects: false, ...overrides });

describe('Part Fifteen 1.x one-way compatibility policy import', () => {
  it('P15-NF-51 preserves input bytes, defaults an omitted model, and distinguishes script and model learning', () => {
    const context = scheduledFixture().context;
    const model = value(importLegacyScheduledJob(source(), context));
    expect(model.model).toBe('sonnet'); expect(model.postCompletionLearning).toBe('required'); expect(model.activation).toBe('eligible');
    expect(model.sourceBytes).toBe(source());
    const supplied = value(importLegacyScheduledJob(source({ model: 'opus' }), context)); expect(supplied.model).toBe('opus');
    const script = value(importLegacyScheduledJob(source({ executionMode: 'script' }), context)); expect(script.postCompletionLearning).toBe('off');
    const optedOut = value(importLegacyScheduledJob(source({ integrationGate: false }), context)); expect(optedOut.postCompletionLearning).toBe('off');
  });

  it('P15-NF-51 inhibits optional no-gate residue and unsafe every-machine conversion', () => {
    const context = scheduledFixture().context;
    const noGate = value(importLegacyScheduledJob(source({ serverComposition: 'model-session-without-integration-gate' }), context));
    expect(noGate.activation).toBe('inhibited'); expect(noGate.residue).toContain('explicit post-completion learning choice required');
    const unsafe = value(importLegacyScheduledJob(source({ perMachineIndependent: true }), context));
    expect(unsafe.activation).toBe('inhibited'); expect(unsafe.placement).toBe('global-once');
    const safe = value(importLegacyScheduledJob(source({ perMachineIndependent: true, machineLocalEffects: true }), context));
    expect(safe.activation).toBe('eligible'); expect(safe.placement).toBe('every-eligible-machine');
    expect(consumeResult(importLegacyScheduledJob(source({ unknown: true }), context), { Success: () => 'accepted', Refused: () => 'refused' })).toBe('refused');
  });
});
