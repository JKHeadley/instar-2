import { admitTelegramAdapter } from '../../src/conversation/index.js';
import type {
  AdmittedTelegramAdapter, TelegramBotApiCustodianPort, TelegramBotDeclaration,
} from '../../src/conversation/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';

export function round15Declarations() {
  const fixture = conversationFixture({ mode: 'webhook', skipInitialAdmission: true });
  const longPoll = { ...fixture.declaration } as TelegramBotDeclaration & { recordedEndpointChoice?: unknown };
  delete longPoll.recordedEndpointChoice;
  return {
    fixture,
    declarations: {
      webhook: fixture.declaration,
      'long-poll': longPoll as TelegramBotDeclaration,
    },
  };
}

export function captureReadOverlap(outerMode: 'long-poll' | 'webhook') {
  const { fixture, declarations } = round15Declarations();
  const otherMode = outerMode === 'webhook' ? 'long-poll' : 'webhook';
  let nested: ReturnType<typeof admitTelegramAdapter> | undefined;
  let yielded = false;
  const trace: string[] = [];
  const api: TelegramBotApiCustodianPort = Object.freeze({ ...fixture.api,
    readCapture(reference: string) {
      trace.push('identity-capture-read:begin');
      const captured = fixture.api.readCapture(reference);
      if (!yielded) {
        yielded = true;
        trace.push('competing-admission:begin');
        nested = admitTelegramAdapter(declarations[otherMode], fixture.admissionDependencies);
        trace.push(`competing-admission:${nested.kind}`);
      }
      trace.push('identity-capture-read:return');
      return captured;
    },
  });
  const outer = admitTelegramAdapter(declarations[outerMode], { ...fixture.admissionDependencies, api });
  const records = value(fixture.assembly.runtime.inspectCurrent()).filter(row =>
    row.record.type === 'AdapterConformance' && row.record.adapter === 'telegram:v1:bot:9001');
  const successes = [outer, nested].filter((result): result is Extract<NonNullable<typeof result>, { kind: 'Success' }> =>
    result?.kind === 'Success');
  return {
    fixture, api, outer, nested, records, trace,
    admitted: successes[0]?.value as AdmittedTelegramAdapter | undefined,
  };
}
