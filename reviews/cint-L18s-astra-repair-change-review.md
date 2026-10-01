# Change review — cint-L18s Astra repair: a refused fulfillment claim no longer holds the reply

Subject base: 13101bc8dfe49a720f83db9f01b40fa4d1609dbb
Review state: open
Reviewed content: none
Outcome: Astra's cint-L18s MUST-FIX 1 is repaired at its source. The writer records a fulfillment claim the support rule refused as `rejected.fulfills`, and the replay projects that row field to `turn.answerRejected`. Three existing admission sites read any `answerRejected` as a refused deferral, blocker or recheck: the operator-echo shortcut was skipped, the paid contextual review was forced in place of Jev, and an unavailable (or violating) review became a mandatory hold. So a harmless reply carrying one unsupported fulfillment annotation was held with zero sends when the reviewer was down. Now one predicate, `refusedObligation`, names what keeps that floor: a refused loop, blocker or recheck. A fulfillment-only refusal is still refused, still counted in `rejectedObligations`, still closes no commitment and still replays, but its reply takes the ordinary review route (echo shortcut, Jev, escalation only on Jev's own signal), where an unavailable review is a signal released with the reply. An answer that carries both a refused fulfillment and a refused deferral keeps the mandatory review and hold. The status line no longer says every refused declaration was sent only after a full review. This corrects two statements in reviews/cint-L18s-change-review.md that were too broad before this repair: "still sends the reply in full" and "no extra model call" are true of a fulfillment-only refusal only from this commit on.
Affected rules: 77 and 95 (reachability fails open: an unavailable review no longer silences a reply over a refused fulfillment claim), 86 (a refused annotation is a signal, never a blocking authority; the secrets exception is untouched), 6, 20, 21 and 23 (build 4's obligation floor is kept for refused deferrals, blockers and rechecks, proven by the neighbor in the same test and by tests/preview/operator-echo.test.ts), 2 and 10 (the refused claim stays counted and visible and still closes nothing), 4 (the status wording now matches what the runner does), 74 (this record), 106 (the recorded proof-room row replayed through the worker with reply review wired, and Astra's reproducer re-run), 69 and 90 (register regenerated with --replay, never hand-edited), 116
Affected floors: secrets — unchanged (the credential-shape floor, Jev's credential flag and a review naming a credential hold exactly as before; the predicate is read only where the obligation floor was read); spend cap — unchanged in bound, lower in use (a fulfillment-only refusal no longer forces a paid contextual review; every call still reserves inside the existing call cap); stop — unchanged (same gate() calls); no duplicate sends — unchanged (the released reply sends once through the existing intent and receipt path; a held turn is still skipped by the drain); durable intake — unchanged (no row shape, field or validation changed)
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a preview-runner fix that narrows which existing field value reaches an existing hold decision; no new store, call, gate, classifier or authority path, and no row shape change. It is on the send path, so it is not routine.
Side effects: a reply whose only refused declaration is a fulfillment claim is now checked like any other reply: the operator-echo shortcut and Jev apply, the paid review runs only if Jev escalates, and an unavailable review releases it with the signal recorded. The reviewer, when it does run, still sees the refused count in its declared record. A turn already held as `reply check unavailable` by the earlier build stays held; nothing re-sends it.
Undo and recovery: revert cbfba4b5, its register regeneration f25c9131 and this record. No journal row differs between the two builds, so a root written by either opens under the other.
Multi-machine posture: machine-local: the single preview runner
Layer below: reviews/cint-L18s-change-review.md and reviews/w3-fulfills-studio-change-review.md (the fulfillment refusal this repairs); the reply-review admission and holding block in tests/preview/journal.ts and its existing proofs in tests/preview/operator-echo.test.ts (refused deferral stays held; echo and credential paths), re-run on this tree
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-fulfills-support.test.ts
Hook bypass: none
Convergence: none
Decision: cint-L18s-keep-field-narrow-readers | `turn.answerRejected` keeps the whole refused record (the unit's tests and the reviewer's declared record read it) and the four hold-path readers ask one predicate instead; dropping `fulfills` from the projected field would have hidden the refusal from the reviewer and from inspection | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L18s-PROGRESS.md
Decision: cint-L18s-status-wording | the status line said each refused declaration was sent only after a full review, which this repair makes untrue for a refused fulfillment claim, so its wording was corrected in tests/preview/obligations.ts (a file the must-fix did not name) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L18s-PROGRESS.md
Prompt review: no model-facing prompt text changed. One operator-facing status line changed: "Declared obligations I could not record: N" now ends "(a refused deferral or limit is sent only after a full review; a refused completion claim closes nothing)", a factual statement of what the runner does.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change (as dispositioned in the carried record)
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as dispositioned in the carried record)
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as dispositioned in the carried record)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-fulfills-support.test.ts, tests/preview/journal.ts, tests/preview/obligations.ts

## Closing block

simplestRobustRoute: one predicate read at the four existing hold-path sites, so only a refused deferral, blocker or recheck keeps the mandatory review and hold; no new store, gate, classifier, call or row field
80/20: 1 must-fix repaired, 0 open; targeted tests only (the full gate reruns on the Mama PC)
VERDICT: author submission; the independent verdict is recorded as a pass
