# Change review — w3-jload: the preview journal load-timing quarantines, repaired at their cause

Subject base: 85b46430648ccb30cc58bac98ce0c03e9db821d4
Review state: open
Reviewed content: none
Outcome: two of the three quarantined preview journal cases are repaired and un-skipped; the third is diagnosed to a product defect outside this unit and stays visibly quarantined. journal-dated-memory "stores the Telegram turn-time date ... sends its absolute date once" and journal-audit "exits nonzero for a recorded packet without a verifiable provenance chain" each ran two journal-agent CLI children through blocking spawnSync, and a child's cost is almost all loader start-up. Measured per child: 0.36-0.40 s isolated with the transpile cache warm, 0.44-0.97 s beside a parallel preview suite (load 20-93), 2.4-2.9 s with the cache off (the quarantine predates the cache, 02753cdc), and 6.8-7.3 s with the cache off and normal-priority CPU burners (load 69-91). Under that last condition the unchanged, un-skipped cases failed exactly as recorded ("Test timed out in 10000ms"; the audit case at 15.8 s wall because spawnSync blocked the worker's own deadline). Both files now launch the CLI through one async helper (runAgent): the worker stays responsive, every child's observed time is printed, and a 120 s watchdog, sized above the worst recorded cold start (~50 s, full-suite-load-timeouts.md), is a hang detector that reports status null, never success. Case budgets are children x watchdog + 30 s. Every assertion is unchanged, including send-once across restart, exit status 1 and the no-body-leak checks. journal-assembled fails in about 36 ms with {"kind":"uncertain","stage":"child-exit"}. The cause is not a wait: the resource shim (scripts/resource-owner.mjs LIMIT_SCRIPT, lim) lowers the soft -u limit to the user's process count + 4 (scripts/production-boot-io.mjs) and then forks for $(ulimit -H -u). That fork fails with EAGAIN when other processes start in between: 6 of 40 bare launches failed during a parallel preview run. A shim variant that reads both limits before lowering either succeeded in 80 of 80 launches under a process storm. That file is not this unit's, so the case stays skipped with the diagnosis recorded.
Affected rules: 10, 34, 37, 43, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — still asserted: the dated-memory case keeps sends at 1, then 2, and still 2 after a restart, now executed by the gate instead of skipped; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: test-only change (two preview test files and a defect record, plus regenerated pins); no product source, prompt, provider policy or invocationPolicyDigest changes
Side effects: the two cases now run in the gate; each prints one line per CLI child with its observed time. A hung child is now reported after 120 s instead of 10 s.
Undo and recovery: revert these commits; the skips return with the previous record
Multi-machine posture: machine-local test fixtures; the record and the remaining visible quarantine travel with the repository
Layer below: scripts/slice-ts-loader.mjs (child start-up cost); scripts/resource-owner.mjs LIMIT_SCRIPT and scripts/production-boot-io.mjs transportProcessLimit (the assembled case's open cause, not changed here)
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-audit.test.ts
Hook bypass: none
Convergence: none
Deferral: tests/preview/journal-assembled.test.ts:15 | not-a-deferral=the case stays visibly quarantined under Rule 37 with its diagnosed cause and repair owner recorded in docs/defects/preview-journal-load-timing-flake.md; the fix lies in scripts/resource-owner.mjs, outside this unit, and is reported to the desk as BLOCKED for that case
Deferral: generated/register.json:1 | not-a-deferral=regenerated register output for the changed test pin; nothing is postponed

Subject (11 paths): docs/defects/preview-journal-load-timing-flake.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-audit.test.ts, tests/preview/journal-dated-memory.test.ts

## Closing block

simplestRobustRoute: replace the blocking spawnSync with one small async spawn helper per file (the U6 pattern), print each child's measured time, and size a watchdog to measurement instead of tuning a timeout; no shared helper, no product change, no assertion loosened (Rule 116; Rule 37 fixed at the source).
80/20: tsc --noEmit passes. The unchanged cases fail under the diagnosed load (cache off, CPU burners) and the repaired cases pass under the same load. They also pass twice beside a parallel preview suite under nice -n 10 (cache on and off), and twice in isolation. Deliberately broken inputs still fail: a readable journal gives exit 0, a wrong zone fails the check, and a watchdog kill reports null. The assembled cause is reproduced three runs out of three and its fix is proven in a scratch copy of the shim.
VERDICT: author submission; the independent verdict is pending
