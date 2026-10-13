# Change review — Integrate landed main and verify physical timing repair

Subject base: 7ef8f158d4129a4cf90cf3c546701f32e348fdd3
Review state: open
Reviewed content: none
Outcome: Merge landed main 7ef8f158 into the reviewed branch, retain its physical timing repair 43f47a13 and regenerate publication. Main document text wins conflicts; both changelog histories are preserved.
Affected rules: 1, 26, 37, 49, 60, 70, 74, 90, 91, 101, 102, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their carried enforcement; no runtime ability or authority is changed by this integration.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The main-based integration range includes the existing runtime work; newly authored work is merge resolution, generated publication and verification evidence.
Side effects: Unlanded revision numbers advance after landed versions. Main prose is retained exactly for assembly and operator surfaces. Physical test repairs remain byte-identical to 43f47a13.
Undo and recovery: Use a reviewed corrective commit and regenerate publication, retaining all landed history and journal evidence. No history rewrite.
Multi-machine posture: Repository history and publication travel through git. Physical test children and temporary files are deliberately local to Studio; no new production store or protocol.
Layer below: Read both constitution documents, both merge-parent changelog histories, governedVersionErrors exact-tail checks, the physical execute timeout and Six readiness/cleanup tests. Existing owners keep admission, stop and cleanup.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: studio-main-history-1013 | keep landed histories intact, renumber branch-only entries and regenerate publication | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-answer-cancel-transient-1013-repair-PROGRESS.md
Decision: studio-existing-timing-1013 | retain owning timing repair 43f47a13 and verify it on Studio | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-answer-cancel-transient-1013-repair-PROGRESS.md
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No prompt, parser or acceptance behavior is changed by this integration. Inherited prompt dispositions below retain the existing review explanations. Recorded-shape evidence remains in the cancellation unit records.
Prompt finding: 034c5250da92 | quoted-evidence | Existing captured capability/protocol wording is compared with current source, not used as a trigger or required answer — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "run without another yes. the operator can tighten or revoke trust through setup-"
Prompt finding: 0c0c2c5478e2 | protocol-literal | The explicit-yes refusal detail is asserted by its own protocol test; it is not a model instruction.
Prompt finding: 1983d34c97b5 | protocol-literal | The answer-reading parser diagnostic names a malformed response shape, not an expected semantic answer.
Prompt finding: 3c4b8fdd526e | protocol-literal | the phrase is the reader's refusal reason, asserted verbatim by its test; no model reads it, and this change does not touch either line
Prompt finding: 42faf877ba82 | protocol-literal | Existing general identity, authority or memory grounding protocol asserted by regression tests; no fixture phrase classifies user intent — fixture-phrase src/assembly/production-codex-provider.ts <- tests/preview/act-first.test.ts: "you are an instar 2.0 agent,"
Prompt finding: 450c79237a95 | protocol-literal | existing conversation system-prompt wording in production-provider.ts, unchanged by this change (as dispositioned in the carried records)
Prompt finding: 45e37ea2e9e9 | quoted-evidence | Existing captured capability/protocol wording is compared with current source, not used as a trigger or required answer — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 4b98dc2a1b9f | quoted-evidence | Existing captured capability/protocol wording is compared with current source, not used as a trigger or required answer — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "tools: full claude code set"
Prompt finding: 5b486d8bd247 | protocol-literal | Existing reviewer output protocol or secret-standing instruction; unchanged by this timeout-only repair — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "prioritize verdicts; do not repeat rules or context."
Prompt finding: 5fa1a20c4031 | protocol-literal | Existing reviewer output protocol or secret-standing instruction; unchanged by this timeout-only repair — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "an illustrative or quoted literal the verified operator explicitly requested or "
Prompt finding: 6af48f94b789 | quoted-evidence | Existing captured capability/protocol wording is compared with current source, not used as a trigger or required answer — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "sends remain outside the one-machine closed set. the effect doorway reports any "
Prompt finding: 849db3a6296a | protocol-literal | Existing response protocol guidance, unchanged by this merge — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 95e349aaf4ac | quoted-evidence | Existing captured capability/protocol wording is compared with current source, not used as a trigger or required answer — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "via the doorway's four tests; standing grants need no new approval."
Prompt finding: aef7d91bef51 | protocol-literal | Existing reviewer output protocol or secret-standing instruction; unchanged by this timeout-only repair — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "give each listed rule, and no others, one verdict"
Prompt finding: b00ed403060a | quoted-evidence | Existing captured capability/protocol wording is compared with current source, not used as a trigger or required answer — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: b1bb3946362d | protocol-literal | Existing general identity, authority or memory grounding protocol asserted by regression tests; no fixture phrase classifies user intent — fixture-phrase src/assembly/production-provider.ts <- tests/preview/act-first.test.ts: "you are an instar 2.0 agent,"
Prompt finding: b288d6ef1604 | protocol-literal | Existing reviewer output protocol or secret-standing instruction; unchanged by this timeout-only repair — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "keep reasoning under 400 characters and all json under 4000 so every verdict fit"
Prompt finding: e769ca9dd959 | protocol-literal | Existing reviewer output protocol or secret-standing instruction; unchanged by this timeout-only repair — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "pass means no breach; violation means a breach, named in its reason."
Prompt finding: e8708c7fea24 | protocol-literal | unchanged existing protocol guidance — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Prompt finding: f6d7f3274c85 | protocol-literal | Exact historical guide translation for the recorded act-first reviewer comparison; no model quality claim and no phrase classifier. The original capture remains unchanged. — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "restating a recorded, still-open limit needs no duplicate record. a capability n"
Prompt finding: feadb66b8ad1 | protocol-literal | Existing reviewer output protocol or secret-standing instruction; unchanged by this timeout-only repair — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "any live authentication secret reaching anyone but the verified operator who sup"
Deferral: docs/defects/rule-60-61-funnel-fixture-unregistered.md:20 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: docs/defects/rule-60-61-funnel-fixture-unregistered.md:63 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: docs/defects/rule-60-61-funnel-fixture-unregistered.md:64 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: docs/defects/rule-60-61-funnel-fixture-unregistered.md:87 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: docs/defects/rule-60-61-funnel-fixture-unregistered.md:92 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: docs/defects/rule-60-61-funnel-fixture-unregistered.md:99 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: scripts/resource-owner.declarations.json:55 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: scripts/resource-owner.declarations.json:56 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: scripts/retro-live-model-run.mjs:123 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/answer-reading.ts:124 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/claim-scoped-floor.test.ts:295 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/claim-scoped-floor.test.ts:296 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/claim-scoped-floor.test.ts:298 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/claim-scoped-floor.test.ts:307 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/claim-scoped-floor.test.ts:308 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/dispatch-now.test.ts:12 | not-a-deferral=Preserved implementation or test of durable deferred work and follow-up behavior; this merge adds no postponed work.
Deferral: tests/preview/dispatch-now.test.ts:18 | not-a-deferral=Preserved implementation or test of durable deferred work and follow-up behavior; this merge adds no postponed work.
Deferral: tests/preview/dispatch-now.test.ts:65 | not-a-deferral=Preserved implementation or test of durable deferred work and follow-up behavior; this merge adds no postponed work.
Deferral: tests/preview/dispatch-now.test.ts:78 | not-a-deferral=Preserved implementation or test of durable deferred work and follow-up behavior; this merge adds no postponed work.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:125 | not-a-deferral=Preserved recorded corpus text used as evidence, not an implementation promise in this repair.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:126 | not-a-deferral=Preserved recorded corpus text used as evidence, not an implementation promise in this repair.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:151 | not-a-deferral=Preserved recorded corpus text used as evidence, not an implementation promise in this repair.
Deferral: tests/preview/fixtures/answer-flat-live-2026-10-04.json:10 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/answer-flat-live-2026-10-04.json:18 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/answer-flat-live-2026-10-04.json:34 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/answer-flat-live-2026-10-04.json:228 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/answer-flat-live-2026-10-04.json:234 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/answer-flat-live-2026-10-04.json:272 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/answer-flat-live-2026-10-04.json:278 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/canary9-review-2026-10-11.json:64 | not-a-deferral=Preserved recorded corpus text used as evidence, not an implementation promise in this repair.
Deferral: tests/preview/fixtures/canary9-review-2026-10-11.json:69 | not-a-deferral=Preserved recorded corpus text used as evidence, not an implementation promise in this repair.
Deferral: tests/preview/fixtures/capsentence-2026-10-11.json:14 | not-a-deferral=Unchanged inherited line from 3c66ecfb836cb755f93942fbf665b4ed43bfc8d2; existing input reviews retain its meaning and scope. The merge adds no postponement or skipped case.
Deferral: tests/preview/fixtures/capsentence-2026-10-11.json:113 | not-a-deferral=Unchanged inherited line from 3c66ecfb836cb755f93942fbf665b4ed43bfc8d2; existing input reviews retain its meaning and scope. The merge adds no postponement or skipped case.
Deferral: tests/preview/fixtures/capsentence-2026-10-11.json:114 | not-a-deferral=Unchanged inherited line from 3c66ecfb836cb755f93942fbf665b4ed43bfc8d2; existing input reviews retain its meaning and scope. The merge adds no postponement or skipped case.
Deferral: tests/preview/fixtures/capsentence2-2026-10-11.json:166 | not-a-deferral=Immutable captured model reasoning, not deferred builder work.
Deferral: tests/preview/fixtures/capsentence2-2026-10-11.json:486 | not-a-deferral=Immutable captured model reasoning, not deferred builder work.
Deferral: tests/preview/fixtures/codex-tool-turn-2026-10-03/capabilities/events.jsonl:7 | not-a-deferral=a recorded live Codex event stream, kept byte for byte as captured (w4-sessiondriver), not postponed work
Deferral: tests/preview/fixtures/deferral-not-memory-2026-10-12.json:12 | not-a-deferral=Recorded model output under test, not unfinished builder work.
Deferral: tests/preview/fixtures/deferral-not-memory-2026-10-12.json:16 | not-a-deferral=Recorded model output under test, not unfinished builder work.
Deferral: tests/preview/fixtures/deferral-not-memory-2026-10-12.json:21 | not-a-deferral=Recorded model output whose commitment the regression verifies is scheduled.
Deferral: tests/preview/fixtures/doorway-notice-held-2026-10-11.json:95 | not-a-deferral=Preserved recorded corpus text used as evidence, not an implementation promise in this repair.
Deferral: tests/preview/fixtures/doorway-notice-offload-review-2026-10-11.json:12 | not-a-deferral=Preserved recorded corpus text used as evidence, not an implementation promise in this repair.
Deferral: tests/preview/fixtures/flap-a-declarations-2026-10-04.json:55 | not-a-deferral=line carried verbatim from merged input 1e323ff6, whose own record dispositions it; not authored by this mechanical merge
Deferral: tests/preview/fixtures/group-audience-live-2026-10-10.json:170 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/group-audience-live-2026-10-10.json:184 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/guidance-live-2026-10-03.json:252 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/guidance-live-2026-10-03.json:264 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/guidance-live-2026-10-03.json:453 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/guidance-live-2026-10-03.json:482 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/guidance-live-2026-10-03.json:503 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/handover-review-quotes-live-2026-10-06.json:2 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/handover-review-quotes-live-2026-10-06.json:28 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/handover-review-quotes-live-2026-10-06.json:34 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/handover-review-quotes-live-2026-10-06.json:50 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/justin-summary-bound-L28-2026-10-02.json:84 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/justin-summary-bound-L28-2026-10-02.json:195 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/obligation-step-outputs-live-2026-10-04.json:44 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/obligation-step-outputs-live-2026-10-04.json:62 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/obligation-step-outputs-live-2026-10-04.json:80 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/operator-yes-live-2026-10-02.json:27 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/operator-yes-live-2026-10-02.json:43 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/preview-prompt-2026-10-11.json:16 | not-a-deferral=Preserved recorded corpus text used as evidence, not an implementation promise in this repair.
Deferral: tests/preview/fixtures/preview-prompt-negative-2026-10-11.json:13 | not-a-deferral=Preserved recorded corpus text used as evidence, not an implementation promise in this repair.
Deferral: tests/preview/fixtures/proofroom-summary-cascade-stall-2026-09-30.json:1 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:7 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:17 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:62 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:72 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:189 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/proofroom2-recallrank-2026-10-02.json:110 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-live-2026-10-03.json:84 | not-a-deferral=a recorded live status line ("deferred" counts cases the pass did not inspect), kept as captured, not postponed work
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:165 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:169 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:173 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:177 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:181 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:185 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:189 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:193 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:197 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:201 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:205 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:209 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:645 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:652 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:683 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json:689 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:160 | not-a-deferral=the recorded live pass 0's own bound-deferral reason ("bound: answer budget, deferred to a later pass"), quoted verbatim from the journal as test data
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:164 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:168 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:172 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:176 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:180 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:184 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:188 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:192 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:196 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:200 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:204 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:208 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:212 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:216 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:220 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:224 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:228 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:232 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:236 | not-a-deferral=the same recorded bound-deferral reason, next row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:240 | not-a-deferral=the same recorded bound-deferral reason, last row of the live pass's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-2-2026-10-02.json:295 | not-a-deferral=a verbatim real-model answer (call 5), recorded test data; its wording is the model's, not a commitment of this change
Deferral: tests/preview/fixtures/retrospective-live-failures-2026-10-02.json:347 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:8 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:179 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:183 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:187 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:191 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:195 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:199 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:203 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:207 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:211 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:215 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/review-yes-live-2026-10-02.json:19 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/review-yes-live-2026-10-02.json:43 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/runner-task-protocol-live-2026-10-04.json:6 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/runner-task-protocol-live-2026-10-04.json:11 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/runner-task-protocol-live-2026-10-04.json:21 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/runner-task-protocol-live-2026-10-04.json:34 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/runner-task-protocol-live-2026-10-04.json:44 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/selfdesc-2026-10-03/call1-answer-text-pref.json:1 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/selfdesc-2026-10-03/call2-answer-text-nopref.json:1 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/selfdesc-2026-10-04/k11a-replays.json:30 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/selfdesc-2026-10-04/k11a-replays.json:41 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/selfdesc-2026-10-04/k11a-replays.json:63 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/selfdesc-2026-10-04/k11a-replays.json:74 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/selfdesc-2026-10-04/review-r2-broad-1.json:1 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/selfdesc-2026-10-04/review-r2-neighbour-2.json:1 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/selfdesc-unit-2026-10-11.json:13 | not-a-deferral=Preserved recorded corpus text used as evidence, not an implementation promise in this repair.
Deferral: tests/preview/fixtures/selfdesc-unit-2026-10-11.json:14 | not-a-deferral=Preserved recorded corpus text used as evidence, not an implementation promise in this repair.
Deferral: tests/preview/fixtures/selfdesc-unit-negative-2026-10-11.json:13 | not-a-deferral=Preserved recorded corpus text used as evidence, not an implementation promise in this repair.
Deferral: tests/preview/fixtures/selfdesc-unit-negative-2026-10-11.json:14 | not-a-deferral=Preserved recorded corpus text used as evidence, not an implementation promise in this repair.
Deferral: tests/preview/fixtures/status-reply-split-live-2026-10-03.json:2 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/status-reply-split-live-2026-10-03.json:12 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/status-reply-split-live-2026-10-03.json:17 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/status-reply-split-live-2026-10-03.json:29 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/tool-turn/spike-cab6b51d/c1-task/out.jsonl:23 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/tool-turn/spike-cab6b51d/c1-task/out.jsonl:24 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/topic-awareness-live-2026-10-10.json:173 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/train-12-capability-2026-10-12.json:44 | not-a-deferral=Immutable recorded model reasoning, not builder work deferred.
Deferral: tests/preview/fixtures/train-12-capability-2026-10-12.json:384 | not-a-deferral=Immutable recorded model reasoning, not builder work deferred.
Deferral: tests/preview/fixtures/unknown-answer-notice-969390396.json:21 | not-a-deferral=Captured reviewer reasoning, not a new commitment or postponed implementation.
Deferral: tests/preview/fixtures/work-output-live-2026-10-12.json:11 | not-a-deferral=verbatim recorded model output retained as a regression fixture, not a promise by this builder.
Deferral: tests/preview/fixtures/x5-malformed-live-2026-10-06.json:92 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/x5-malformed-live-2026-10-06.json:102 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/x5-malformed-live-2026-10-06.json:152 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/group-disclosure.ts:128 | not-a-deferral=One microtask installs a cache entry before the injected reader can invalidate it; this is implemented sequencing.
Deferral: tests/preview/handover-review-quotes-live.test.ts:3 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/handover-review-quotes-live.test.ts:5 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/handover-review-quotes-live.test.ts:51 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/handover-review-quotes-live.test.ts:63 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-agent.mjs:608 | not-a-deferral=Existing implemented duty-followup, queued-report or obligation behavior; not postponed engineering.
Deferral: tests/preview/journal-deliver-all-floor.test.ts:5 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all-floor.test.ts:61 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all-floor.test.ts:134 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all-floor.test.ts:135 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all-floor.test.ts:143 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all-floor.test.ts:146 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all-floor.test.ts:179 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all-floor.test.ts:184 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all.test.ts:2 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all.test.ts:92 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all.test.ts:111 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all.test.ts:112 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all.test.ts:131 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all.test.ts:132 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all.test.ts:172 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all.test.ts:173 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-due-loop.test.ts:1 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-due-loop.test.ts:24 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-due-loop.test.ts:25 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-due-loop.test.ts:30 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-due-loop.test.ts:47 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-due-loop.test.ts:100 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-due-loop.test.ts:136 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-loop-declared-wait.test.ts:9 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-loop-declared-wait.test.ts:107 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-loop-fire.test.ts:61 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-loop-fire.test.ts:66 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-loop-fire.test.ts:90 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-obligations.test.ts:1314 | not-a-deferral=Existing implemented duty-followup, queued-report or obligation behavior; not postponed engineering.
Deferral: tests/preview/journal-revision-keeps-results.test.ts:5 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-revision-keeps-results.test.ts:7 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-revision-keeps-results.test.ts:8 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-revision-keeps-results.test.ts:37 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-revision-keeps-results.test.ts:38 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-revision-keeps-results.test.ts:41 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-revision-keeps-results.test.ts:44 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-revision-keeps-results.test.ts:48 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-revision-keeps-results.test.ts:111 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-revision-keeps-results.test.ts:113 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-revision-keeps-results.test.ts:115 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-send-outcome.test.ts:22 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-send-outcome.test.ts:26 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal.ts:733 | not-a-deferral=implemented durable recovery behavior or its generated projection, not deferred engineering
Deferral: tests/preview/journal.ts:745 | not-a-deferral=implemented durable recovery behavior or its generated projection, not deferred engineering
Deferral: tests/preview/journal.ts:1354 | not-a-deferral=Existing implemented duty-followup, queued-report or obligation behavior; not postponed engineering.
Deferral: tests/preview/journal.ts:2426 | not-a-deferral=Existing implemented duty-followup, queued-report or obligation behavior; not postponed engineering.
Deferral: tests/preview/journal.ts:2935 | not-a-deferral=Existing implemented duty-followup, queued-report or obligation behavior; not postponed engineering.
Deferral: tests/preview/journal.ts:2940 | not-a-deferral=Existing implemented duty-followup, queued-report or obligation behavior; not postponed engineering.
Deferral: tests/preview/journal.ts:4171 | not-a-deferral=Existing implemented duty-followup, queued-report or obligation behavior; not postponed engineering.
Deferral: tests/preview/journal.ts:4625 | not-a-deferral=implemented durable recovery behavior or its generated projection, not deferred engineering
Deferral: tests/preview/journal.ts:5551 | not-a-deferral=Existing implemented duty-followup, queued-report or obligation behavior; not postponed engineering.
Deferral: tests/preview/journal.ts:8567 | not-a-deferral=Existing implemented duty-followup, queued-report or obligation behavior; not postponed engineering.
Deferral: tests/preview/journal.ts:10715 | not-a-deferral=Existing implemented duty-followup, queued-report or obligation behavior; not postponed engineering.
Deferral: tests/preview/journal.ts:10716 | not-a-deferral=Existing implemented duty-followup, queued-report or obligation behavior; not postponed engineering.
Deferral: tests/preview/journal.ts:10775 | not-a-deferral=Existing implemented duty-followup, queued-report or obligation behavior; not postponed engineering.
Deferral: tests/preview/journal.ts:10785 | not-a-deferral=Existing implemented duty-followup, queued-report or obligation behavior; not postponed engineering.
Deferral: tests/preview/journal.ts:10787 | not-a-deferral=Existing implemented duty-followup, queued-report or obligation behavior; not postponed engineering.
Deferral: tests/preview/journal.ts:10872 | not-a-deferral=implemented durable recovery behavior or its generated projection, not deferred engineering
Deferral: tests/preview/live-sentinels.test.ts:77 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/live-sentinels.test.ts:142 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/live-sentinels.test.ts:222 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/live-sentinels.ts:70 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/obligation-task-answer-live.test.ts:105 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/obligation-task-answer-live.test.ts:109 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/obligation-task-answer-live.test.ts:111 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/obligation-task-answer-live.test.ts:113 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/obligation-task-answer-live.test.ts:166 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/realistic-recall.mjs:8 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/realistic-recall.ts:42 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/reply-check.declarations.json:13 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/reply-parts.test.ts:300 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:19 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:53 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:60 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:127 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:146 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:157 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:172 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:188 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:196 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:248 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:276 | not-a-deferral=names w4-retroduties's duty follow-up (a second retrospective call within the same pass) or its tests, not postponed work
Deferral: tests/preview/retrospective-duty-followup.test.ts:292 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:302 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:305 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:309 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:310 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:311 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:312 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:328 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:343 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:382 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-duty-followup.test.ts:394 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-first-pass-fit.test.ts:308 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-first-pass-fit.test.ts:324 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-first-pass-fit.test.ts:325 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-first-pass-fit.test.ts:326 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-first-pass-fit.test.ts:327 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-first-pass-fit.test.ts:329 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-first-pass-fit.test.ts:333 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-live-failures-4.test.ts:10 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-live-failures-4.test.ts:50 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-live-failures-4.test.ts:64 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-live-failures-4.test.ts:79 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-over-cap.test.ts:160 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-over-cap.test.ts:307 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-over-cap.test.ts:308 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-snapshot-continuation.test.ts:104 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-snapshot-continuation.test.ts:105 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-snapshot-continuation.test.ts:107 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-snapshot-continuation.test.ts:162 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-snapshot-continuation.test.ts:189 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective.test.ts:186 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective.test.ts:368 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective.test.ts:401 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective.test.ts:485 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective.ts:59 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:61 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:144 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:156 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:169 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:407 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:408 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:696 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:709 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:788 | not-a-deferral=names w4-retroduties's duty follow-up (a second retrospective call within the same pass) or its tests, not postponed work
Deferral: tests/preview/retrospective.ts:795 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:796 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:809 | not-a-deferral=names w4-retroduties's duty follow-up (a second retrospective call within the same pass) or its tests, not postponed work
Deferral: tests/preview/retrospective.ts:810 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:811 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:812 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:815 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:818 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:820 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:821 | not-a-deferral=names w4-retroduties's duty follow-up (a second retrospective call within the same pass) or its tests, not postponed work
Deferral: tests/preview/retrospective.ts:826 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:840 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:845 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:846 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:934 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:1181 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:1198 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:1293 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:1294 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:1297 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:1298 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:1332 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/review-yes-live.test.ts:109 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/runner-task-protocol.test.ts:97 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/sensitivity.test.ts:330 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/summary-bound.test.ts:281 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/register/live-rule-four-admissions.test.ts:58 | not-a-deferral=Preserved implementation or test of durable deferred work and follow-up behavior; this merge adds no postponed work.
Deferral: tests/register/live-rule-four-admissions.test.ts:63 | not-a-deferral=Preserved implementation or test of durable deferred work and follow-up behavior; this merge adds no postponed work.
Skip: tests/assembly/process-inventory.test.ts:158 | scope=Existing macOS integration requires the platform sandbox/process facilities.
Skip: tests/e2e/codex-answer-live.test.ts:33 | scope=a gated live case that spends real subscription model calls and needs an agent-owned signed-in login; skips offline (as in the carried w4-sessiondriver record)
Skip: tests/e2e/codex-tool-turn-live.test.ts:89 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/e2e/codex-tool-turn-live.test.ts:109 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/e2e/codex-tool-turn-live.test.ts:128 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/e2e/model-gate-live.test.ts:29 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/e2e/session-work-live.test.ts:42 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/e2e/session-work-tmux.test.ts:100 | scope=Existing session integration requires a working tmux host.
Skip: tests/e2e/session-work-tmux.test.ts:115 | scope=Existing session integration requires a working tmux host.
Skip: tests/platform/macos-only.test.ts:42 | scope=Quoted fixture text for the platform-checker test, not a disabled test.
Skip: tests/preview/ask-anytime.test.ts:224 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/preview/ask-anytime.test.ts:261 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/preview/group-carry-cli.test.ts:12 | scope=Existing macOS-only confined-launch contract; executed and passed on this macOS host. No quarantine.
Skip: tests/preview/guidance.test.ts:352 | scope=Optional live-capture utility requires explicitly supplied COPY and STORAGE; retained recorded fixtures run offline without those credentials.
Skip: tests/preview/operator-yes-live.test.ts:104 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/preview/review-yes-live.test.ts:131 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/preview/review-yes-live.test.ts:224 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/preview/sensitivity.test.ts:385 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/preview/session-admission.test.ts:284 | scope=Existing confinement integration requires the host sandbox.
Skip: tests/preview/session-admission.test.ts:322 | scope=Existing confinement integration requires the host sandbox.
Skip: tests/preview/yes-batch-live.test.ts:375 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/preview/yes-window.test.ts:222 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.


## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge, preserve the already-pushed timing repair, regenerate existing publication and run bounded checks. No new runtime mechanism. Test start/end guards observe real dispatch and cleanup, with existing timeouts bounding failure and explicit release preserving capacity observations. No autonomous live completion is claimed.
80/20: Target the two reported physical observation races and baseline/document checks; leave full-suite execution to the authorized Studio pipeline. Independent acceptance remains with the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
