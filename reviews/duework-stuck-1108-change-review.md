# Change review — Status names capacity shedding beside a held message

Subject base: 9baf68079dfe51deb3819d36201051170b013093
Review state: open
Reviewed content: none
Outcome: the status no longer hides why due scheduled work is not starting. Justin's agent showed 15 due work steps that never started, and the status said only "held: group disclosure refused". The real cause was the designed load shed: 9078 of 12000 model calls used is past the 75% mark, so obligationCapacity() is false, workObligations returns before starting and nextObligationAt arms no wake. loopHealth (tests/preview/obligations.ts) chose one inhibition reason, and a held oldest turn came before the capacity reason, so the shed was masked. Now the held reason and the capacity reason are computed separately and both are named, joined by "; ", and the capacity reason carries the measured count: "model-call capacity reserved for replies (9078 of 12000 calls used)". The higher-precedence reasons (stop, trial expired, model-call allowance used, reply allowance used) are unchanged. The two follow-on commits re-pin the changed test file's owner-reference hash (7f865c67d) and replay the register (4f9179ba8), both generated mechanically.
Affected rules: 13, 46, 64, 68, 74, 92, 101, 102, 116
Affected floors: secrets — unchanged; the status text adds only two integers (calls used, allowance); spend cap — unchanged; the shed threshold and obligationCapacity are not touched, the change is display-only; stop — unchanged; the stop still takes precedence over every other reason; no duplicate sends — unchanged; no send path changes; durable intake — unchanged; no store or intake change
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: a display-only change to one status string in the preview's loopHealth projection, plus its test pin and the mechanical owner-reference re-pin and register replay. No store, prompt, model-output parser, send path, shed rule or authority changes. The suggested critical tier reflects register-source and generated/ in the subject, which are mechanically regenerated, not authored.
Side effects: a status reader that matched the exact old string "model-call capacity reserved for replies" now sees the count appended, and a held-message reason may now be followed by "; " and the capacity reason. The only pinned reader is tests/preview/journal-obligations.test.ts, updated in this change.
Undo and recovery: revert commits e9565fc9a, 7f865c67d and 4f9179ba8; the status returns to naming only the first cause.
Multi-machine posture: machine-local; loopHealth reads the local journal view only; no shared state.
Layer below: obligationCapacity (tests/preview/journal.ts) and shouldRunScheduledPriority (src/scheduled/shedding.ts), which decide the shed and are read, not changed.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-obligations.test.ts
Hook bypass: none
Convergence: none
Decision: duework-name-both | name every cause holding due work (held message and capacity shed) instead of the first one, because the masked shed made a designed hold look like a stall; the design questions (lifetime vs rolling allowance for shedding, the 75% threshold) touch the spend-cap floor and were left to the operator | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/duework-stuck-1108-PROGRESS.md
Prompt review: no prompt, model call, model-output parser or model accept/escalate/refuse decision changes. The changed text is a deterministic status string.
Deferral: generated/register.json:1 | not-a-deferral=generated register output replayed from committed source, not prose authored by this change

1.x comparison: JKHeadley/instar 1.x src/monitoring/QuotaTracker.ts shouldSpawnSession (agent home checkout, base 5b36623a9) uses the same normal/elevated/critical ladder and every refusal returns a reason naming the measured percentage. 2.0 reuses that behavior by naming the shed reason with its count. Mismatch noted and not changed: 1.x measures a rolling account quota window; 2.0 measures a lifetime trial allowance.

Verification: replay on a read-only copy of the real journal snapshot through the changed loopHealth gives "held: group disclosure refused; model-call capacity reserved for replies (9078 of 12000 calls used)", dueWork 15. tests/preview/journal-obligations.test.ts 53/53 pass, including both sides of the decision (held plus shed names both; held with capacity names only the hold). npm run lint, npm run register:check and node scripts/check-architecture.mjs exit 0 on 4f9179ba8; ready-gate tests 8 files, 135/135 pass.

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-obligations.test.ts, tests/preview/obligations.ts

## Closing block

simplestRobustRoute: the required outcome is that the status names the real reason due work is held. The route computes the two existing reasons separately and joins them, adding the count the capacity check already uses. No new gate, store, configuration or change to the shed.
80/20: the observed masking is fully covered; the remaining question of whether a lifetime allowance should drive shedding is a spend-cap design decision recorded for the operator.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
