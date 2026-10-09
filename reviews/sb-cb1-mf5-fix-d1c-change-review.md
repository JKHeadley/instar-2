# Change review — D1c connection recovery

Subject base: e1dc1ddd60d72355f6442daebf084467a945c0f3
Review state: open
Reviewed content: none
Outcome: A transient failure to open the Telegram connection gets one more connection attempt within the existing admitted physical call and original timeout. Any possibly delivered send remains UNKNOWN and is never repeated. D1c update 46039703 already contained the finished garden-blog result but settled fetch-failure; the old record lacks a native cause, so this repair does not assert which connection phase failed historically.
Affected rules: 8, 22, 26, 34, 36, 37, 42, 46, 49, 55, 60, 63, 70, 74, 92, 101, 111, 112, 113, 116
Affected floors: secrets — existing credential scan precedes both attempts and exception text never escapes; spend cap — no model calls or metering changes; stop — existing physical admission and original elapsed bound remain; no duplicate sends — only native connection setup errors authorize one retry, not resets or lost receipts; durable intake — signed durable intent and preserved inputs unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: User-visible delivery repair at the existing confined transport; the no-duplicate boundary needs real socket evidence.
Side effects: All bridge methods share connection recovery, including identity reads and polling. Two attempts share one AbortSignal and one child/resource lifetime. Unsupported cause shapes remain UNKNOWN. No new durable state or wire schema; existing installs acquire the code with the normal package switch. The final failure shape remains conservative when both attempts fail.
Undo and recovery: Revert bridge and its regression fixtures, regenerate composition and register pins with the same generators. No journal migration or deletion; historical UNKNOWNs remain non-retryable.
Multi-machine posture: Retry occurs inside one admitted physical invocation, keeping the same replicated dispatch claim and owner fence. It never re-enters admission or creates a second machine claim. Single-machine installations use the same bridge; no peer dependency or new state.
Layer below: Read native bridge fetch and manual redirect handling, production-boot-io child/resource bounds, preview classifier and durable signed dispatch, replicated claim/outcome, and native harness composition checks. Real local sockets verify refused connection versus server-received request with lost receipt; both accepted and UNKNOWN journals reopen without another send.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-send-outcome.test.ts
Hook bypass: none
Convergence: none
Decision: d1c-transport | Fix connection setup at the physical bridge, without changing prompts or weakening uncertain-delivery protection; the prior log cannot establish the original native cause | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-cb1-mf5-fix-repair-PROGRESS.md
Decision: d1c-evidence | Preserve the saved report and its root/revision receipts; rooted checks use their original gate root read-only rather than fabricate a fresh full-suite receipt | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-cb1-mf5-fix-repair-PROGRESS.md
Prompt review: No model-facing change: prompts, model output parsers and model accept/escalate/refuse logic are unchanged. The exact recorded acknowledgement, deferral quote, completed result, candidate reply and UNKNOWN reason from updates 46039702/46039703 are replayed through the journal and actual bridge.
Deferral: tests/preview/journal-send-outcome.test.ts:22 | not-a-deferral=Comment describes the recorded completed follow-up regression, not unfinished work.
Deferral: tests/preview/journal-send-outcome.test.ts:26 | not-a-deferral=Test title for the recorded completed follow-up, not a promised task.

Validation: Typecheck and build pass. Focused journal-send-outcome and telegram-bot-api-round6 files: 41 passed, five explicit pre-existing NON-EXECUTABLE-UNTIL representation-extension grant cases held (not Rule 37 quarantines). Native harness contract: 9 passed after generator-derived composition recertification. Both native ECONNREFUSED recovery and actual receipt loss use the recorded D1c bytes, with exactly one server request and no replay on restart. Synthetic neighbors cover DNS, connect timeout, all-failed address aggregates, mixed/empty aggregates, both sides of aggregate depth/width limits, wrong syscall, socket ambiguity, persistent connection failure, expired shared deadline, and unchanged success/secret/redirect behavior. The pipeline supplies the fresh full-suite and live pre-switch verdict.

Register evidence: The desk rehash and repin-chain scripts ran; owner/inventory pins were already current. The generated register is replayed from ece8ae3de3dd655e737d9bb1f319bdffd53597f2. Seven saved-report checkers pass locally; the four root-bound checks validate at the original gate root read-only. No copied evidence is relabelled as a new full run. Details and exact checker outputs are in the repair PROGRESS record.

Integration: The starting local checkout lagged the remote frozen candidate. Merge origin/sb-cb1-mf5-fix e1dc1ddd without rewriting history; all runtime/source merges are mechanical, with only generated files conflicting. Restore the remote generated snapshot as the intermediate merge state and replay it from the integrated source commit. The subject base now names that exact frozen candidate, so this review covers the D1c repair while preserving the already reviewed train work. Regenerate the native composition digest and repeat the focused tests and final cheap checks on the integrated tree.

## Closing block

simplestRobustRoute: This is the simplest robust route: one narrowly proven connection retry in the existing transport call. A new queue, re-dispatch claim, prompt revision or generic send retry would be unnecessary or unsafe. Start guard is existing admission plus native connection evidence; end guard is the exact accepted receipt; limits are two attempts under one original timeout and existing process/resource bounds. Actual unattended local socket replay passes for the recorded D1c reply; no fresh Telegram delivery is claimed.
80/20: Focused transport boundaries and native composition conformance, then the required cheap checks and desk register generation; no full suite on this machine and no invented independent verdict.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
