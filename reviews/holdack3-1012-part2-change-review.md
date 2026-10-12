# Change review — Arm queued-message acknowledgement at durable intake

Subject base: 6b5a759bed8f27ac118a711c2fcb9de4033e1add
Review state: open
Reviewed content: none
Outcome: A next operator message is durably accepted and its eight-second acknowledgement timer is armed during intake, without waiting for the serial answer worker.
Affected rules: Purpose least revelation and durable cause; Rules 1/4/14/28/32/36/41/46/49/52/54/58/63/70/74/75/77/87/101/111/113/116.
Affected floors: secrets — same exact outbound check; spend cap — no paid acknowledgement call, reply allowance retained; stop — timer and last physical admission check the stop; no duplicate sends — same signed intent/UNKNOWN fence; durable intake — unchanged journal intake.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: User-visible timing and outbound admission race.
Side effects: Timer and in-flight maps are bounded by admitted turn slots. Each answer cancels only its own timer. Queued acknowledgements may overlap the earlier turn’s review/send; each retains its own signed intent, exact reply anchor and allowance admission. Paid answer reservations remain immediately before each serial model call, avoiding false UNKNOWN paid work.
Undo and recovery: Revert source and regenerate publication; keep new fixed-text replay support when rolling back a root that already contains the new intents. No resend of accepted or UNKNOWN effects.
Multi-machine posture: Timer is deliberately process-local. The existing durable intake, signed intent, owner fence and replication admission remain authoritative. Host rechecks cancellation after peer admission.
Layer below: Confirmed worker.intake already appends synchronously and advances the durable cursor while drain is busy. reserve represents a model invocation, not intake custody; it must not move early. Replay second input 969390410 ten seconds after 969390409 and inject an additional slow first review while verifying peak active answer calls remains one.
Bug class: integration
Bug evidence: reproducer=tests/preview/reply-acknowledgement-timing.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No prompt, parser or semantic decision changes. Exact captured updates 969390407–410 and the seven existing uncertain/empty/review shapes traverse the changed scheduling path. Recorded acknowledgement transport duration is distinguished from final-answer send duration.
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged answer prompt/fixture wording; this change removes only the fixed acknowledgement review — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: bd01de21286a | protocol-literal | Existing unchanged answer prompt/fixture wording; this change removes only the fixed acknowledgement review — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel for supported remembered facts."
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing unchanged answer prompt/fixture wording; this change removes only the fixed acknowledgement review — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "for a question about what the operator said"


## Closing block

simplestRobustRoute: This is the simplest robust route: retain existing synchronous durable intake and serial answers; move timer ownership to each admitted turn. Two bounded maps replace the single active-turn timer/promise so a queued turn cannot wait behind an unrelated review/send. Every timer still uses the same deterministic admission and durable send floors; no parallel answer workers or speculative paid reservations.
80/20: Recorded pair with twelve-second injected first review, timer boundaries, restart/UNKNOWN tests, actual host and two-machine floor tests, compiler and mandatory gate. No fresh live Telegram deployment claim.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
