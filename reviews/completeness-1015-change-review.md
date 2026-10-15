# Change review — Complete requested counts and sets

Subject base: c458547406d4ad8f3c7988f8247befb73775f618
Review state: open
Reviewed content: none
Outcome: Requests naming a count or full set receive completion guidance, and the existing unfinished-work review compares the candidate to the requested scope.
Affected rules: Purpose constraints 2/3; 1, 4, 10, 12, 26, 34, 36, 41, 47, 49, 57, 58, 70, 74, 75, 77, 84, 86, 95, 101, 102, 105, 108, 111, 112, 113, 116
Affected floors: secrets — existing redactor and credential wall; spend cap — exact expanded question bytes reserved before dispatch; stop — unchanged; no duplicate sends — unchanged journal/send fence; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Prompt and contextual question change reusing existing review and revision; no new authority, hold, model call or state.
Side effects: Provider prompt bytes and invocation-policy digests change. Jev parks_on_user receives the redacted operator request; its historical score calibration for omissions is unmeasured. One existing escalation/revision may run when it flags missing coverage. Existing caps/deadlines remain. Old paid verdicts are not rerun.
Undo and recovery: Revert this change and regenerate register output; existing activation successor process applies to changed prompt policy hashes. No schema migration.
Multi-machine posture: Identical repository instructions on every host; existing ownership and replicated journal stay authoritative. No new local or shared state.
Layer below: Jev request construction and reservation accounting; source-to-system-prompt inheritance; contextual review selection; existing bounded revision and journal reopen/deduplication.
Bug class: integration
Bug evidence: reproducer=tests/preview/completeness.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory inspected, sample hooks only
Convergence: none
Decision: completeness-instructions | Cover counts and sets in both provider families without raising the unused output cap. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/completeness-1015-PROGRESS.md
Decision: completeness-context | Reuse parks_on_user with a quoted request; no new checker or keyword selector. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/completeness-1015-PROGRESS.md
Decision: completeness-accounting | Reserve the exact expanded Jev question bytes on initial, retry and retrospective routes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/completeness-1015-PROGRESS.md
Decision: completeness-evidence | Preserve the recorded miss and label simulated judgments; test revision/send/reopen. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/completeness-1015-PROGRESS.md
Decision: completeness-publication | Regenerate ordinary source pins, preserve the desk-owned native macOS certificate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/completeness-1015-PROGRESS.md
Prompt review: Judge scope by meaning against the quoted request, never a month list or keyword selector. Preserve captured update 46040043 and its erroneous historical Jev pass. Tests label simulated judgments and counterfactual complete/limited answers; no live call or accuracy claim.
Prompt finding: 034c5250da92 | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "run without another yes. the operator can tighten or revoke trust through setup-"
Prompt finding: 0abb3dc96311 | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "an unresolved date or unrecorded scheduling claim is no admitted reminder."
Prompt finding: 450c79237a95 | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/journal-people.test.ts: "if two active memory items match the question but disagree, or refer to differen"
Prompt finding: 45e37ea2e9e9 | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 5b486d8bd247 | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "prioritize verdicts; do not repeat rules or context."
Prompt finding: 5fa1a20c4031 | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "an illustrative or quoted literal the verified operator explicitly requested or "
Prompt finding: 6af48f94b789 | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "sends remain outside the one-machine closed set. the effect doorway reports any "
Prompt finding: 7c45ffbe90ad | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "loops the deferrals, judgments and promises it will track, dated this turn's adm"
Prompt finding: 849db3a6296a | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: aef7d91bef51 | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "give each listed rule, and no others, one verdict"
Prompt finding: b00ed403060a | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: b1bb3946362d | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/act-first.test.ts: "you are an instar 2.0 agent,"
Prompt finding: b288d6ef1604 | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "keep reasoning under 400 characters and all json under 4000 so every verdict fit"
Prompt finding: e769ca9dd959 | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "pass means no breach; violation means a breach, named in its reason."
Prompt finding: e8708c7fea24 | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Prompt finding: f6d7f3274c85 | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "restating a recorded, still-open limit needs no duplicate record. a capability n"
Prompt finding: feadb66b8ad1 | protocol-literal | Existing protocol wording pinned by consumer tests; no copied test answer or phrase classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "any live authentication secret reaching anyone but the verified operator who sup"


## Closing block

simplestRobustRoute: This is the simplest robust route: one completion instruction plus the existing unfinished-work question and revision. The named failure was a four-of-twelve answer passing a reviewer blind to the request. Passing the request and reserving its bytes fixes that blind input without another call or subsystem. Start guards are the existing intake and spend/stop floors; end guards remain review/revision/send. No unattended live-model success is claimed.
80/20: Targeted foreground tests, one worker, no full suite or live provider; desk owns native certificate and live acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

Prompt finding: 1679f75a5561 | protocol-literal | Exact prompt delta pinned by historical-capture consumer assertions, not a fixed-answer classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/act-first.test.ts: "before finishing, check that your answer covers every requested item and categor"
Prompt finding: 42faf877ba82 | protocol-literal | Exact prompt delta pinned by historical-capture consumer assertions, not a fixed-answer classifier — fixture-phrase src/assembly/production-codex-provider.ts <- tests/preview/act-first.test.ts: "you are an instar 2.0 agent,"
Prompt finding: 4b98dc2a1b9f | protocol-literal | Exact prompt delta pinned by historical-capture consumer assertions, not a fixed-answer classifier — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "tools: full claude code set"
Prompt finding: 95e349aaf4ac | protocol-literal | Exact prompt delta pinned by historical-capture consumer assertions, not a fixed-answer classifier — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "via the doorway's four tests; standing grants need no new approval."
Prompt finding: 979f5ade569a | protocol-literal | Exact prompt delta pinned by historical-capture consumer assertions, not a fixed-answer classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "the writer hands back work they could do."
Prompt finding: b6fd2475ca1a | protocol-literal | Exact prompt delta pinned by historical-capture consumer assertions, not a fixed-answer classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "silently omitting requested items or categories is unfinished work. the writer h"
Prompt finding: cc2d55239d77 | protocol-literal | Exact prompt delta pinned by historical-capture consumer assertions, not a fixed-answer classifier — fixture-phrase src/assembly/production-codex-provider.ts <- tests/preview/act-first.test.ts: "before finishing, check that your answer covers every requested item and categor"

Pin rationale: Historical capture bytes stay immutable; tests translate only the added completion instruction and unfinished-work question. Conversation policy digest becomes sha256:50e405d0c8cc969e008e76e96e1a0709ec1258e86c6390586e15961d1f5c90a2. Refresh the owner artifact hash for the adjusted summary-question stub. Native macOS conformance is left for the desk.

Evidence boundary: The default-context test found the longer question exceeded existing review headroom; the same omission judgment is stated compactly, preserving the 40-byte margin and all existing context/call bounds. No floor was widened.

Decision: completeness-test-budget | The unchanged 200-turn assertions exceeded the 120-second wall allowance twice on WSL, including in isolation. Allow 300 seconds for this test only; keep every turn, byte limit, recall and reopen check. Product call deadlines stay unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/completeness-1015-PROGRESS.md

Compatibility: Summary and reply Jev test doubles distinguish the summary_integrity question rather than the presence of any question argument. No production summary behavior changes.

Verification: Focused completion/review/recorded-shape tests and the unchanged context floor pass. The bounded 200-turn test passes in 123.7 seconds: 200 sends, no held turn, 3/3 early facts, 199 contextual reviews, maximum answer/review envelopes 16734/26468 bytes below 32768. Initial 120-second timeouts remain documented. Final direct-consumer, typecheck, register and pin outputs are in the canonical PROGRESS report.

Register publication: Existing shape-only replay regenerated from source commit 266ad4b50fbcb7c96dad7221e7cabdbeb537ddc1, generation sha256:a6fd9e6f3ae68145aa89d8cce20b1353858fa9adfd476e766e2983f93e6b6993. Seven derived register outputs change only their source/generation pins. No native certificate or runtime authority declaration is changed.
