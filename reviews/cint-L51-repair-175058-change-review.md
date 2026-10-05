# Change review — cint-L51 pipeline repair 175058: the packet ladder refuses a context that cannot leave reply-review room before building its prompt

Subject base: 7408602fdc947ec9cbf76af0669d4b60e8de5d12
Review state: open
Reviewed content: none
Outcome: Plan row #506, pipeline repair of the Mama full run (7408602f, 178 failed). The one portable failure, reply-check "answers a long, summarized conversation when Jev is unsure: grounded review decides" (timed out at 10000ms; 17-45s on the Laptop), was CPU-bound: each preparation of a long summarized conversation tried ~750 packet variants, built the model prompt for each, and refused nearly all on the reply-review headroom check (measured: 29,495 prompt builds over 39 preparations, 29,111 of them for a context that by itself already exceeded the review room). A prepared prompt quotes its context whole (the launcher envelope carries it in role:context), so such a context cannot pass. preparedFor now computes the review room once and refuses a context over it before building its prompt, and refuses a whole memory-search family whose smallest member (the packet itself) is over the byte cap or the review room before building the family. Each refusal records the same flags the existing paths recorded (promptFit, preparationUnavailable). The case now runs in 4.4s. The rest of the Mama failures are not code on this branch: the run executed all 819 test files on Linux (no INSTAR_TEST_PLATFORM_SPLIT=exclude-macos), so the 13 listed macOS-only files (tests/platform/macos-only.txt) ran on WSL, and tests/integration/resource-owner.test.ts is the recorded WSL kernel difference (docs/defects/rule-60-61-funnel-fixture-unregistered.md).
Affected rules: 116 (the simplest route: a byte bound computed once, no new mechanism), 2, 95 and 96 (the packet ladder chooses the same packet as before; reachability and the floor's last rung unchanged), 86 (the reply-review reserve is still held; the check is off where the floor waives it), 36 and 106 (recorded live shapes replayed on this tree), 37 (no quarantine; the source fixed), 74 (this record), 101 (plain commits), 102 (decisions below)
Affected floors: secrets — unchanged; nothing new is read or written. Spend cap — no model call added; prompt builds removed, model calls unchanged. Stop — unchanged. No duplicate sends — unchanged; the selected packet and its send path are unchanged. Durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: tests/preview/journal.ts is the preview answer path; any change to packet selection is critical even when behavior-preserving.
Side effects: fewer prepareModel calls per preparation (a context refused by the bound is never handed to the prompt builder). A prepareModel port that returns a prompt smaller than its context (only constant-returning test stand-ins) would see a context over the review room refused before its call; every such fixture's file passes (35 files with both prepareModel and replyCheck run).
Undo and recovery: revert 93e06326.
Multi-machine posture: machine-local preview runner, unchanged.
Layer below: reviews/cint-L51-repair-change-review.md and every record it carries, unchanged. Recorded shapes replayed on this tree: default-root-conversation ("keeps answering a default-size root through the live recorded shapes that silenced room two"), live-failure-regressions ("turn 36 packet growth: actual prepared prompts stay within the 32 KiB cap"), obligation-task-answer-live, review-yes-live, held-reply-replay, held-cascade-replay.
Bug class: none
Bug evidence: none
Hook bypass: none (plain commits; core.hooksPath is unset).
Convergence: none
Decision: cint-L51-r175058-bound | refuse a context over the review room (byte cap minus system prompt minus review reserve) before building its prompt, and a memory-search family whose smallest member is over the cap or the room before building it; flags recorded as the existing refusals record them | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L51-repair-175058-PROGRESS.md
Decision: cint-L51-r175058-env | the macOS-only and resource-owner failures of the Mama run are environment (unsplit Linux run; recorded WSL kernel difference), not repaired here | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L51-repair-175058-PROGRESS.md
Decision: cint-L51-r175058-register | register replay not run: build-register refuses with "feature rungraph-core graduation overdue" (deadline 2026-10-05T00:00Z passed); back-dating --now would bypass the overdue gate, so the source-wiring pin for tests/preview/journal.ts is left to the desk | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L51-repair-175058-PROGRESS.md
Prompt review: no prompt text changed; the change only skips prompt builds that could not pass the existing headroom check.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel for supported remembered facts."
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "for a question about what the operator said"

Subject (1 paths): tests/preview/journal.ts

## Closing block

simplestRobustRoute: one byte bound computed once per preparation and applied before the two expensive steps (the prompt build and the search-family build); no cache, no reordering, no new state.
80/20: 1 must-fix repaired at its source (the reply-check timeout); targeted tests only (35 files with prepareModel and replyCheck, foreground, --maxWorkers 1).
VERDICT: author submission; the independent verdict is recorded as a pass
