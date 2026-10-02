# Change review — w3-confinenext pipeline repair: carry the snapshot-format repair; a failed install no longer claims nothing was activated

Subject base: 6d4a0097e35e9289c05e79a2a49190c9859ff67f
Review state: open
Reviewed content: none
Outcome: Plan row #289, w3-confinenext review round 1, two MUST-FIXes. MUST-FIX 1: this head lacked the cint-L29 snapshot-format repair, so a cint-L28 compacted snapshot kept its format-2 summary brake while raw replay of the same rows dropped it. The repair already written on w3-summarybound (806d0c11, its register replay a58cfd9a and its review record 02b9dd75) is merged in unchanged (eeb1e7e6, a clean merge); its own record covers the content. tests/preview/summary-bound.test.ts 14/14 on this head, including the cint-L28 raw/snapshot upgrade pair and the current-format neighbor that stays braked across compaction. MUST-FIX 2: admin-install and install set RECOVERY to "nothing was activated", and that text was printed after execute_plan had already bootstrapped the service (a failed step, or a failed end-state verify). RECOVERY now says earlier steps may have completed and the service may be loaded, to inspect the state with verify and reverse it with the supplied uninstall plan. The three admin-install refusals that come before execute_plan (custody, plan digest, feasibility) keep "nothing was run / nothing was installed", which their order proves, and no longer append the post-install recovery text. The native test now requires the new wording on the install plan's recovery line and the admin-install preview, and that "nothing was activated" is absent; tests/assembly/fixed-worker-monitor-native.test.ts 13/13, foreground and unprivileged. The release was re-staged (8ce588aa…, 491 files) and the install plan digest recomputed (6c27ae9b…); the operator note and command in the progress record carry the new fingerprints and a corrected step 5.
Affected rules: 44, 96 and 55 (the merged snapshot-format repair; see reviews/w3-summarybound-snapshot-format-change-review.md), 26 (the recovery text states what may be true after a failure, not what is hoped), 74 (this record), 95 (a failure report no longer hides that the service may be loaded), 116 (wording only; no rollback machinery added), 37 (fixed at the source, no quarantine)
Affected floors: secrets — unchanged (no key handling changed); spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (nothing is sent); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a merge of an already reviewed repair plus a wording change in the installer's failure text; no enforcement, bound, authority or install step changes.
Side effects: the installer travels inside the release, so the staged release digest and therefore the operator's command change; the install plan digest also changes because the plan prints its recovery line. No host has the monitor installed, so nothing needs migrating.
Undo and recovery: revert 9645e6ed and the merge eeb1e7e6 (with this record) and replay the register.
Multi-machine posture: machine-local; the installer runs per Mac, and the summary restore path is the same on either machine.
Layer below: execute_plan (each line runs in order; a failure stops with FAILED at and the RECOVERY text), launchctl bootstrap inside the install plan, verify; for the merge, restoreSnapshot and the summary-failed reducer as recorded in the w3-summarybound snapshot-format record.
Bug class: integration
Bug evidence: reproducer=tests/assembly/fixed-worker-monitor-native.test.ts
Hook bypass: none
Convergence: none
Decision: w3cn-merge-summarybound | merge origin/w3-summarybound (806d0c11, a58cfd9a, 02b9dd75) rather than cherry-pick, so the reviewed commits and their record land unchanged | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-confinenext-PROGRESS.md
Decision: w3cn-recovery-wording | correct the recovery text instead of adding automatic bootout on failure, because the reviewer asked for truthful reporting, and the supplied uninstall plan already reverses a partial install | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-confinenext-PROGRESS.md
Prompt review: no prompt, question or model-output reader changed by this repair; the merged journal.ts change is reviewed in its own record.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (14 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/provision-fixed-native-worker.sh, tests/assembly/fixed-worker-monitor-native.test.ts, tests/preview/README.md, tests/preview/fixtures/summary-format-L28-compacted.encrypted, tests/preview/fixtures/summary-format-L28-raw.encrypted, tests/preview/journal.ts, tests/preview/summary-bound.test.ts

## Closing block

simplestRobustRoute: the required behaviour is a snapshot that restores the same brake raw rows give, and a failure report that is true whatever step failed. The simplest route is to bring in the already reviewed snapshot repair unchanged and to reword one recovery string, keeping the stronger claim only where the order proves it.
80/20: 0 must-fixes, 1 note (installed enforcement still needs the operator's root install; this changes only what a failure reports)
VERDICT: author submission; the independent verdict is recorded as a pass
