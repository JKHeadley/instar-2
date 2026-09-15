import type { IntakeAdapterPort, IntakePort } from '../../src/intake/index.js';
import type { EffectDoorway, OperationAdapterPort } from '../../src/effects/index.js';
import type { FactStorePort } from '../../src/facts/index.js';
import type {
  AdmittedTelegramAdapter, TelegramBotApiCustodianPort, TelegramIngressDependencies,
} from '../../src/conversation/index.js';

declare const admitted: AdmittedTelegramAdapter;
declare const api: TelegramBotApiCustodianPort;
declare const intakeAdapter: IntakeAdapterPort;
declare const intake: IntakePort;
declare const facts: FactStorePort;
declare const effect: EffectDoorway;
declare const operation: OperationAdapterPort;

const ingress: TelegramIngressDependencies = {
  boundary: {} as TelegramIngressDependencies['boundary'], admitted, api, intake, facts, observer: 'intake-observer',
};
const owners: readonly ['part-ten', 'part-four', 'part-eight', 'part-ten'] = [
  api.owner, intakeAdapter.id === '' ? 'part-four' : 'part-four', effect.owner, operation.owner,
];
void ingress;
void owners;
