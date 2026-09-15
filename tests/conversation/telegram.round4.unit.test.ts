import { expect, it } from 'vitest';
import { admitTelegramAdapter, extractTelegramUpdate } from '../../src/conversation/index.js';
import type { TelegramBotDeclaration } from '../../src/conversation/index.js';
import { conversationFixture } from './fixture.js';
import { telegramUpdate } from './round3-fixture.js';

it('P12-NF-04 P12-NF-18 P12-NF-46 round4 cold admission refuses incomplete or inconsistent declarations', () => {
  const cases: readonly Readonly<{
    name: string;
    mutate: (declaration: TelegramBotDeclaration, evidence: Record<string, unknown>) => void;
    detail: string;
  }>[] = [
    {
      name: 'unknown intake mode',
      mutate: declaration => { (declaration as any).recordedEndpointChoice = {
        mode: 'webhok', signedChoice: { owner: 'part-two', name: 'FactEnvelope', id: 'absent' },
        endpointAvailabilityEvidence: [], captureBeforeResponseEvidence: [],
      }; },
      detail: 'intake mode',
    },
    {
      name: 'missing cursor contract',
      mutate: declaration => { delete (declaration.cursor as any).contractVersion; },
      detail: 'cursor contract',
    },
    {
      name: 'empty cursor contract',
      mutate: declaration => { (declaration.cursor as any).contractVersion = ''; },
      detail: 'cursor contract',
    },
    {
      name: 'wrong parser declaration',
      mutate: (_declaration, evidence) => { evidence.parserDeclaration = 'other-parser'; },
      detail: 'parser declaration',
    },
  ];

  for (const testCase of cases) {
    const f = conversationFixture({ skipInitialAdmission: true });
    const declaration = structuredClone(f.declaration);
    const evidence = structuredClone(f.admissionDependencies.evidence) as unknown as Record<string, unknown>;
    testCase.mutate(declaration, evidence);
    const result = admitTelegramAdapter(declaration, { ...f.admissionDependencies,
      evidence: evidence as unknown as typeof f.admissionDependencies.evidence });
    expect(result.kind, testCase.name).toBe('Refused');
    if (result.kind === 'Refused') expect(result.detail, testCase.name).toContain(testCase.detail);
  }
});

it('P12-NF-07 P12-NF-08 P12-NF-17 round4 missing sender type evidence stays unresolved', () => {
  const f = conversationFixture();
  const raw = telegramUpdate(100, update => { delete update.message.from.is_bot; });
  expect(() => extractTelegramUpdate(raw, f.declaration)).toThrow('boolean is_bot');
});

it('P12-NF-07 P12-NF-08 P12-NF-17 round4 invalid sender type evidence stays unresolved', () => {
  const f = conversationFixture();
  const raw = telegramUpdate(100, update => { update.message.from.is_bot = 'true'; });
  expect(() => extractTelegramUpdate(raw, f.declaration)).toThrow('boolean is_bot');
});

it('P12-NF-16 P12-NF-17 round4 known plus unknown routed update variants refuse before route selection', () => {
  const f = conversationFixture();
  const raw = telegramUpdate(100, update => { update.chat_boost = {
    chat: { id: -999, type: 'supergroup' }, boost: { boost_id: 'other' },
  }; });
  expect(() => extractTelegramUpdate(raw, f.declaration)).toThrow('exactly one routed variant');
});
