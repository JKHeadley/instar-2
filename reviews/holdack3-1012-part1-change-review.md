# Change review — Fixed acknowledgement timer without per-send model review

Subject base: 4b125fec868204430f25023b94d0cf071e0c867d
Review state: open
Reviewed content: none
Outcome: One fixed acknowledgement by an eight-second timer, cancelled when the answer is ready; no per-send model review.
Affected rules: Purpose least revelation and durable cause; Rules 1/4/14/28/32/36/41/46/49/52/54/58/63/70/74/75/77/87/101/111/113/116.
Affected floors: secrets — same exact outbound check; spend cap — no paid acknowledgement call, reply allowance retained; stop — timer and last physical admission check the stop; no duplicate sends — same signed intent/UNKNOWN fence; durable intake — unchanged journal intake.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: User-visible timing and outbound admission race.
Side effects: A fixed template no longer creates review-reservation rows. Historical reviewed text remains accepted by the fold. A timer can overlap an audience probe; final dispatch rechecks current eligibility. Once a network send starts it cannot be recalled, and the final answer waits for its settlement. Fixtures that formerly expected post-answer acknowledgements now require none.
Undo and recovery: Revert source and regenerate publication; keep new fixed-text replay support when rolling back a root that already contains the new intents. No resend of accepted or UNKNOWN effects.
Multi-machine posture: Timer is deliberately process-local. The existing durable intake, signed intent, owner fence and replication admission remain authoritative. Host rechecks cancellation after peer admission.
Layer below: Read rule book review principle and Part 12 section 9; traced minimal poll, serial worker, disclosure, durable intent, host admission and physical send. Copied live root preserves carried private memory and 73–76 turns.
Bug class: integration
Bug evidence: reproducer=tests/preview/reply-acknowledgement-timing.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No answer prompt or parser changes. Fixed template Checking that now. reviewed here: no private content, claim of completion, user action or result. It acknowledges the person’s own pending turn. Recorded live answers and Jev scores 969390407–410 replay; existing seven captured uncertain/empty/model-review shapes exercise the changed path.
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged answer prompt/fixture wording; this change removes only the fixed acknowledgement review — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: bd01de21286a | protocol-literal | Existing unchanged answer prompt/fixture wording; this change removes only the fixed acknowledgement review — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel for supported remembered facts."
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing unchanged answer prompt/fixture wording; this change removes only the fixed acknowledgement review — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "for a question about what the operator said"

Subject (11 paths): tests/preview/README.md, tests/preview/fixtures/reply-acknowledgement-live-2026-10-12.json, tests/preview/jev-stage-latency.test.ts, tests/preview/journal-agent-resources.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-obligations.test.ts, tests/preview/journal-summary-crash.test.ts, tests/preview/journal.ts, tests/preview/reply-acknowledgement-timing.test.ts, tests/preview/reply-acknowledgement.test.ts, tests/preview/send-stage-replay.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: delete per-send acknowledgement review; arm a cancellable eight-second timer through existing sends. The timer prevents poll cadence from delaying dispatch. The current callback prevents a slow audience or peer check from sending after an answer wins. Existing durable intent and UNKNOWN handling prevent repeats. Captured-root replay and real host with an injected slow provider prove the path without live Telegram effects.
80/20: Targeted worker, recorded-shape, host, send boundary, crash and pinned tests; compiler and constitutional machine checks. Desk owns independent gate and deployment.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
