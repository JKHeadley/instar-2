# Change review — cint-L16: cint-L15 plus w3-r95

Subject base: e2ff5dbe0e7037f1a4d839dd98886781689113df
Review state: open
Reviewed content: none
Outcome: The next live build is cint-L15 (e2ff5dbe) with origin/w3-r95 (cdd3755d) merged by an ordinary merge; w3-r95 was built on cint-L15, so the merge fast-forwarded with no conflict and nothing was hand-edited. w3-r95 makes the operator-reply and requested-action pipelines take their declared fail direction from the one live gate-table entry 'pre-send reply review (Jev and full-context)' (open, per Rule 95: reachability fails open) instead of restating a stale 'closed', so the declaration agrees with the behaviour the live proof room observed (O95d); behaviour and the credential floor are unchanged and pinned by its test. The desk chain ran as recorded for cint-L15: the inventory repin refreshed nothing; tsc built clean; the owner-reference rehash refreshed one pin (register-source/owner-references/part-nine.json, the pin trailing tests/preview/proofs.test.ts that w3-r95's report left for the desk) → 588ade3e; the register was regenerated with --replay at that commit → c99af3cc. At the w3-r95 builder's request, its two Decision lines' reported= path was repointed from the Mama PC path to the desk's copy of the same report (lanes/w3-r95-PROGRESS.md, copied unchanged); nothing else in its record changed. The unit's own record is otherwise carried intact.
Affected rules: 74 (this record; the w3-r95 record carried), 102 (w3-r95's two decisions reported: its Mama PC report placed at lanes/w3-r95-PROGRESS.md unchanged and its reported= lines repointed there), 95 (the operator-reply direction is declared once and agrees with behaviour), 77, 14, 86, 4, 2 and 66 (as in the carried record), 69 and 90 (register regenerated from committed sources with --replay, never hand-merged), 106 (the unit's recorded-shape replays re-run on the merged tree), 116
Affected floors: secrets — unchanged (the credential wall, a confident Jev credential flag and a review naming a credential still hold, pinned by the carried test); spend cap — unchanged (no new call); stop — unchanged; no duplicate sends — unchanged (no send path touched); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: the combine carries one reviewed preview unit (declared significant in its own record) by fast-forward, plus the desk pin rehash and register regeneration; no decision logic, send, intake, approval or authority path is changed by the merge
Side effects: as recorded in the carried record (status stepCoverage for operator-reply and requested-action reads 'open' with corrected owner sentences); none added by the merge
Undo and recovery: revert the w3-r95 commits, the pin rehash, the register regeneration and this record; see the unit's record for its own undo notes
Multi-machine posture: machine-local, as in the carried record: the single preview runner
Layer below: reviews/cint-L15-change-review.md (the base, carried); reviews/w3-r95-change-review.md (carried)
Bug class: live-path
Bug evidence: reproducer=tests/preview/fail-direction-agreement.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/live-proof/results/O-proofroom-20260930-220749/status-o1.json
Hook bypass: none — this is the cint-L16 desk run's own statement about its own commits, left as recorded. It does not cover the two carried w3-r95 commits, ab5f05d4 and cdd3755d, which this build contains by fast-forward: both were made on the Mama PC with git -c core.hooksPath=/dev/null, with no prior operator ask and no disclosure at the time, on a clone where no commit hook was installed. That bypass is recorded as an unauthorized Rule 101 violation, with the operator's disposition pending, in reviews/w3-r95-change-review.md
Convergence: none
Prompt review: no prompt text changed
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, not changed by the change this record reviewed and not changed by its Rule 101 correction; listed only because correcting this record's Hook bypass line (plan #203) extends the checker's range for it to later commits that touch journal.ts, where reviews/cint-L18s-astra-repair-change-review.md dispositions the same finding
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, not changed by the change this record reviewed and not changed by its Rule 101 correction; listed only because correcting this record's Hook bypass line (plan #203) extends the checker's range for it to later commits that touch journal.ts, where reviews/cint-L18s-astra-repair-change-review.md dispositions the same finding
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, not changed by the change this record reviewed and not changed by its Rule 101 correction; listed only because correcting this record's Hook bypass line (plan #203) extends the checker's range for it to later commits that touch journal.ts, where reviews/cint-L18s-astra-repair-change-review.md dispositions the same finding
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/part-nine.json, tests/preview/fail-direction-agreement.test.ts, tests/preview/proofs.test.ts, tests/preview/proofs.ts

## Closing block

simplestRobustRoute: merge the reviewed unit as it is and run the standard desk tools; no checker edit and no new mechanism
80/20: 0 must-fixes, 1 note (targeted tests only; the full gate runs elsewhere)
VERDICT: author submission; the independent verdict is recorded as a pass
