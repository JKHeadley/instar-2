import { stallCoverageGaps, unresolvedStallCases } from '../../src/assembly/stall-coverage.js';
import type { HarnessStallCoverage } from '../../src/assembly/stall-coverage.js';

/** The journal runner's harness identity: a stateless, journal-backed native harness. It keeps
 * no model session between turns; every turn is prepared from the journal (re-grounding), so a
 * lost process loses nothing the journal did not already record. */
export const PREVIEW_JOURNAL_HARNESS = 'preview-journal-native';

/**
 * Rule 59: every way this harness can silently stop, with the evidence that detects it, the
 * permitted recovery, and a captured positive and failing case. The runner admits this table at
 * launch and resolves every case against the shipped tests; an incomplete or unresolvable table
 * refuses the launch.
 */
export const PREVIEW_JOURNAL_STALL_COVERAGE: HarnessStallCoverage = Object.freeze({
  type: 'HarnessStallCoverage', harness: PREVIEW_JOURNAL_HARNESS, rows: Object.freeze([
    { stall: 'launch-rejected-or-answer-lost',
      detection: 'runs.jsonl launch row without an exit row (an unrecorded end) and the conversation-owner claim',
      recovery: 'the host supervisor revives a queued runner with bounded relaunches; no second runner while another holds the poll',
      positive: { file: 'tests/preview/journal-obligations.test.ts', title: 'revives a queued runner, stops on inhibited or none, and bounds relaunches after crashes (Rules 55, 68)' },
      failing: { file: 'tests/preview/journal-cutover.test.ts', title: 'refuses a recorded long-poll overlap, then restarts and answers once from durable intake' } },
    { stall: 'input-buffered-not-consumed',
      detection: 'every update is fsynced to the journal before the cursor advances; an admitted turn without an answer stays pending',
      recovery: 'replay the durable intake on the next launch and answer each admitted update once; never advance past an unrecorded update',
      positive: { file: 'tests/preview/journal-burst.test.ts', title: 'fsyncs a ten-update burst in update order across a mid-batch crash, merges the edit, and sends once per other turn' },
      failing: { file: 'tests/preview/journal-spend-cap.test.ts', title: 'stops a multi-update poll at maxTurns without poisoning replay or advancing past the unrecorded update' } },
    { stall: 'prompt-approval-or-tool-wait',
      detection: 'the model route runs one non-interactive call with no tools; any wait surfaces as the bounded local call timeout, recorded as a distinct failure class',
      recovery: 'the call becomes UNKNOWN and its turn gets a loss notice; nothing is clicked or approved by timeout and no next call starts during a stop',
      positive: { file: 'tests/preview/call-diagnostics.test.ts', title: 'distinguishes a parsed 2048-token over-cap result from a 120-second local timeout without retaining prose' },
      failing: { file: 'tests/preview/real-model-recall-sample.test.ts', title: 'reaps a physical provider child on SIGTERM and starts no next question' } },
    { stall: 'provider-unavailable-or-expired',
      detection: 'the recorded call outcome and failure class of the actual provider attempt, metered against the shared cap',
      recovery: 'hold the turn with its cause; an UNKNOWN charged call is never retried and never raises the cap around the uncertainty',
      positive: { file: 'tests/preview/held-reply-replay.test.ts', title: 'replays live-shaped failure classes and measures first-attempt holds by class' },
      failing: { file: 'tests/preview/live-failure-regressions.test.ts', title: 'uncertain effect: a charged unknown answer gets only its loss notice and is never retried' } },
    { stall: 'worker-exit-or-process-reuse',
      detection: 'the journal and run log survive the process; a successor reads the same pending and UNKNOWN work',
      recovery: 'a successor launch resumes pending work from the journal and keeps every UNKNOWN send fenced',
      positive: { file: 'tests/preview/journal-handoff.test.ts', title: 'starts a successor after SIGKILL with the same pending and UNKNOWN work' },
      failing: { file: 'tests/preview/journal-conversations.test.ts', title: 'keeps a question with an UNKNOWN send unanswered after replay without resending it' } },
    { stall: 'alive-without-progress',
      detection: 'backlog age and stalled progress on the pull surface, measured from durable work, independent of process liveness',
      recovery: 'the scheduled owner starts due work only inside the stop, allowance and capacity fences; an interrupted start is never repeated',
      positive: { file: 'tests/preview/journal-obligations.test.ts', title: 'shows backlog age, inhibition and stalled progress on the pull surface, and idle when drained (Rules 46, 64)' },
      failing: { file: 'tests/preview/journal-obligations.test.ts', title: 'starts scheduled work only inside the stop, allowance and capacity fences, and never repeats an interrupted start (Rules 55, 68)' } },
    { stall: 'context-compacted-or-limit',
      detection: 'the packet records the exact last inbound id once it leaves verbatim history (the summary boundary)',
      recovery: 'fresh grounding from the journal each turn; the first reply after compaction accounts for the last inbound or gets a fixed disclosure',
      positive: { file: 'tests/preview/journal-boundaries.test.ts', title: 'carries the exact last inbound id once it is out of verbatim view, and records the model account' },
      failing: { file: 'tests/preview/journal-boundaries.test.ts', title: 'is not a compaction while the last message is still verbatim in history or recalled' } },
    { stall: 'output-partial-malformed-or-delayed',
      detection: 'the whole Decision JSON is decoded; a wrapper, extra object or malformed proposal is refused before append',
      recovery: 'keep the intake unresolved and reply truthfully once; an incomplete frame is never treated as a complete answer',
      positive: { file: 'tests/preview/journal-dated-memory.test.ts', title: 'replies truthfully once to a malformed dated proposal across restart, retaining unresolved intake' },
      failing: { file: 'tests/preview/offline-canary.test.ts', title: 'accepts one whole Decision JSON object or fence and refuses conflicting wrappers' } },
    { stall: 'stop-fence-or-resource-loss',
      detection: 'the durable stop latch, expiry and cap state read at every gate, not a local active label',
      recovery: 'inhibit new action and keep the observed state; resume only when the stop is lifted, sending held work once',
      positive: { file: 'tests/preview/journal-long-message.test.ts', title: 'does not prepare a too-long notice after stop, then sends it once when resumed' },
      failing: { file: 'tests/preview/journal-reminder.test.ts', title: 'sends nothing while stopped, after an operator stop, or when the reply cap is reached' } },
  ]),
}) as HarnessStallCoverage;

/** The launch-time admission: refuses unless the table is complete and every captured case resolves. */
export function admitPreviewHarness(read: (file: string) => string | null, coverage: HarnessStallCoverage = PREVIEW_JOURNAL_STALL_COVERAGE): void {
  const gaps = [...stallCoverageGaps(coverage), ...unresolvedStallCases(coverage, read)];
  if (gaps.length) throw Error(`preview: harness stall coverage incomplete: ${gaps.join('; ')}`);
}
