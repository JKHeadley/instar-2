import type {
  HarnessAdapterStateStorePort,
  HarnessEvidenceStateStorePort,
} from '../../src/harness-adapters/holder.js';

declare const journalOnlyState: HarnessAdapterStateStorePort;
// @ts-expect-error Evidence custody additionally requires durable validation-floor load and append methods.
const evidenceState: HarnessEvidenceStateStorePort = journalOnlyState;
void evidenceState;
