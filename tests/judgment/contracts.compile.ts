import type { JudgmentRequest, JudgmentAttemptRecord, JudgmentResolution } from '../../src/judgment/index.js';
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
  void [q, a, r, accepted];
}
void closed;
