# Change review — restore shipped-path regression harnesses

Subject base: f2abc0de2089199396aed14fb30c4e8a8f9cb8e3
Review state: open
Reviewed content: none
Outcome: Repair extracted-send wiring, activation-notice recognition and historical census overflow reproduction; production behavior is unchanged. Native host verification remains owed.
Affected rules: 34, 37, 70, 74, 101, 102, 113, 116
Affected floors: secrets — no credentials or live calls; spend cap — offline fixtures only; stop — existing assertions preserved; no duplicate sends — existing send/recovery assertions preserved; durable intake — existing journal/replay assertions preserved
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Three regression harness corrections with no production edits or authority change.
Side effects: Temporary bounded child processes and fixture directories; exact child handles are cleaned up. No production roots or serving logins used.
Undo and recovery: Revert this repair commit; production behavior and persisted formats are unchanged.
Multi-machine posture: Source edits are portable. Native resource-owner and launcher lifecycle verification still requires a compatible gate host; WSL results are reported without claiming a pass.
Layer below: The extracted shipped send body calls replyFormatting; bind its real implementation. Historical census overflow must request historical args columns, while the real compact census still inventories every fixture PID.
Bug class: test harness drift
Bug evidence: Assigned f2abc0de fast log reports ten group-carry failures from missing replyFormatting, two rejected activation notices, and one census overflow assertion against compact comm columns.
Hook bypass: none
Convergence: none
Decision: carryover-95-repair-213556-harness | Repair the three harness mismatches without changing production behavior or weakening send, review or resource settlement checks. Include scrubbed launch refusal records in canary diagnostics. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-213556-PROGRESS.md

Decision: carryover-95-repair-213556-pins | Refresh the census test artifact hash with the supplied desk rehash tool, then regenerate the register from the committed source; no authority or manifest population changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-95-cartographer-1105-repair-213556-PROGRESS.md

## 1.x comparison

Fetched actual JKHeadley/instar main 13e4f75507520aa6c43c0aec006b7ec2fbd28332; searched src/, docs/specs/ and file history. src/monitoring/ExternalHogProcTable.ts and ExternalHogRealAdapters.ts use compact comm= for whole-table inventory, and args= only for a candidate. docs/specs/external-hog-zombie-autokill-sentinel.md describes the same compact inventory. Available shallow file history resolves to 2aaac4288, not a claim about earlier evolution. docs/specs/TESTING-INTEGRITY-SPEC.md and ONEX-LESSONS.md testing/resource sections support binding real assembly dependencies, replaying captured shapes, and bounded test concurrency. Fit: preserve the compact 2.x production census and repair its historical argv regression. Mismatch: no sentinel implementation port or production buffer increase is needed. Existing recorded-answer replay remains unchanged (proofroom-summary-cascade-stall-2026-09-30.json, update 715672480).

## Validation and derived outputs

Typecheck and build passed. Group carry: 30/30 passed. Activation-notice positive/negative boundaries passed. Final census replay passes historical overflow, compact-size and complete PID assertions before native execution returns 125; `/bin/sh -c 'ulimit -S -u'` confirms this WSL shell rejects the launcher's option. Canary diagnostic records `preview: bot identity refused` before the changed notice assertion. Native assertion failures remain blocking; this review claims no lifecycle pass. Desk rehash changed only preview.json's census artifact hash. Register replay from a301cfa9b073d5a5b41eb25c7a5026b2519d2508 refreshed generated capabilities.json, capabilities.md, coverage.md, glossary.md, register.json, rules.md and source.json. These seven files carry derived source/generation identities, not new authority.

## Closing block

simplestRobustRoute: Bind the missing real helper; accept exactly the shipped activation notice alongside existing notices while preserving the exact answer; explicitly reproduce legacy argv overflow and retain the current census and settlement assertions. Nine children and split arguments make the overflow fixture survive Linux's argv limits. No new runtime mechanism.
80/20: These local corrections cover the supplied failures; unrelated product/platform redesign is excluded. Targeted checks and gate-host limitations are recorded in the report.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
