import type { BenchmarkRecord, BenchmarkRunRecord, BenchmarkScenario, JudgmentBenchmarkReadPort, JudgmentRequest, JudgmentAttemptRecord, JudgmentResolution } from '../../src/judgment/index.js';
import type { OwnedReference } from '../../src/index.js';
function closed(request: Omit<JudgmentRequest, never>, raw: object): void {
  void request;
  // @ts-expect-error Caller JSON does not mint an owned request.
  const q: JudgmentRequest = raw;
  // @ts-expect-error Caller JSON does not mint an owned attempt.
  const a: JudgmentAttemptRecord = raw;
  // @ts-expect-error Caller JSON does not mint a resolution.
  const r: JudgmentResolution = raw;
  const ref: OwnedReference<'part-seven', 'JudgmentResolution'> = { owner: 'part-seven', name: 'JudgmentResolution', id: 'fact:1' };
  // @ts-expect-error A recorded answer is not five-owned run acceptance.
  const accepted: OwnedReference<'part-five', 'RunAcceptance'> = ref;
  const port = null as unknown as JudgmentBenchmarkReadPort;
  // @ts-expect-error Read-only benchmark ports cannot admit a rerun.
  port.rerun({});
  // @ts-expect-error Read-only benchmark ports cannot fetch raw captures.
  port.readCapture({});
  const records = null as unknown as readonly [BenchmarkRecord, BenchmarkScenario, BenchmarkRunRecord];
  void [q, a, r, accepted, records];
}
void closed;
