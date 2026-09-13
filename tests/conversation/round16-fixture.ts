import { admitTelegramAdapter } from '../../src/conversation/index.js';
import type {
  AdmittedTelegramAdapter, TelegramBotApiCustodianPort,
} from '../../src/conversation/index.js';
import type { AssemblyHistoryReadPort, AssemblyRuntimePort } from '../../src/assembly/index.js';
import type { VerificationRuntimePort } from '../../src/verification/index.js';
import { value } from '../intake/fixtures.js';
import { telegramUpdate, wireTelegram } from './round3-fixture.js';
import { round15Declarations } from './round15-fixture.js';

export type AdmissionInterleavingPhase = 'before' | 'after';

export function admissionInterleaving(
  outerMode: 'long-poll' | 'webhook',
  target: number | null,
  phase: AdmissionInterleavingPhase,
) {
  const { fixture, declarations } = round15Declarations();
  const base = fixture.admissionDependencies;
  const otherMode = outerMode === 'webhook' ? 'long-poll' : 'webhook';
  const trace: string[] = [];
  let nested: ReturnType<typeof admitTelegramAdapter> | undefined;
  let fired = false;
  const at = <T>(label: string, operation: () => T): T => {
    const index = trace.length;
    trace.push(label);
    const trigger = () => {
      if (!fired && index === target) {
        fired = true;
        nested = admitTelegramAdapter(declarations[otherMode], base);
      }
    };
    if (phase === 'before') trigger();
    const result = operation();
    if (phase === 'after') trigger();
    return result;
  };
  const api: TelegramBotApiCustodianPort = Object.freeze({ ...base.api,
    identity: (input: Parameters<TelegramBotApiCustodianPort['identity']>[0]) =>
      at('api.identity', () => base.api.identity(input)),
    readCapture: (reference: string) => at('api.readCapture', () => base.api.readCapture(reference)),
  });
  const history: AssemblyHistoryReadPort = Object.freeze({ ...base.history,
    lookup: (reference: string) => at('history.lookup', () => base.history.lookup(reference)),
  });
  const verification: VerificationRuntimePort = Object.freeze({ ...base.verification,
    inspect: () => at('verification.inspect', () => base.verification.inspect()),
  });
  const assembly = Object.freeze({ ...base.assembly,
    inspectCurrent: () => at('assembly.inspectCurrent', () => base.assembly.inspectCurrent()),
    record: ((name: Parameters<AssemblyRuntimePort['record']>[0], input: unknown) =>
      at(`assembly.record:${name}`, () => base.assembly.record(name, input))) as AssemblyRuntimePort['record'],
  });
  const outer = admitTelegramAdapter(declarations[outerMode], { ...base, api, history, verification, assembly,
    clock: () => at('clock', base.clock) });
  const records = value(base.assembly.inspectCurrent()).filter(row =>
    row.record.type === 'AdapterConformance' && row.record.adapter === 'telegram:v1:bot:9001');
  const winner = outer.kind === 'Success' ? outer : nested;
  const winnerMode = winner?.kind === 'Success' ? winner.value.mode : null;
  const readmission = winnerMode === null ? null : admitTelegramAdapter(declarations[winnerMode], base);
  let intakeKind: string | null = null;
  if (winner?.kind === 'Success') {
    const admitted = winner.value as AdmittedTelegramAdapter;
    const admittedApi = winner === outer ? api : base.api;
    const wired = wireTelegram({ ...fixture, admitted }, admittedApi);
    if (winnerMode === 'webhook') intakeKind = wired.ingress.receiveWebhook(telegramUpdate(100)).kind;
    else {
      fixture.queue(telegramUpdate(100));
      intakeKind = wired.ingress.pollOnce().kind;
    }
  }
  return { fixture, outer, nested, records, trace, fired, winnerMode, readmission, intakeKind };
}
