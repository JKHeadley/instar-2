# Change review — landed PR 162 merge coverage in refusal repair

Subject base: 1b26222647ed2e5dab3b21a65f7d996106e60541
Review state: open
Reviewed content: none
Outcome: Cover the already-landed PR 162 merge 7ef8f158, which the checker reported as uncovered, together with its incorporation in this candidate. The existing install-bootstrap-design-1013 review covers its design branch but ends before the merge commit. This supplemental record adds coverage only; no new installation design or runtime change is authored.
Affected rules: 1, 12, 27, 37, 42, 49, 69, 74, 90, 91, 101, 102, 111, 112, 113, 116
Affected floors: secrets — no new credential or model access; spend cap — inherited finite reservations retained; stop — inherited checks retained; no duplicate sends — inherited intent and receipt path retained; durable intake — recorded refusals and journals unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The combined candidate includes model-facing refusal admission; this repair itself changes merge histories and generated verification publications only.
Side effects: Preserve main's landed changelog entries byte-identically and append the branch-only versions after them with collision-free numbering. Render the human-readable histories from JSON. Merge the bootstrap documents with the inherited branch additions; no new constitutional wording, prompt, parser or refusal behavior is authored here. Existing prompt and deferral dispositions below are carried from the inherited change records because the landed-main subject spans the candidate's accumulated units.
Undo and recovery: Revert the merge using its first parent and regenerate publications for that head; retain all previous history. No deployed journal or live state is modified.
Multi-machine posture: Repository-only integration and publication regeneration on WSL; production conversation ownership, replication and compatible journal readers remain unchanged. Studio runs the full acceptance gate.
Layer below: Read the full purpose and rules from origin/main; verified mind-rule18-sync is already an ancestor. Inspected both sides of the three conflicted changelogs, the existing refusal review, and the desk regeneration scripts. Targeted first-landing and additivity checks passed (10 files, 31 tests including the recorded refusal replay), exercising inherited baseline logic without moving local main. Typecheck and build passed. The desk inventory and owner-reference rehash each found zero changed pins; register replay published 289 entries from cc1b7e5571860df0d5d0316da23ec0c5bcb5af21.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: refusal-withheld-112022-landed-coverage | Add supplemental coverage from PR 162 main parent because the existing design review stops before its landed merge; retain the repair merge record based on merged main as requested. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-refusal-withheld-1013-repair-112022-PROGRESS.md
Prompt review: No new model-facing change in this repair. Preserve the candidate's recorded refusal fixture (update 6233134, frames 839–878) and run its replay. The inherited prompt findings below retain their recorded dispositions; fixed protocol strings and quoted evidence are not introduced as new semantic classifiers. No fresh live-provider or deployed acceptance claim.

Prompt finding: 034c5250da92 | quoted-evidence | The self-description regression explicitly quotes the shipped standing-trust passage to compare with historical K11a system bytes; no prompt was derived from fixture trigger text and no historical verdict is claimed for the new prompt.
Prompt finding: 0c0c2c5478e2 | protocol-literal | a refusal detail of the admission, matched by its own test; not prompt text
Prompt finding: 1983d34c97b5 | protocol-literal | an existing defect literal in answer-reading.ts, unchanged by this change (only its line moved) — asserted-answer tests/preview/answer-reading.ts: "the answer is neither text nor a json object"
Prompt finding: 3c4b8fdd526e | protocol-literal | the reader's refusal reason, asserted verbatim by its test; no model reads it, and this change does not touch either line (as dispositioned in the carried records; it enters this record's range only because its report pointers were repointed in cint-L24, extending the range over the cint-L22 to cint-L23 commits)
Prompt finding: 42faf877ba82 | protocol-literal | Unchanged historical identity-prefix translation already present in act-first; the source provider identity was not edited by this task. — fixture-phrase src/assembly/production-codex-provider.ts <- tests/preview/act-first.test.ts: "you are an instar 2.0 agent,"
Prompt finding: 450c79237a95 | protocol-literal | an existing system-prompt sentence about conflicting memory items in production-provider.ts, unchanged by this change (as dispositioned in reviews/rc-1-change-review.md)
Prompt finding: 45e37ea2e9e9 | quoted-evidence | The self-description regression explicitly quotes the shipped standing-trust passage to compare with historical K11a system bytes; no prompt was derived from fixture trigger text and no historical verdict is claimed for the new prompt.
Prompt finding: 4b98dc2a1b9f | protocol-literal | Existing tool inventory wording is unchanged by this unit.
Prompt finding: 5b486d8bd247 | protocol-literal | Unchanged protocol or fixed runner text; the cited test verifies it is carried, rather than using an operator phrase as a classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "prioritize verdicts; do not repeat rules or context."
Prompt finding: 5fa1a20c4031 | protocol-literal | Unchanged protocol or fixed runner text; the cited test verifies it is carried, rather than using an operator phrase as a classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "an illustrative or quoted literal the verified operator explicitly requested or "
Prompt finding: 6af48f94b789 | quoted-evidence | The self-description regression explicitly quotes the shipped standing-trust passage to compare with historical K11a system bytes; no prompt was derived from fixture trigger text and no historical verdict is claimed for the new prompt.
Prompt finding: 849db3a6296a | protocol-literal | existing saved-memory response in journal.ts, unchanged by this change.
Prompt finding: 95e349aaf4ac | protocol-literal | Existing doorway and standing-grant wording is unchanged by this unit.
Prompt finding: aef7d91bef51 | protocol-literal | Unchanged protocol or fixed runner text; the cited test verifies it is carried, rather than using an operator phrase as a classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "give each listed rule, and no others, one verdict"
Prompt finding: b00ed403060a | quoted-evidence | The self-description regression explicitly quotes the shipped standing-trust passage to compare with historical K11a system bytes; no prompt was derived from fixture trigger text and no historical verdict is claimed for the new prompt.
Prompt finding: b1bb3946362d | protocol-literal | Unchanged historical identity-prefix translation already present in act-first; the source provider identity was not edited by this task. — fixture-phrase src/assembly/production-provider.ts <- tests/preview/act-first.test.ts: "you are an instar 2.0 agent,"
Prompt finding: b288d6ef1604 | protocol-literal | Unchanged protocol or fixed runner text; the cited test verifies it is carried, rather than using an operator phrase as a classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "keep reasoning under 400 characters and all json under 4000 so every verdict fit"
Prompt finding: e769ca9dd959 | protocol-literal | Unchanged protocol or fixed runner text; the cited test verifies it is carried, rather than using an operator phrase as a classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "pass means no breach; violation means a breach, named in its reason."
Prompt finding: e8708c7fea24 | protocol-literal | existing memory source-label guidance in journal.ts, unchanged by this change.
Prompt finding: f6d7f3274c85 | protocol-literal | Exact historical guide translation for the recorded act-first reviewer comparison; no model quality claim and no phrase classifier. The original capture remains unchanged. — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "restating a recorded, still-open limit needs no duplicate record. a capability n"
Prompt finding: feadb66b8ad1 | protocol-literal | Unchanged protocol or fixed runner text; the cited test verifies it is carried, rather than using an operator phrase as a classifier — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "any live authentication secret reaching anyone but the verified operator who sup"
Deferral: docs/defects/rule-60-61-funnel-fixture-unregistered.md:20 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: docs/defects/rule-60-61-funnel-fixture-unregistered.md:63 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: docs/defects/rule-60-61-funnel-fixture-unregistered.md:64 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: docs/defects/rule-60-61-funnel-fixture-unregistered.md:87 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: docs/defects/rule-60-61-funnel-fixture-unregistered.md:92 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: docs/defects/rule-60-61-funnel-fixture-unregistered.md:99 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: scripts/resource-owner.declarations.json:55 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: scripts/resource-owner.declarations.json:56 | commitment=docs/defects/rule-60-61-funnel-fixture-unregistered.md
Deferral: scripts/retro-live-model-run.mjs:123 | not-a-deferral=a comment on the script's own clock advance, describing why a second pass becomes due; the word is the planner's vocabulary for an owed case that did not fit a pass
Deferral: tests/preview/answer-reading.ts:124 | not-a-deferral=the comment quotes the recorded live reply's own "Follow-up on" wording
Deferral: tests/preview/claim-scoped-floor.test.ts:295 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/claim-scoped-floor.test.ts:296 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/claim-scoped-floor.test.ts:298 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/claim-scoped-floor.test.ts:307 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/claim-scoped-floor.test.ts:308 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/dispatch-now.test.ts:12 | not-a-deferral=defer constructs a manually resolved promise to inject a slow job in a test
Deferral: tests/preview/dispatch-now.test.ts:18 | not-a-deferral=test fixture creates its manually resolved slow-job and start promises
Deferral: tests/preview/dispatch-now.test.ts:65 | not-a-deferral=test fixture creates its manually resolved slow job for admission checks
Deferral: tests/preview/dispatch-now.test.ts:78 | not-a-deferral=test fixture creates its manually resolved slow job for coalescing checks
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:125 | not-a-deferral=Verbatim captured model output under test; no implementation work is postponed.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:126 | not-a-deferral=Verbatim captured model output under test; no implementation work is postponed.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:151 | not-a-deferral=Quoted malformed model output retained to prove parser refusal, not an implementation promise.
Deferral: tests/preview/fixtures/answer-flat-live-2026-10-04.json:10 | not-a-deferral=a recorded model output quoted verbatim as test evidence (the agent's own promise to the operator in the a5 replay), not a commitment by this change
Deferral: tests/preview/fixtures/answer-flat-live-2026-10-04.json:18 | not-a-deferral=a recorded model output quoted verbatim as test evidence (the agent's own promise to the operator in the a5 replay), not a commitment by this change
Deferral: tests/preview/fixtures/answer-flat-live-2026-10-04.json:34 | not-a-deferral=a recorded model output quoted verbatim as test evidence (the agent's own promise to the operator in the a5 replay), not a commitment by this change
Deferral: tests/preview/fixtures/answer-flat-live-2026-10-04.json:228 | not-a-deferral=a recorded model output quoted verbatim as test evidence (the agent's own promise to the operator in the a5 replay), not a commitment by this change
Deferral: tests/preview/fixtures/answer-flat-live-2026-10-04.json:234 | not-a-deferral=a recorded model output quoted verbatim as test evidence (the agent's own promise to the operator in the a5 replay), not a commitment by this change
Deferral: tests/preview/fixtures/answer-flat-live-2026-10-04.json:272 | not-a-deferral=a recorded model output quoted verbatim as test evidence (the agent's own promise to the operator in the a5 replay), not a commitment by this change
Deferral: tests/preview/fixtures/answer-flat-live-2026-10-04.json:278 | not-a-deferral=a recorded model output quoted verbatim as test evidence (the agent's own promise to the operator in the a5 replay), not a commitment by this change
Deferral: tests/preview/fixtures/canary9-review-2026-10-11.json:64 | not-a-deferral=Immutable captured reviewer output discusses whether the probe defers work; it creates no commitment.
Deferral: tests/preview/fixtures/canary9-review-2026-10-11.json:69 | not-a-deferral=Immutable captured reviewer retry discusses whether the probe defers work; it creates no commitment.
Deferral: tests/preview/fixtures/capsentence-2026-10-11.json:14 | not-a-deferral=Historical captured output retained for replay; not a promise or deferred work by this build
Deferral: tests/preview/fixtures/capsentence-2026-10-11.json:113 | not-a-deferral=Historical captured output retained for replay; not a promise or deferred work by this build
Deferral: tests/preview/fixtures/capsentence-2026-10-11.json:114 | not-a-deferral=Historical captured output retained for replay; not a promise or deferred work by this build
Deferral: tests/preview/fixtures/capsentence2-2026-10-11.json:166 | not-a-deferral=Historical captured output retained for replay; not a promise or deferred work by this build
Deferral: tests/preview/fixtures/capsentence2-2026-10-11.json:486 | not-a-deferral=Historical captured output retained for replay; not a promise or deferred work by this build
Deferral: tests/preview/fixtures/codex-tool-turn-2026-10-03/capabilities/events.jsonl:7 | not-a-deferral=a recorded live model output quoted verbatim as replay fixture data, not a commitment by this change
Deferral: tests/preview/fixtures/deferral-not-memory-2026-10-12.json:12 | not-a-deferral=Recorded model output under test, not unfinished builder work.
Deferral: tests/preview/fixtures/deferral-not-memory-2026-10-12.json:16 | not-a-deferral=Recorded model output under test, not unfinished builder work.
Deferral: tests/preview/fixtures/deferral-not-memory-2026-10-12.json:21 | not-a-deferral=Recorded model output whose commitment the regression verifies is scheduled.
Deferral: tests/preview/fixtures/doorway-notice-held-2026-10-11.json:95 | not-a-deferral=Immutable captured review output, not a new promise.
Deferral: tests/preview/fixtures/doorway-notice-offload-review-2026-10-11.json:12 | not-a-deferral=Immutable captured review output, not a new promise.
Deferral: tests/preview/fixtures/flap-a-declarations-2026-10-04.json:55 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/group-audience-live-2026-10-10.json:170 | not-a-deferral=verbatim recorded model reasoning about whether the candidate defers work; this is evidence, not a builder commitment
Deferral: tests/preview/fixtures/group-audience-live-2026-10-10.json:184 | not-a-deferral=verbatim recorded model reasoning about the defers_work rule; no work is postponed by this change
Deferral: tests/preview/fixtures/guidance-live-2026-10-03.json:252 | not-a-deferral=verbatim recorded live reply (update 969389883), kept as a Rule 106 fixture
Deferral: tests/preview/fixtures/guidance-live-2026-10-03.json:264 | not-a-deferral=verbatim recorded reviewer reason quoting a live reply, kept as a Rule 106 fixture
Deferral: tests/preview/fixtures/guidance-live-2026-10-03.json:453 | not-a-deferral=verbatim recorded model output, kept as a Rule 106 fixture
Deferral: tests/preview/fixtures/guidance-live-2026-10-03.json:482 | not-a-deferral=verbatim recorded model output, kept as a Rule 106 fixture
Deferral: tests/preview/fixtures/guidance-live-2026-10-03.json:503 | not-a-deferral=verbatim recorded model output, kept as a Rule 106 fixture
Deferral: tests/preview/fixtures/handover-review-quotes-live-2026-10-06.json:2 | not-a-deferral=fixture provenance prose describing the recorded hand-over turn
Deferral: tests/preview/fixtures/handover-review-quotes-live-2026-10-06.json:28 | not-a-deferral=recorded live reviewer output, verbatim evidence
Deferral: tests/preview/fixtures/handover-review-quotes-live-2026-10-06.json:34 | not-a-deferral=recorded live reviewer output, verbatim evidence
Deferral: tests/preview/fixtures/handover-review-quotes-live-2026-10-06.json:50 | not-a-deferral=recorded live reviewer output, verbatim evidence
Deferral: tests/preview/fixtures/justin-summary-bound-L28-2026-10-02.json:84 | not-a-deferral=verbatim recorded model output quoting an operator request, test data
Deferral: tests/preview/fixtures/justin-summary-bound-L28-2026-10-02.json:195 | not-a-deferral=verbatim recorded model output quoting an operator request, test data
Deferral: tests/preview/fixtures/obligation-step-outputs-live-2026-10-04.json:44 | not-a-deferral=a recorded live model output replayed verbatim as test data, not work this change defers
Deferral: tests/preview/fixtures/obligation-step-outputs-live-2026-10-04.json:62 | not-a-deferral=a recorded live model output replayed verbatim as test data, not work this change defers
Deferral: tests/preview/fixtures/obligation-step-outputs-live-2026-10-04.json:80 | not-a-deferral=a recorded live model output replayed verbatim as test data, not work this change defers
Deferral: tests/preview/fixtures/operator-yes-live-2026-10-02.json:27 | not-a-deferral=verbatim recorded model reasoning ("not a deferred commitment of mine"), quoted data
Deferral: tests/preview/fixtures/operator-yes-live-2026-10-02.json:43 | not-a-deferral=verbatim recorded model reasoning ("a follow-up about the pending raise-caps request"), quoted data
Deferral: tests/preview/fixtures/preview-prompt-2026-10-11.json:16 | not-a-deferral=Immutable captured model output used as regression evidence, not a new commitment
Deferral: tests/preview/fixtures/preview-prompt-negative-2026-10-11.json:13 | not-a-deferral=Immutable captured model output used as regression evidence, not a new commitment
Deferral: tests/preview/fixtures/proofroom-summary-cascade-stall-2026-09-30.json:1 | not-a-deferral=verbatim recorded proof-room turns, replies and writer outputs replayed as test data, not a commitment by this change
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:7 | not-a-deferral=a verbatim recorded proof-room reply or writer output replayed as test data, not a commitment by this change
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:17 | not-a-deferral=a verbatim recorded proof-room reply or writer output replayed as test data, not a commitment by this change
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:62 | not-a-deferral=a verbatim recorded proof-room reply or writer output replayed as test data, not a commitment by this change
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:72 | not-a-deferral=a verbatim recorded proof-room reply or writer output replayed as test data, not a commitment by this change
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:189 | not-a-deferral=a verbatim recorded proof-room reply or writer output replayed as test data, not a commitment by this change
Deferral: tests/preview/fixtures/proofroom2-recallrank-2026-10-02.json:110 | not-a-deferral=the line is a verbatim model output quoted as fixture data (index terms such as "follow-up items"), not a statement about this change's own work
Deferral: tests/preview/fixtures/retrospective-duty-followup-live-2026-10-03.json:84 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
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
Deferral: tests/preview/fixtures/retrospective-live-failures-2026-10-02.json:347 | not-a-deferral=the recorded live pass 13's own counters, quoted verbatim ("978 deferred by bound"); test data, not a commitment
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:8 | not-a-deferral=the recorded live refusal reason, quoted verbatim as test data
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:179 | not-a-deferral=the recorded live pass 0's own bound-deferral reason, quoted verbatim from the rebuilt packet's omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:183 | not-a-deferral=the same recorded bound-deferral reason, next row of the omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:187 | not-a-deferral=the same recorded bound-deferral reason, next row of the omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:191 | not-a-deferral=the same recorded bound-deferral reason, next row of the omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:195 | not-a-deferral=the same recorded bound-deferral reason, next row of the omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:199 | not-a-deferral=the same recorded bound-deferral reason, next row of the omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:203 | not-a-deferral=the same recorded bound-deferral reason, next row of the omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:207 | not-a-deferral=the same recorded bound-deferral reason, next row of the omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:211 | not-a-deferral=the same recorded bound-deferral reason, next row of the omitted list
Deferral: tests/preview/fixtures/retrospective-live-failures-4-2026-10-03.json:215 | not-a-deferral=the same recorded bound-deferral reason, last row of the omitted list
Deferral: tests/preview/fixtures/review-yes-live-2026-10-02.json:19 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/review-yes-live-2026-10-02.json:43 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/runner-task-protocol-live-2026-10-04.json:6 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/runner-task-protocol-live-2026-10-04.json:11 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/runner-task-protocol-live-2026-10-04.json:21 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/runner-task-protocol-live-2026-10-04.json:34 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/runner-task-protocol-live-2026-10-04.json:44 | not-a-deferral=Captured historical model output or journal data retained verbatim for replay, not a promise to postpone this change.
Deferral: tests/preview/fixtures/selfdesc-2026-10-03/call1-answer-text-pref.json:1 | not-a-deferral=verbatim recorded real-model output (call 1), kept as a Rule 106 fixture
Deferral: tests/preview/fixtures/selfdesc-2026-10-03/call2-answer-text-nopref.json:1 | not-a-deferral=verbatim recorded real-model output (call 2), kept as a Rule 106 fixture
Deferral: tests/preview/fixtures/selfdesc-2026-10-04/k11a-replays.json:30 | not-a-deferral=a verbatim recorded model reply to the K11a question (it describes reminders for later times), kept as a Rule 106 replay record
Deferral: tests/preview/fixtures/selfdesc-2026-10-04/k11a-replays.json:41 | not-a-deferral=a verbatim recorded model reply to the K11a question (it describes reminders for later times), kept as a Rule 106 replay record
Deferral: tests/preview/fixtures/selfdesc-2026-10-04/k11a-replays.json:63 | not-a-deferral=a verbatim recorded model reply to the K11a question (it describes reminders for later times), kept as a Rule 106 replay record
Deferral: tests/preview/fixtures/selfdesc-2026-10-04/k11a-replays.json:74 | not-a-deferral=a verbatim recorded model reply to the K11a question (it describes reminders for later times), kept as a Rule 106 replay record
Deferral: tests/preview/fixtures/selfdesc-2026-10-04/review-r2-broad-1.json:1 | not-a-deferral=a verbatim recorded reviewer output (it describes the reply's reminder capability), kept as a Rule 106 replay record
Deferral: tests/preview/fixtures/selfdesc-2026-10-04/review-r2-neighbour-2.json:1 | not-a-deferral=a verbatim recorded reviewer output (it describes the reply's reminder capability), kept as a Rule 106 replay record
Deferral: tests/preview/fixtures/selfdesc-unit-2026-10-11.json:13 | not-a-deferral=Immutable captured model output, not a new promise.
Deferral: tests/preview/fixtures/selfdesc-unit-2026-10-11.json:14 | not-a-deferral=Immutable captured model output, not a new promise.
Deferral: tests/preview/fixtures/selfdesc-unit-negative-2026-10-11.json:13 | not-a-deferral=Immutable captured model output used as regression evidence, not a new commitment
Deferral: tests/preview/fixtures/selfdesc-unit-negative-2026-10-11.json:14 | not-a-deferral=Immutable captured model output used as regression evidence, not a new commitment
Deferral: tests/preview/fixtures/status-reply-split-live-2026-10-03.json:2 | not-a-deferral=names the retrospective duty follow-up feature in a fixture description
Deferral: tests/preview/fixtures/status-reply-split-live-2026-10-03.json:12 | not-a-deferral=recorded status text quoted verbatim from the live root
Deferral: tests/preview/fixtures/status-reply-split-live-2026-10-03.json:17 | not-a-deferral=recorded status text quoted verbatim from the live root
Deferral: tests/preview/fixtures/status-reply-split-live-2026-10-03.json:29 | not-a-deferral=recorded status text quoted verbatim from the live root
Deferral: tests/preview/fixtures/tool-turn/spike-cab6b51d/c1-task/out.jsonl:23 | not-a-deferral=verbatim recorded model output of the spike's c1 run, kept as a Rule 106 fixture
Deferral: tests/preview/fixtures/tool-turn/spike-cab6b51d/c1-task/out.jsonl:24 | not-a-deferral=verbatim recorded model output of the spike's c1 run, kept as a Rule 106 fixture
Deferral: tests/preview/fixtures/topic-awareness-live-2026-10-10.json:173 | not-a-deferral=capture provenance describes the attribution question as a follow-up test; this records completed model replay and defers no work
Deferral: tests/preview/fixtures/train-12-capability-2026-10-12.json:44 | not-a-deferral=Historical captured output retained for replay; not a promise or deferred work by this build
Deferral: tests/preview/fixtures/train-12-capability-2026-10-12.json:384 | not-a-deferral=Historical captured output retained for replay; not a promise or deferred work by this build
Deferral: tests/preview/fixtures/unknown-answer-notice-969390396.json:21 | not-a-deferral=Historical captured output retained for replay; not a promise or deferred work by this build
Deferral: tests/preview/fixtures/work-output-live-2026-10-12.json:11 | not-a-deferral=verbatim recorded model output retained as a regression fixture, not a promise by this builder.
Deferral: tests/preview/fixtures/x5-malformed-live-2026-10-06.json:92 | not-a-deferral=recorded live reviewer output, verbatim evidence
Deferral: tests/preview/fixtures/x5-malformed-live-2026-10-06.json:102 | not-a-deferral=recorded live model output, verbatim evidence
Deferral: tests/preview/fixtures/x5-malformed-live-2026-10-06.json:152 | not-a-deferral=recorded live model output, verbatim evidence
Deferral: tests/preview/group-disclosure.ts:128 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
Deferral: tests/preview/handover-review-quotes-live.test.ts:3 | not-a-deferral=test header describing the recorded hand-over turn
Deferral: tests/preview/handover-review-quotes-live.test.ts:5 | not-a-deferral=test header quoting the recorded reply's "Follow-up on" wording
Deferral: tests/preview/handover-review-quotes-live.test.ts:51 | not-a-deferral=an assertion on the recorded candidate's "Follow-up on" text
Deferral: tests/preview/handover-review-quotes-live.test.ts:63 | not-a-deferral=an assertion that the recorded reasoning keeps its quoted "Follow-up on" text
Deferral: tests/preview/journal-agent.mjs:605 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
Deferral: tests/preview/journal-deliver-all-floor.test.ts:5 | not-a-deferral=the recorded live wording `no grant for unsolicited sends; 3 finished results wait for your next message`, quoted in the header comment as evidence
Deferral: tests/preview/journal-deliver-all-floor.test.ts:61 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all-floor.test.ts:134 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all-floor.test.ts:135 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all-floor.test.ts:143 | not-a-deferral=the comment naming the runner's follow-up separator in the excision unit test
Deferral: tests/preview/journal-deliver-all-floor.test.ts:146 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all-floor.test.ts:179 | not-a-deferral=the live reviewer finding of update 6232450, replayed verbatim as recorded evidence
Deferral: tests/preview/journal-deliver-all-floor.test.ts:184 | not-a-deferral=the live reviewer reason of update 6232450, replayed verbatim as recorded evidence
Deferral: tests/preview/journal-deliver-all.test.ts:2 | not-a-deferral=a comment describing the recorded live run's deferred work, not work this change defers
Deferral: tests/preview/journal-deliver-all.test.ts:92 | not-a-deferral=a test assertion on the delivered follow-up line
Deferral: tests/preview/journal-deliver-all.test.ts:111 | not-a-deferral=a test assertion on the delivered follow-up line
Deferral: tests/preview/journal-deliver-all.test.ts:112 | not-a-deferral=a test assertion on the delivered follow-up line
Deferral: tests/preview/journal-deliver-all.test.ts:131 | not-a-deferral=a test assertion on the delivered follow-up line
Deferral: tests/preview/journal-deliver-all.test.ts:132 | not-a-deferral=a test assertion on the delivered follow-up line
Deferral: tests/preview/journal-deliver-all.test.ts:172 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-deliver-all.test.ts:173 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-due-loop.test.ts:1 | not-a-deferral=a test comment describing the deferred task under test, not a commitment by this change
Deferral: tests/preview/journal-due-loop.test.ts:24 | not-a-deferral=a test helper comment naming the already-answered deferral, not a commitment by this change
Deferral: tests/preview/journal-due-loop.test.ts:25 | not-a-deferral=a test helper parameter naming the already-answered deferral, not a commitment by this change
Deferral: tests/preview/journal-due-loop.test.ts:30 | not-a-deferral=a test variable naming the already-answered deferral, not a commitment by this change
Deferral: tests/preview/journal-due-loop.test.ts:47 | not-a-deferral=a test variable naming the already-answered deferral, not a commitment by this change
Deferral: tests/preview/journal-due-loop.test.ts:100 | not-a-deferral=a test assertion on the follow-up delivery, not a commitment by this change
Deferral: tests/preview/journal-due-loop.test.ts:136 | not-a-deferral=a test assertion on the follow-up delivery, not a commitment by this change
Deferral: tests/preview/journal-loop-declared-wait.test.ts:9 | not-a-deferral=the live check names D1b, D2 and D1c and reports that the reply carried no follow-up result; it opens no work
Deferral: tests/preview/journal-loop-declared-wait.test.ts:107 | not-a-deferral=the literal prefix the journal already emits when a reply carries a held result, asserted by the test
Deferral: tests/preview/journal-loop-fire.test.ts:61 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-loop-fire.test.ts:66 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-loop-fire.test.ts:90 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/journal-obligations.test.ts:1314 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
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
Deferral: tests/preview/journal.ts:1336 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
Deferral: tests/preview/journal.ts:2418 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
Deferral: tests/preview/journal.ts:2927 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
Deferral: tests/preview/journal.ts:2932 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
Deferral: tests/preview/journal.ts:4151 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
Deferral: tests/preview/journal.ts:5520 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
Deferral: tests/preview/journal.ts:8534 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
Deferral: tests/preview/journal.ts:10679 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
Deferral: tests/preview/journal.ts:10680 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
Deferral: tests/preview/journal.ts:10739 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
Deferral: tests/preview/journal.ts:10749 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
Deferral: tests/preview/journal.ts:10751 | not-a-deferral=Existing executable scheduling, retrospective follow-up, obligation protocol or fixture text; this merge adds no postponed implementation.
Deferral: tests/preview/live-sentinels.test.ts:77 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/live-sentinels.test.ts:142 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/live-sentinels.test.ts:222 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/live-sentinels.ts:70 | not-a-deferral=a code comment naming the episode's deferred status
Deferral: tests/preview/obligation-task-answer-live.test.ts:105 | not-a-deferral=test stub keyed on the product's fixed follow-up wording, not work this change defers
Deferral: tests/preview/obligation-task-answer-live.test.ts:109 | not-a-deferral=test stub review finding quoting a recorded deferral, not work this change defers
Deferral: tests/preview/obligation-task-answer-live.test.ts:111 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/obligation-task-answer-live.test.ts:113 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/obligation-task-answer-live.test.ts:166 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/realistic-recall.mjs:8 | not-a-deferral=the line lists the benchmark's existing scenario category named "reworded follow-up"; this change only appends a category to that list
Deferral: tests/preview/realistic-recall.ts:42 | not-a-deferral=the line is the type of the benchmark's scenario categories, one of which is named "reworded follow-up"; this change only appends a category
Deferral: tests/preview/reply-check.declarations.json:13 | not-a-deferral=describes the runtime declaration and review outcomes; this change promises no deferred work
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
Deferral: tests/preview/retrospective-duty-followup.test.ts:276 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
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
Deferral: tests/preview/retrospective-first-pass-fit.test.ts:324 | not-a-deferral=the identifier of that same list of deferred cases in the test
Deferral: tests/preview/retrospective-first-pass-fit.test.ts:325 | not-a-deferral=the identifier of that same list of deferred cases in the test
Deferral: tests/preview/retrospective-first-pass-fit.test.ts:326 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-first-pass-fit.test.ts:327 | not-a-deferral=the identifier of that same list of deferred cases in the test
Deferral: tests/preview/retrospective-first-pass-fit.test.ts:329 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-first-pass-fit.test.ts:333 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-live-failures-4.test.ts:10 | not-a-deferral=a comment quoting the recorded live refusal reason
Deferral: tests/preview/retrospective-live-failures-4.test.ts:50 | not-a-deferral=an assertion of the recorded live refusal reason
Deferral: tests/preview/retrospective-live-failures-4.test.ts:64 | not-a-deferral=an assertion of the owed-case disposition string; the case stays owed and owedCases/retrospectivePlan re-offer it
Deferral: tests/preview/retrospective-live-failures-4.test.ts:79 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-over-cap.test.ts:160 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-over-cap.test.ts:307 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-over-cap.test.ts:308 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective-snapshot-continuation.test.ts:104 | not-a-deferral=the identifier of the bounded deferral list the test writes to round-trip the reservation's named deferrals; test data, not a commitment; not changed by the change this record reviewed; listed only because repointing this record's report paths to the Studio copy (cint-L32) extends the checker's range for it to later merged commits, where reviews/cint-L31-change-review.md dispositions the same line
Deferral: tests/preview/retrospective-snapshot-continuation.test.ts:105 | not-a-deferral=the planner's existing omission reason text ('deferred to a later pass') reproduced as test data for that list; not changed by the change this record reviewed; listed only because repointing this record's report paths to the Studio copy (cint-L32) extends the checker's range for it to later merged commits, where reviews/cint-L31-change-review.md dispositions the same line
Deferral: tests/preview/retrospective-snapshot-continuation.test.ts:107 | not-a-deferral=the same list passed to the reservation row under test; not changed by the change this record reviewed; listed only because repointing this record's report paths to the Studio copy (cint-L32) extends the checker's range for it to later merged commits, where reviews/cint-L31-change-review.md dispositions the same line
Deferral: tests/preview/retrospective-snapshot-continuation.test.ts:162 | not-a-deferral=the older builds' omission reason text ('deferred to a later pass') reproduced as test data for the recorded pass shapes; not changed by the change this record reviewed; listed only because repointing this record's report paths to the Studio copy (cint-L32) extends the checker's range for it to later merged commits, where reviews/cint-L31-change-review.md dispositions the same line
Deferral: tests/preview/retrospective-snapshot-continuation.test.ts:189 | not-a-deferral=a comment naming the UNKNOWN disposition the test asserts ('Deferred cleanly'), behaviour recorded, not a commitment; not changed by the change this record reviewed; listed only because repointing this record's report paths to the Studio copy (cint-L32) extends the checker's range for it to later merged commits, where reviews/cint-L31-change-review.md dispositions the same line
Deferral: tests/preview/retrospective.test.ts:186 | not-a-deferral=a comment naming the accounting population of a pass, which includes the cases the pass itself deferred
Deferral: tests/preview/retrospective.test.ts:368 | not-a-deferral=a comment quoting the recorded live refusal reason
Deferral: tests/preview/retrospective.test.ts:401 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective.test.ts:485 | not-a-deferral=Test input or assertion describing recorded follow-up/deferred work behavior; not postponed implementation.
Deferral: tests/preview/retrospective.ts:59 | not-a-deferral=the same comment, same vocabulary
Deferral: tests/preview/retrospective.ts:61 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:144 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:156 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:169 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:407 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:408 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:696 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:709 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:788 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:795 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:796 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:809 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:810 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:811 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:812 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:815 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:818 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:820 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
Deferral: tests/preview/retrospective.ts:821 | not-a-deferral=Existing runtime terminology for bounded retrospective or obligation follow-up and its durable accounting; no implementation is postponed by this merge.
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
Deferral: tests/preview/summary-bound.test.ts:281 | not-a-deferral=a comment describing the live brake, not a commitment
Deferral: tests/register/live-rule-four-admissions.test.ts:58 | not-a-deferral=Assertion of the existing explicit deferred coverage classification for resource-funnel evidence; this merge adds no postponement.
Deferral: tests/register/live-rule-four-admissions.test.ts:63 | not-a-deferral=Assertion of the existing explicit deferred coverage classification for resource-funnel evidence; this merge adds no postponement.
Skip: tests/assembly/process-inventory.test.ts:158 | scope=the real-host sandbox reading needs macOS sandbox-exec and sandbox_check; it skips only on other platforms
Skip: tests/e2e/codex-answer-live.test.ts:33 | scope=a live case needs the real Codex CLI and a login home; it runs when INSTAR_CODEX_EXECUTABLE and INSTAR_CODEX_LOGIN_HOME name them and skips elsewhere rather than asserting an answer it never got
Skip: tests/e2e/codex-tool-turn-live.test.ts:89 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/e2e/codex-tool-turn-live.test.ts:109 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/e2e/codex-tool-turn-live.test.ts:128 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/e2e/model-gate-live.test.ts:29 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/e2e/session-work-live.test.ts:42 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/e2e/session-work-tmux.test.ts:100 | scope=Existing session integration requires a working tmux host.
Skip: tests/e2e/session-work-tmux.test.ts:115 | scope=Existing session integration requires a working tmux host.
Skip: tests/platform/macos-only.test.ts:42 | scope=fixture text written to a temporary file to prove detection of a darwin skipIf gate; no test in this repository is skipped
Skip: tests/preview/ask-anytime.test.ts:224 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/preview/ask-anytime.test.ts:261 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/preview/group-carry-cli.test.ts:12 | scope=the shipped process-limit shim and confinement contract are macOS-specific; the case ran and passed on the Studio (darwin) for this change, and is skipped only on other platforms
Skip: tests/preview/guidance.test.ts:352 | scope=Optional read-only live fixture capture requires the explicit copied journal and storage; recorded fixture replay runs without them.
Skip: tests/preview/operator-yes-live.test.ts:104 | scope=the live capture spends real model calls and runs only with INSTAR_OPERATOR_YES_LIVE=1; its recorded outputs are replayed by the always-on test in the same file
Skip: tests/preview/review-yes-live.test.ts:131 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/preview/review-yes-live.test.ts:224 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/preview/sensitivity.test.ts:385 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/preview/session-admission.test.ts:284 | scope=Existing confinement integration requires the host sandbox.
Skip: tests/preview/session-admission.test.ts:322 | scope=Existing confinement integration requires the host sandbox.
Skip: tests/preview/yes-batch-live.test.ts:375 | scope=Existing opt-in live capture or journal replay requires its declared provider/journal environment; the merge adds no skip.
Skip: tests/preview/yes-window.test.ts:222 | scope=runs only with a read-only COPY of the live journal and the vault storage key bound (INSTAR_YESWINDOW_ROOT, INSTAR_SECRET_PREVIEW_STORAGE_KEY); run and passed for this change, reported in the PROGRESS file

Deferral: generated/coverage.md:14 | not-a-deferral=Generated constitutional register coverage describes inherited rules and recorded prerequisites; no newly postponed repair work.
Deferral: generated/coverage.md:14444 | not-a-deferral=Generated constitutional register coverage describes inherited rules and recorded prerequisites; no newly postponed repair work.
Deferral: generated/coverage.md:14453 | not-a-deferral=Generated constitutional register coverage describes inherited rules and recorded prerequisites; no newly postponed repair work.
Deferral: generated/register.json:1 | not-a-deferral=Generated constitutional register coverage describes inherited rules and recorded prerequisites; no newly postponed repair work.

simplestRobustRoute: This is the simplest robust route: ordinary merge, append-only conflict resolution, existing desk regeneration, and targeted verification. Start guard is the clean named branch; end guards are a pushed clean commit and passing portable checks; existing safety and authority limits are unchanged. No new machinery or autonomous capability is added or claimed.
80/20: Run the briefed baseline tests, recorded refusal replay and cheap document, type, architecture, register and review checks. The Studio owns the full suite and live acceptance; no synthetic full-run report is created.
VERDICT: author submission; independent landing judgment remains with the desk
