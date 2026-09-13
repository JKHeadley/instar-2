import { expect, it } from 'vitest';
import { admitTelegramAdapter } from '../../src/conversation/index.js';
import type { TelegramBotApiCustodianPort, TelegramBotDeclaration } from '../../src/conversation/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';

function declarationsForBothModes() {
  const fixture = conversationFixture({ mode: 'webhook', skipInitialAdmission: true });
  const longPoll = { ...fixture.declaration } as TelegramBotDeclaration & { recordedEndpointChoice?: unknown };
  delete longPoll.recordedEndpointChoice;
  return { fixture, declarations: { webhook: fixture.declaration, 'long-poll': longPoll as TelegramBotDeclaration } };
}

it('P12-NF-16 P12-NF-18 P12-NF-46 round13 pins the committing conformance view across overlapping mode admissions', () => {
  for (const outerMode of ['long-poll', 'webhook'] as const) for (const overlap of [false, true]) {
    const { fixture, declarations } = declarationsForBothModes();
    const otherMode = outerMode === 'webhook' ? 'long-poll' : 'webhook';
    let nested: ReturnType<typeof admitTelegramAdapter> | undefined;
    let once = false;
    const api: TelegramBotApiCustodianPort = Object.freeze({ ...fixture.api,
      identity(input: Parameters<TelegramBotApiCustodianPort['identity']>[0]) {
        const matched = fixture.api.identity(input);
        if (overlap && !once) {
          once = true;
          nested = admitTelegramAdapter(declarations[otherMode], { ...fixture.admissionDependencies, api });
        }
        return matched;
      },
    });
    const outer = admitTelegramAdapter(declarations[outerMode], { ...fixture.admissionDependencies, api });
    if (!overlap) nested = admitTelegramAdapter(declarations[otherMode], { ...fixture.admissionDependencies, api });

    expect(outer.kind, `${outerMode}/${overlap}: outer`).toBe('Success');
    expect(nested?.kind, `${outerMode}/${overlap}: nested`).toBe('Refused');
    const records = value(fixture.assembly.runtime.inspectCurrent()).filter(row =>
      row.record.type === 'AdapterConformance' && row.record.adapter === 'telegram:v1:bot:9001');
    expect(new Set(records.map(row => row.record.type === 'AdapterConformance' ? row.record.mode : '')).size,
      `${outerMode}/${overlap}: admitted modes`).toBe(1);
    expect(records.every(row => row.taint.length === 0 && row.conflicts.length === 0),
      `${outerMode}/${overlap}: current records`).toBe(true);
  }
});
