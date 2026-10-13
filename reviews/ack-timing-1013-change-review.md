# Change review — acknowledgement receipt budget and queued requests

Subject base: 0de16e3cdaea380ac746793123a51382aeb9830b
Review state: open
Reviewed content: none
Outcome: A slow request receives one accurate acknowledgement within ten seconds under the measured transport bound; a queued request is identified as queued, and final results retain ordering and once-only delivery.
Affected rules: Rules 13, 26, 34, 36, 49, 52, 70, 74, 77, 80, 87, 101, 102, 111, 113, 116.
Affected floors: secrets — existing checkOutbound and disclosure; spend cap — existing reply allowance with zero additional paid calls; stop — current/gate at admission; no duplicate sends — durable held-notice and terminal intents; durable intake — existing encrypted intake, cursor and restart reconstruction.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: A fixed timer budget and two content-free templates reuse the existing notice mechanism.
Side effects: Requests completing between seven and ten seconds can now receive an acknowledgement. Final dispatch cancels an unadmitted notice and awaits an admitted notice. Historical fixed notices retain their eight-second replay floor. The deadline assumes at most three seconds combined intake, admission/jitter and transport; browser paint is unmeasured.
Undo and recovery: Revert runtime scheduling while retaining replay acceptance for newly admitted templates. Older readers must not open journals containing new template bytes. Unknown notice sends stay fenced on restart.
Multi-machine posture: Machine-local timer, deliberately; durable notice and reply intents remain in the existing owned conversation journal and send doorway.
Layer below: Inspected disclosure, provenance, reply anchor, admission callback, UNKNOWN fence, final dispatch cancellation/await, journal replay and allowance checks. F4/F8 frames show intake plus ten seconds before transport, and serialized second requests. The separate memory serialization cause belongs to deferral-confirm-delay-1013.
Bug class: integration
Bug evidence: reproducer=tests/preview/ack-timing-userwalk.test.ts
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains sample hooks only.
Convergence: none
Decision: ack-timing-1013-budget | Schedule at seven seconds with three seconds for intake/admission/transport; suppress at final dispatch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ack-timing-1013-PROGRESS.md
Decision: ack-timing-1013-queue | Use durable serial order for one queued or still-working line in the existing slot, rechecking queue state before admission. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ack-timing-1013-PROGRESS.md
Decision: ack-timing-1013-replay | Replay F4/F8 intake, terminal text and timelines through the worker; preserve historical template readability. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ack-timing-1013-PROGRESS.md

Subject (5 paths): tests/preview/journal.ts; tests/preview/reply-acknowledgement.test.ts; tests/preview/reply-acknowledgement-timing.test.ts; tests/preview/ack-timing-userwalk.test.ts; tests/preview/fixtures/ack-timing-userwalk-2026-10-13.json

## Closing block

simplestRobustRoute: This is the simplest robust route: budget the existing timer before the receipt deadline and choose its single notice text from durable worker state. Preserve start guards (operator, allowance, stop), end guard (final dispatch), limits (one notice and existing reply cap) and durable UNKNOWN fence. Recorded shipped-path failures are replayed offline; live acceptance belongs to the desk.
80/20: F4/F8 only. Provider/reviewer latency and the separately owned memory dependency remain distinct work. Receipt bounds and unmeasured browser paint are explicit limits.
VERDICT: author submission; independent judgment belongs to the review desk
