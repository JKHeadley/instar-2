# Change review — train-20 responsiveness and truthful replies

Subject base: ac3bd4d8874495f8b66b571837a1380995113d7a
Review state: open
Reviewed content: none
Outcome: Combine five reviewed repairs with train-19: independent answer progress, transient cancellation recovery, timely acknowledgement, delivery-grounded status and plain capability descriptions.
Affected rules: Purpose 2/3/6; Rules 1, 4, 8, 10, 12, 18, 26, 28, 29, 34, 36, 37, 41, 42, 49, 55, 57, 58, 60, 70, 74, 77, 83, 84, 86, 90, 91, 95, 96, 99, 101, 102, 103, 108, 111, 112, 113, 116.
Affected floors: secrets — existing redaction and audience checks; spend cap — existing bounded repair/review reservations; stop — existing model/send guards; no duplicate sends — existing durable intents, receipts and ownership; durable intake — retained raw updates and journal evidence.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Combining two reviewed model-facing admission and reply-review repairs; no new authority.
Side effects: Earlier bounded acknowledgement uses existing durable notices; independent answers no longer await unsettled memory judgment. Transient grant-read failures preserve an in-flight answer, while verified stop and authority loss still cancel. Status and capability wording changes are model-facing; recorded shapes are retained and replayed. The environment-only npm configuration is reverted by the requested ordinary revert. No docs body changes, packet-budget increases, new stores or authority.
Undo and recovery: Revert this publication before deployment. Preserve new notice/recovery journal readability on rollback; do not remove durable intake or uncertain send evidence. Prefer roll-forward for journals containing newly admitted notice templates.
Multi-machine posture: Existing owned conversation journals, replication, grant checks and durable send fences remain; timers and cancellation handles are deliberately process-local. No new machine-local durable store or peer dependency.
Layer below: Inspected merged journal admission, cancellation and reply-review paths and original change records. Source merges were automatic. Preserved train-19 refusal diagnostics and dated declarations. Generated publications and artifact hashes derive from actual merged bytes; docs are identical to exact base. Capability output continues through the existing installed inventory and marker provenance checks.
Bug class: integration
Bug evidence: reproducer=tests/preview/deferral-confirm-delay.test.ts
Hook bypass: none; core.hooksPath unset, shared hooks directory contains sample hooks only.
Convergence: none
Prompt review: Replay the merged units' captured live/proof-room fixtures, including summary uncertain, Jev uncertain/undecided, reply review and delivered/empty reply shapes. No new provider calls or unattended live acceptance claim; this is a gate candidate. Packet floors and guards remain unchanged.
Decision: train-20-head-1 | Merge sb-deferral-confirm-delay-1013 37a3d9d48d8aca9bfd596b67ec2446397cd8997e; reviewed unit report lanes/deferral-confirm-delay-1013-PROGRESS.md and reviews/sb-deferral-confirm-delay-1013-change-review.md. Keep its reviewed behavior and repairs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-20-PROGRESS.md
Decision: train-20-head-2 | Merge sb-answer-cancel-transient-1013 00a7c722bad3a7920c58d8660847ad40c8d3aa1a; reviewed unit report lanes/answer-cancel-transient-1013-PROGRESS.md and reviews/sb-answer-cancel-transient-1013-change-review.md. Keep its reviewed behavior and repairs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-20-PROGRESS.md
Decision: train-20-head-3 | Merge ack-timing-1013 1117a73fd04ac3e26024128d90f433503507431e; reviewed unit report lanes/ack-timing-1013-PROGRESS.md and reviews/ack-timing-1013-change-review.md. Keep its reviewed behavior and repairs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-20-PROGRESS.md
Decision: train-20-head-4 | Merge status-truth-1013 633ae042e70096c5de1ae830bdfd148b13be1ca7; reviewed unit report lanes/status-truth-1013-PROGRESS.md and reviews/status-truth-1013-change-review.md. Keep its reviewed behavior and repairs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-20-PROGRESS.md
Decision: train-20-head-5 | Merge capability-plain-1013 a73676f582f2cb163339c6b08e8ee02a50335323; reviewed unit report lanes/capability-plain-1013-PROGRESS.md and reviews/capability-plain-1013-change-review.md. Keep its reviewed behavior and repairs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-20-PROGRESS.md
Decision: train-20-revert | Ordinary revert of 991831d8 at fedcbcd4 removes the Studio environment workaround .npmrc and its repair review. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-20-PROGRESS.md
Decision: train-20-desk-A | Keep all five independent behaviors; automatic source merges preserve each path, verified at consumers. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-20-PROGRESS.md
Decision: train-20-desk-B | Retain train-19 grounded refusal and relative reminder behavior alongside every incoming repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-20-PROGRESS.md
Decision: train-20-desk-C | No product conflict and no head left out; generated conflicts retained only temporarily before regeneration. Changelog content on both sides already exists in base, whose entries remain exact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-20-PROGRESS.md
Decision: train-20-desk-D | Run foreground bounded WSL checks; list host-dependent tests for Studio, without changing live roots or using serving logins. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-20-PROGRESS.md
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged attribution instruction; the cited recall test checks that it reaches the packet. This repair adds no phrase-based judgment.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed memory-inventory response; the cited test checks its existing renderer, not a classifier introduced by this change.
Prompt finding: 5b486d8bd247 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "prioritize verdicts; do not repeat rules or context."
Prompt finding: 5fa1a20c4031 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "an illustrative or quoted literal the verified operator explicitly requested or "
Prompt finding: aef7d91bef51 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "give each listed rule, and no others, one verdict"
Prompt finding: b288d6ef1604 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "keep reasoning under 400 characters and all json under 4000 so every verdict fit"
Prompt finding: e769ca9dd959 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "pass means no breach; violation means a breach, named in its reason."
Prompt finding: f6d7f3274c85 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "restating a recorded, still-open limit needs no duplicate record. a capability n"
Prompt finding: feadb66b8ad1 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "any live authentication secret reaching anyone but the verified operator who sup"
Prompt finding: 0abb3dc96311 | protocol-literal | Historical prompt translation checks the reviewed unresolved-date admission instruction; it is not an expected model answer or an intent detector.
Prompt finding: 7c45ffbe90ad | protocol-literal | Historical prompt translation checks the new admitted-reminder evidence field while retaining the recorded verdict; it is not an expected model answer or an intent keyword test.
Prompt finding: b1bb3946362d | protocol-literal | Existing production-provider identity prefix asserted by the now-scoped act-first test; this change does not alter that identity, provider, or assertion.
Prompt finding: 42faf877ba82 | protocol-literal | Existing production-codex-provider identity prefix asserted by the now-scoped act-first test; this change does not alter that identity, provider, or assertion.
Deferral: tests/preview/fixtures/ack-timing-userwalk-2026-10-13.json:847 | not-a-deferral=Captured historical reviewer output for update 6233124, not a promise by this builder.
Deferral: tests/preview/fixtures/ack-timing-userwalk-2026-10-13.json:1595 | not-a-deferral=Captured historical reviewer output for update 6233129, not a promise by this builder.
Prompt finding: 034c5250da92 | protocol-literal | Existing capability protocol bytes are compared as provenance, never used as a meaning classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "run without another yes. the operator can tighten or revoke trust through setup-"
Prompt finding: 45e37ea2e9e9 | protocol-literal | Existing capability protocol bytes are compared as provenance, never used as a meaning classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 4b98dc2a1b9f | protocol-literal | Existing capability protocol bytes are compared as provenance, never used as a meaning classifier — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "tools: full claude code set"
Prompt finding: 6af48f94b789 | protocol-literal | Existing capability protocol bytes are compared as provenance, never used as a meaning classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "sends remain outside the one-machine closed set. the effect doorway reports any "
Prompt finding: 95e349aaf4ac | protocol-literal | Existing capability protocol bytes are compared as provenance, never used as a meaning classifier — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "via the doorway's four tests; standing grants need no new approval."
Prompt finding: b00ed403060a | protocol-literal | Existing capability protocol bytes are compared as provenance, never used as a meaning classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 0c0c2c5478e2 | protocol-literal | The explicit-yes refusal detail is asserted by its own protocol test; it is not a model instruction.
Prompt finding: 1983d34c97b5 | protocol-literal | The answer-reading parser diagnostic names a malformed response shape, not an expected semantic answer.
Prompt finding: 3c4b8fdd526e | protocol-literal | the phrase is the reader's refusal reason, asserted verbatim by its test; no model reads it, and this change does not touch either line
Prompt finding: 450c79237a95 | protocol-literal | existing conversation system-prompt wording in production-provider.ts, unchanged by this change (as dispositioned in the carried records)
Deferral: tests/preview/fixtures/status-truth-1013.json:173 | not-a-deferral=Verbatim captured conversation and model evidence retained for replay, not a new promise or deferred implementation.
Deferral: tests/preview/fixtures/status-truth-1013.json:178 | not-a-deferral=Verbatim captured conversation and model evidence retained for replay, not a new promise or deferred implementation.
Deferral: tests/preview/fixtures/status-truth-1013.json:615 | not-a-deferral=Verbatim captured conversation and model evidence retained for replay, not a new promise or deferred implementation.


Generation: repin found no stale inventory sources; owner rehash refreshed two hashes, committed before explicit register replay at source head. The build requires an exact commit id; prior attempts using the previous recorded source or symbolic HEAD refused without writing output.

Decision: train-20-budget | Combined status review exceeds its fixed review margin by 138 bytes. Shorten only self_state_claim prose, retaining its record sources, delivery versus holding/due semantics, as-of versus startup distinction and supported/unaddressed non-breach. Leave the 22959-byte prompt guard and 2540-byte review constant unchanged. Replay captured status and other judgment shapes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-20-PROGRESS.md

Budget verification: all 13 context-floor and recorded status tests pass after the 162-byte trim. Capability replay passes against the regenerated publication. Guard constants unchanged.

Deferral: tests/preview/journal.ts:738 | not-a-deferral=Describes the implemented durable interrupted-answer recovery and its UNKNOWN effect fence, not postponed builder work.

Deferral: tests/preview/journal.ts:750 | not-a-deferral=Describes the implemented durable interrupted-answer recovery and its UNKNOWN effect fence, not postponed builder work.

Deferral: tests/preview/journal.ts:4647 | not-a-deferral=Describes the implemented durable interrupted-answer recovery and its UNKNOWN effect fence, not postponed builder work.

Deferral: tests/preview/journal.ts:10949 | not-a-deferral=Describes the implemented durable interrupted-answer recovery and its UNKNOWN effect fence, not postponed builder work.

Decision: train-20-replay | Extend act-first historical question translation to the delivery-grounded status rule; keep the captured question, answer and verdict bytes unchanged, and assert the translated current question exactly. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-20-PROGRESS.md

Decision: train-20-pins | Credential-label review test asserts that capabilities, credentialRegister and history remain named sources instead of pinning the retired connective wording; keep public-metadata and Jev-boundary checks intact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-20-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: ordinary merges of reviewed repairs, the requested ordinary revert and existing repin/build/rehash/register replay. No new machinery. Verified intake, existing bounded model/recovery work, current ownership and grant checks, durable dispatch and stop remain the start, end-state and limit guards. Captured replay proves integration; live acceptance belongs to the desk.
80/20: Required changed tests, direct consumers and explicit journal/launcher families in foreground chunks; no full suite or convergence claim.
VERDICT: author submission; independent review belongs to the desk
