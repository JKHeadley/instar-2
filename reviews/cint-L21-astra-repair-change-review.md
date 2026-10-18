# Change review — cint-L21 Astra repair: the claim-scoped floor withholds only the named claim

Subject base: b7d38a70042926b1dbfa00486e060d5853ce97bb
Review state: open
Reviewed content: none
Outcome: Astra's cint-L21 MUST-FIX 1 and 2 are repaired at their source in tests/preview/reply-check.ts (34af42b8). (1) `substantiveReply` judged any remainder shorter than 24 characters non-substantive, so a complete short answer ("At 7 PM.") that the reviewer did not object to was replaced by the holding notice. It is now an empty-remainder check: any nonempty surviving text goes through the existing credential, size and send checks, and only an empty remainder keeps the notice. `SUBSTANTIVE_MIN` is removed. (2) `segmentCarries` treated the first 24 normalized characters of a long quote as identity, so a complete quote deleted a different, unflagged sentence sharing its opening. That fallback is removed; a segment is carried only when it contains the whole folded quote or the quote spans it. A truncated quote still matches through its available text because `foldClaim` already strips a trailing ellipsis. Both of Astra's synthetic reproducers are now neighbor tests through the real journal worker in tests/preview/claim-scoped-floor.test.ts; both fail on the old source and pass on the new. The existing apostrophe, truncated-quote, degenerate-case and real recorded K2/K3 replays (updates 969389898, 969389899, with their recorded reasons verbatim) pass unchanged. The register was regenerated with --replay at 34af42b8 (d761eee1).
Affected rules: 4 (a gate withholds only what its recorded judgment named; no length or prefix heuristic adds a veto), 77 and 86 (the answer around a named claim reaches the operator), 2 and 42 (removed and unlocated claims are still recorded and counted), 37 (fixed at the source, no quarantine), 69 and 90 (register regenerated from committed sources with --replay, never hand-edited), 74 (this record), 101 (no hook bypassed; plain git commit), 116 (two deletions and one comparison; no classifier, model call or new threshold)
Affected floors: secrets — unchanged (a surviving remainder still passes the credential redaction check before it is sent); spend cap — unchanged (no new call); stop — unchanged; no duplicate sends — unchanged (one send by the existing path); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: two small corrections inside an existing reviewed preview floor that decide which sentences of a reviewed reply are sent; model-facing in effect, so not routine, but no new store, call, prompt, gate or authority path.
Side effects: a short surviving answer is now sent instead of the holding notice; a sentence that only shares its opening with a quoted claim is now kept. A reviewer quote that is truncated without an ellipsis and differs from the reply after its opening now reports as unlocated (recorded and counted) instead of removing a sentence.
Undo and recovery: revert 34af42b8, its register regeneration d761eee1 and this record to return to b7d38a70. Nothing persisted differs.
Multi-machine posture: machine-local: the single preview journal worker on the one preview machine.
Layer below: tests/preview/journal.ts claim-scoped floor block (unchanged; it calls `substantiveReply` then the existing redact and fits checks); reviews/w3-heldanswer-change-review.md and reviews/cint-L21-change-review.md (the unit and combine this repairs, carried unchanged)
Bug class: integration
Bug evidence: reproducer=tests/preview/claim-scoped-floor.test.ts
Hook bypass: none
Convergence: none
Decision: cint-L21-repair-empty-remainder | the length threshold was replaced by an empty-remainder check rather than a lower threshold or a classifier, as the review asks, because any threshold is a semantic veto the reviewer never made | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L21-PROGRESS.md
Prompt review: no prompt text changed; only which sentences of an already-reviewed reply are sent.
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/claim-scoped-floor.test.ts, tests/preview/reply-check.ts

## Closing block

simplestRobustRoute: this is that route: delete the length veto and the prefix fallback, keep the existing exact-containment and normalization paths, and add one neighbor test per defect.
80/20: 0 must-fixes, 1 note (targeted tests only, no full suite on this machine, per the operator's rule tonight)
VERDICT: author submission; the independent verdict is recorded as a pass
