# Change review — record scope repair: an inherited line must be one the earlier record checked

Subject base: 020b8856fa179633e1cf10b27aad1c4436a70442
Review state: open
Reviewed content: none
Outcome: Repairs Astra's MF1 on unit-record-scope-1108 round 1. scripts/check-change-review.mjs inheritedHits exempted a Deferral/Skip hit from the current record whenever git blame named a commit inside an earlier record's range. That earlier record is checked on its endpoint diff (base..last), which can lack the line: a file its range deleted, and a later merge restored from a side parent, was answered by no record, and the checker printed OK. The existing range filter stays as a prefilter; a hit is now exempt only when the line is also carried unchanged from that earlier record's last commit (git blame <earlier last>..<record last> attributes it to that boundary) to a position that is one of the earlier record's own endpoint Deferral (or Skip) hits. Otherwise the hit stays on the current record. Applies to the shared Deferral/Skip path. Adds the restored-line case beside the unchanged-inheritance positive case. 1.x comparison is inherited from the unit's record (reviews/record-scope-1108-change-review.md, verified by Astra against JKHeadley/instar main 5bcc9c87a5ff755104855c5458a479e427146e8b: scripts/instar-dev-precommit.js scopes checks to the commit's own staged diff and skips merges; scripts/lint-deferral-carrier-resolvable.mjs ratchets only added markers). 1.x checks each commit's own added lines when they are written, so a restored line is answered at its own commit; this repair keeps 2.0's equivalent: a carried line is exempt only where an earlier record's checked diff held it.
Affected rules: 6 and 71 (a restored deferral is owed by the record whose diff restores it; no line falls between records), 37 (skips, the same shared path), 74 (coverage unchanged), 116 (one predicate tightened inside the existing checker; no new gate, ledger, field or file), 101 (plain git commit; no hook bypass), 102 (decisions recorded below)
Affected floors: secrets — untouched; spend cap — untouched; stop — untouched; no duplicate sends — untouched; durable intake — untouched
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: a landing gate's scope predicate; the change only adds demands back (lines the earlier record never checked), proven on both sides by the new refusal test, the existing inheritance tests, and a real-train replay.
Side effects: more strict than the reviewed head, never less strict than the base checker: an exemption now requires a second blame per earlier record that the first blame names, and one endpoint-diff scan per such earlier record (cached per record). These run only for hits with no row of their own. Replay on train-216 at 51b01d605 on the Mama PC took 3 min 27.6 s (wall clock), the same as the reviewed head's measured 3.5 min.
Undo and recovery: revert this commit; the checker returns to the reviewed head's range-only exemption.
Multi-machine posture: machine-local, deliberately: a read-only git check over the checked-out commit, identical on every machine that runs it.
Layer below: addedLines/addedLineHits (unchanged) give the earlier record's own endpoint hits, the same hits validateRecord demands of that record; records() ranges unchanged. Real-shape replay, base checker 455b23e7 vs this head on train-216 at 51b01d605: base shows 27 Rule 71, 4 Rule 37 and 11 Rules 12/27 carried-line errors; this head shows 0 of each, and every other line is identical (3 Rule 116 and 3491 host-only Rule 102 lines naming Studio paths in both).
Bug class: integration
Bug evidence: reproducer=tests/register/change-review-git.test.ts
Hook bypass: none
Convergence: none
Decision: record-scope-repair-boundary-blame | An inherited hit must trace, by git blame bounded at the earlier record's last commit, to a position in that commit that is one of the earlier record's own endpoint Deferral/Skip hits; range membership remains only a prefilter. A text match in the same file was rejected because an identical marker line elsewhere in the file would alias the restored one | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/record-scope-1108-repair-084110-PROGRESS.md
Decision: record-scope-repair-induction | The earlier record's endpoint hit is accepted as accounted for without requiring its own row, because that record is itself checked on the same hits under the same rule, and the chain ends at the earliest record, which has no earlier one to defer to; requiring an own row would re-demand the merge-carried lines the unit fixed | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/record-scope-1108-repair-084110-PROGRESS.md
Decision: record-scope-repair-strict-on-doubt | A renamed path, an unreadable blame or a line reaching the record by a path that bypasses the earlier record's last commit stays on the current record (the conservative side of a change-integrity gate, Rule 95) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/record-scope-1108-repair-084110-PROGRESS.md
Deferral: tests/register/change-review-git.test.ts:437 | not-a-deferral=fixture source text written into a throwaway repository to exercise the deferral detector; no work is deferred

Subject (2 paths): scripts/check-change-review.mjs, tests/register/change-review-git.test.ts

## Closing block

simplestRobustRoute: the required outcome is that a carried Deferral/Skip line is exempt only when an earlier record really answered it, and current changes stay as strict as the base. The simplest robust route keeps the unit's existing filter and replaces its ownership predicate with evidence the checker already has: one bounded git blame and the earlier record's own endpoint hits, computed by the same functions that check that record. No new gate, ledger or record format.
80/20: the one must-fix is repaired at its predicate with a refusal test that passes on the base and fails on the reviewed head; the existing inheritance tests and the train-216 replay show the original fix is kept.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
