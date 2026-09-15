import { expect, it } from 'vitest';
import { admitTelegramAdapter } from '../../src/conversation/index.js';
import { decodeMeasurement } from '../../src/index.js';
import type { Clock } from '../../src/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';

it('P12-NF-07 P12-NF-46 round13 readmission decodes clock ownership before freshness or conformance reuse', () => {
  for (const [name, makeClock, expected] of [
    ['valid', (fixture: ReturnType<typeof conversationFixture>) => fixture.intake.f.clock(100), 'Success'],
    ['missing-fields', () => ({ value: 100 }), 'Refused'],
    ['wrong-unit', (fixture: ReturnType<typeof conversationFixture>) => ({ ...fixture.intake.f.clock(100), unit: 'bytes' }), 'Refused'],
    ['string-value', (fixture: ReturnType<typeof conversationFixture>) => ({ ...fixture.intake.f.clock(100), value: '100' }), 'Refused'],
    ['expired', (fixture: ReturnType<typeof conversationFixture>) => fixture.intake.f.clock(151), 'Refused'],
  ] as const) {
    const fixture = conversationFixture();
    const clock = makeClock(fixture);
    const owner = decodeMeasurement('clock', clock, fixture.intake.f.ctx.decode);
    expect(owner.kind, `${name}: owner`).toBe(name === 'valid' || name === 'expired' ? 'Success' : 'Refused');
    const before = value(fixture.assembly.runtime.inspectCurrent()).filter(row =>
      row.record.type === 'AdapterConformance').map(row => row.fact.id);
    const actual = admitTelegramAdapter(fixture.declaration,
      { ...fixture.admissionDependencies, clock: () => clock as unknown as Clock });
    expect(actual.kind, name).toBe(expected);
    expect(value(fixture.assembly.runtime.inspectCurrent()).filter(row =>
      row.record.type === 'AdapterConformance').map(row => row.fact.id), name).toEqual(before);
  }
});
