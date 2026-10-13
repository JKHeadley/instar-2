# Change review — preserve revised blocker admission refusal

Subject base: 0b61a8f6bcedda066aaa4203369463827e9c1cbb
Review state: open
Reviewed content: none
Outcome: A changed revision retaining an invalid declared blocker cannot be released by the recorded PASS with no current blocker. A revision withdrawing the declaration remains eligible for contextual review, and a corrected record still permits delivery.
Affected rules: 4, 10, 20, 21, 23, 36, 42, 55, 57, 74, 75, 86, 95, 99, 101, 102, 103, 108, 113, 116
Affected floors: secrets — unchanged redaction, credential review and send checks; spend cap — existing one revision/review and shared call/deadline allowance; stop — existing call and send gates; no duplicate sends — unchanged durable intent and receipt with duplicate-drain tests; durable intake — retained original answer and appended admission refusal in the existing journal
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Final selection of a model-authored revision now retains exact blocker admission refusal.
Side effects: One optional true-only journal field retains rejected revision admission across reopen. Old rows remain readable without the field; previously discarded admission evidence cannot be reconstructed. Reviewed PASS remains unchanged and separately observable. All decision report paths point to the brief's mandated desk report, and Rules 86/95 are included in its accounting. Register publications are regenerated against commit 240caaf29d20ed999e5377c749390e3938368d62; use the delegated repin tools, never hand-edit pins.
Undo and recovery: Revert this repair and regenerate register publications. No new store or migration; existing revision rows are compatible with the optional field. A rollback restores the demonstrated leak and is not a correction for it.
Multi-machine posture: Conversation-owner-local selection against the existing durable journal. Reopen retains refused admission; ownership, replication and outbound transport do not change. No peer dependency is introduced.
Layer below: obligationsFrom and validBlocker establish exact admission, declaredObligations provides current admitted and settled records, journal projection preserves the refusal, and the existing reservation and sentObligations paths retain bounds and rechecks.
Bug class: integration
Bug evidence: reproducer=tests/preview/blocker-refusal-recorded.test.ts
Hook bypass: none
Convergence: none
Decision: blocker-refusal-recorded-1012-revision-floor | Retain exact revision admission rejection in the existing durable row and reuse the missing-record predicate at candidate selection; withdrawing the declaration keeps the contextual route | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/blocker-refusal-recorded-1012-PROGRESS.md
Prompt review: No model instructions or parsing protocol changed. D4 update 46039927's captured writer and review pass through the existing readers; synthetic changed-text neighbors exercise invalid admission, valid correction and withdrawal. The final selector enforces the exact rejected record rather than classifying prose. Raw review PASS remains independently visible.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged journal protocol text; no added phrase classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged journal protocol text; no added phrase classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

## Closing block

simplestRobustRoute: This is the simplest robust route: retain the already-computed rejection in the existing revision row and reuse the existing missing-record predicate at the final selector. One optional field is necessary because a local variable would lose rejection on restart. No new call, loop, tool restriction or store. Start guard is exact rejected admission with no current record; end guard is the existing candidate selection and send intent; limits remain the existing call cap, deadline and stop. Evidence is recorded-case replay, not a new live-deployment claim.
80/20: The changed-invalid-record test fails on the reviewed head and passes with this repair. Valid changed correction, withdrawal, unchanged invalid correction, deadline, call cap, credential precedence, duplicate drain and durable reopen cover both directions. Independent acceptance remains the desk's gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
