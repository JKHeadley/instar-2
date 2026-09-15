import { expect, it } from 'vitest';
import { admitTelegramAdapter } from '../../src/conversation/index.js';
import type { TelegramBotApiCustodianPort } from '../../src/conversation/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';

it('P12-NF-07 P12-NF-46 round14 cold admission refuses a probe that expires during identity', () => {
  const fixture = conversationFixture({ skipInitialAdmission: true });
  let now = 100;
  const samples: number[] = [];
  const api: TelegramBotApiCustodianPort = Object.freeze({ ...fixture.api,
    identity(input: Parameters<TelegramBotApiCustodianPort['identity']>[0]) {
      const probe = fixture.api.identity(input);
      now = 150;
      return probe;
    },
  });

  const admission = admitTelegramAdapter(fixture.declaration, { ...fixture.admissionDependencies, api,
    clock: () => { samples.push(now); return fixture.intake.f.clock(now); },
  });

  expect(admission.kind).toBe('Refused');
  expect(samples).toEqual([150]);
  expect(value(fixture.assembly.runtime.inspectCurrent()).filter(row =>
    row.record.type === 'AdapterConformance')).toHaveLength(0);
});
