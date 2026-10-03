# Change review — w4-guidance Astra repair: a guidance correction counts as landed only with the send receipt

Subject base: cd7fbf008cb32df13d0ad54b790022ce206faf77
Review state: open
Reviewed content: none
Outcome: Plan row #403, Astra unit review MUST-FIX 1. guidanceVerdicts read `turn.release` as the send, but the journal writes the release on the intent row before dispatch, so a revised or excised selection whose send crashed, was refused or ended UNKNOWN was counted as a landed correction. Now a sent landing (revised, excised, unlocated, unchanged) needs the turn's send receipt (`turn.sent`, the leader's for a grouped turn); an intent with no receipt is landing `no-receipt` with its selection kept in `selected`, and guidanceQuality counts it separately, never as landed. Held and unrecorded are unchanged. The capture now keeps `sent` and `groupedInto`; the existing fixture kept no receipt, so its rows read as no-receipt (older missing evidence stays unknown) and the fixture assertions say so. The real-worker revision test gains its failed-send neighbor (send port throws 'transport outcome unknown'): the reopened durable turn has release.revised true, no receipt, and projects as fired, accept, no-receipt, selected revised. Part 18 §16's measurement rule states the receipt condition.
Affected rules: 58 (graded against what actually happened: a landing needs the receipt), 26 (the real delivery state is checked, not the intent), 13 (a selection count no longer stands for a delivered-correction count), 42 (an intent with no receipt is not acceptance), 9, 39, 41, 116 (projection from records the journal already keeps; no store, no new mechanism), 36 and 106 (the recorded fixture replays; its missing receipts are reported honestly), 37 (fixed at source, no quarantine), 66, 69, 90 (register replayed, not hand-edited), 74 (this record), 101, 102
Affected floors: secrets — unchanged (no secret in any fixture or test); spend cap — no model call added, no prompt text changed; stop — unchanged; no duplicate sends — unchanged, the measurement never retries or sends; durable intake — unchanged, no row kind or field added (the capture copies an existing Turn field).
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: carries the unit's critical tier; this repair itself is measurement-only.
Side effects: the runner's read-only guidance status record now carries a `no-receipt` landing count per member; on journals whose replies have receipts the counts are as before.
Undo and recovery: revert the repair commits (fix, owner-manifest rehash, register replay, this record, the Part 18 changelog revision 4).
Multi-machine posture: machine-local preview runner, unchanged.
Layer below: reviews/w4-guidance-change-review.md (the unit, carried unchanged). Checked one layer down: `turn.sent` is set only from the transport receipt (the same field sendTarget/sendOutcomeOf read for Rule 42), so it is the one existing delivery evidence.
Bug class: none
Bug evidence: none
Hook bypass: none (plain commits; core.hooksPath is unset)
Convergence: none
Decision: w4g-repair-receipt-landing | a sent landing requires the existing send receipt; an intent without one is no-receipt with its selection kept beside it, instead of a new delivery store or a sendOutcomes lookup, because the receipt is already the journal's acceptance evidence and the projection only has turns | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-guidance-PROGRESS.md
Decision: w4g-repair-fixture-unknown | the fixture is not recaptured: it predates receipt preservation, so its rows read as no-receipt and the assertions state that; future captures keep sent and groupedInto | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-guidance-PROGRESS.md
Prompt review: no model-facing change: the repair changes only the measurement projection, its tests and the §16 rule text; no prompt, parser or accept/escalate/refuse decision is touched.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (14 paths): docs/18-sentinel-holders.changelog.json, docs/18-sentinel-holders.changelog.md, docs/18-sentinel-holders/16-the-guidance-sentinel-family.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, reviews/w4-guidance-astra-repair-change-review.md, tests/preview/guidance.test.ts, tests/preview/guidance.ts

## Closing block

simplestRobustRoute: qualify the existing landing projection with the existing send receipt; no new storage, delivery mechanism or model call. This is that route.
80/20: 1 must-fix fixed with both sides proved (receipt present → revised; send throws → no-receipt); targeted tests only, the pipeline runs the full suite.
VERDICT: author submission; the independent verdict is recorded as a pass
