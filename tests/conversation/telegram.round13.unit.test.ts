import { expect, it } from 'vitest';
import { admitTelegramAdapter } from '../../src/conversation/index.js';
import { decodeMeasurement } from '../../src/index.js';
import type { Clock } from '../../src/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';

it('P12-NF-07 P12-NF-46 round13 cold admission requires a Part One-valid complete clock', () => {
  for (const [name, makeClock, ownerKind, admissionKind] of [
    ['valid', (fixture: ReturnType<typeof conversationFixture>) => fixture.intake.f.clock(100), 'Success', 'Success'],
    ['missing-fields', () => ({ value: 100 }), 'Refused', 'Refused'],
    ['wrong-unit', (fixture: ReturnType<typeof conversationFixture>) => ({ ...fixture.intake.f.clock(100), unit: 'bytes' }), 'Refused', 'Refused'],
    ['string-value', (fixture: ReturnType<typeof conversationFixture>) => ({ ...fixture.intake.f.clock(100), value: '100' }), 'Refused', 'Refused'],
    ['expired', (fixture: ReturnType<typeof conversationFixture>) => fixture.intake.f.clock(151), 'Success', 'Refused'],
  ] as const) {
    const fixture = conversationFixture({ skipInitialAdmission: true });
    const clock = makeClock(fixture);
    expect(decodeMeasurement('clock', clock, fixture.intake.f.ctx.decode).kind, `${name}: owner`).toBe(ownerKind);
    const admission = admitTelegramAdapter(fixture.declaration,
      { ...fixture.admissionDependencies, clock: () => clock as unknown as Clock });
    expect(admission.kind, `${name}: admission`).toBe(admissionKind);
    expect(value(fixture.assembly.runtime.inspectCurrent()).filter(row =>
      row.record.type === 'AdapterConformance')).toHaveLength(admissionKind === 'Success' ? 1 : 0);
  }
});
