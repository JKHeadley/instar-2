# Change review — w3-cancel3 repair 2: a held forget keeps its targets and never erases another open request

Subject base: 0e49c4d5b86e92fb87b55b98ff1773d825d99462
Review state: open
Reviewed content: none
Outcome: Repair of unit-w3-cancel3 round 2 (Astra, VERDICT NO, two must-fixes). (1) The held-forget branch in memoryFrom ran before the replies/summaryPassages/update checks and stored only mode/source/quote/trigger, so an applied held forget lost its validated replies and summary passages and a selected paraphrase stayed in later context. Now the branch only marks the item held; the item passes every existing check and the same complete MemoryChange goes to the held list instead of the applied list. Invalid targets still refuse the whole decision as before. (2) The release condition asked whether any dated item from the forget's source was cancelled, so cancelling the feeder released a forget of a message that also carried the plumber request, erasing it. Now a held forget is released only when every open request it would remove (activeDated's source-and-quote overlap) is cancelled by the admitted decision; otherwise it is kept and the operator is told, as for any kept forget. Both reviewer probes are added to tests/preview/cancel-not-forget.test.ts; on 0e49c4d5 they fail (2 failed, 5 passed), with this change 7/7 pass. Neighbouring files cancel-omitted-memory, cancel-path, journal-forget-property, credential-reminders, journal-requested-action: 44/44 pass.
Affected rules: 10, 57, 93, 116 (10 — the model still decides cancellation and forgetting; code only refuses to let a forget erase a request the decision did not withdraw; 57 — the held forget now passes the complete existing validator, as previously claimed; 93 — the forget is completed with all its targets, or the operator is told it was kept; 116 — reorders one branch and narrows one predicate, no new record, call or flag). Purpose constraints 2 and 3.
Affected floors: secrets — unchanged (no new text surface; kept-line quoting is the existing redact/clean path); spend cap — unchanged (no model call); stop — unchanged; no duplicate sends — unchanged (no send path touched); durable intake — unchanged (same summary and answer rows; the held list now carries the full validated change)
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: preview journal worker only; corrects which fields a held forget carries and when it is released. No authority, send path, prompt text or model call changes.
Side effects: a broad forget proposed alongside a narrower cancel is now kept (not applied) and the reply says the text was kept because a request is still open; previously it erased the uncancelled request.
Undo and recovery: revert 097608f5 and its register regeneration. heldForgets rows written by 1356bfb3 replay unchanged (the extra fields are optional on MemoryChange).
Multi-machine posture: single-machine preview runner; no shared, replicated or leased state touched.
Layer below: memoryFrom validation, openRequests/activeDated overlap, the answer's cancel admission, answer-row replay order (unchanged).
Bug class: user-facing
Bug evidence: reproducer=tests/preview/cancel-not-forget.test.ts; live=tests/preview/fixtures/cancel3-live-2026-10-03.json; restart=tests/preview/cancel-not-forget.test.ts
Hook bypass: none — no hook-override or bypass flag was passed to git; every commit was a plain git commit.
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: cancel3-release-on-full-withdrawal | release a held forget only when every open request it overlaps is cancelled by this turn's decision, reusing activeDated's overlap; NOT chosen: narrowing the forget's quote in code (code deciding meaning, Rule 10) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-cancel3-PROGRESS.md
Prompt review: no prompt text changed. Recorded shapes replayed: summary:715673211 output (fixture summaryOutputAtRa3) and recorded post-fix answer replays (fixture postFixReplays), update 715673211; the two new tests are the reviewer's synthetic neighbours of those shapes.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=regenerated register output; no work is deferred by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/w3-cancel3-repair2-change-review.md, tests/preview/cancel-not-forget.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: the held forget already existed; the fix moves its branch below the existing validation so it carries the same complete change, and replaces a source-only release test with the same overlap activeDated uses. No new record, call, prompt or flag.
80/20: 0 must-fix, 1 note — a kept broad forget is reported to the operator but not re-proposed; the operator can cancel the other request or ask again.
VERDICT: author submission; the independent verdict is recorded as a pass
