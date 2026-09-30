# Change review — w3-bootctx: the installed production bin boots (Rule 37 quarantine closed)

Subject base: 85b46430648ccb30cc58bac98ce0c03e9db821d4
Review state: open
Reviewed content: none
Outcome: the installed-bin case in tests/assembly/production-boot-public-entry.test.ts was quarantined for "production boot refused: Cannot read properties of undefined (reading 'ctx')". Diagnosed from the child's stack: the TypeError came from the test installation host (tests/assembly/production-boot-bin-host.ts checkpoint -> tests/assembly/production-boot-checkpoint.ts recordedCheckpoint) reading installed state on the reference-only initial-capture-durable checkpoint that a5a734fc added; the public boot boundary correctly turned it into a refusal. 11513eb7 already repaired the host at the source, after cint-1 and cint-L2 were cut, so the skip was never lifted. The case fails on 11513eb7^ and passes on 11513eb7 and on cint-L5. This change removes the skip and closes the defect record with the cause and evidence. No production code changed.
Affected rules: 37, 42, 43, 44, 45, 116
Affected floors: secrets — untouched, test and defect record only; spend cap — untouched; stop — untouched; no duplicate sends — untouched; durable intake — untouched, the case proves the installed bin admits Part Four
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: removes a test skip and updates a defect record; no source, script or bin change
Side effects: the installed-bin boot case runs in the gate again
Undo and recovery: revert this commit (re-quarantines the case); no durable format changes
Multi-machine posture: machine-local test; the record and the case travel with the repository
Layer below: docs/01-the-rules.md rows 37, 42, 43, 44, 45, 116; docs/00-the-purpose.md; bin/instar-production.mjs; scripts/production-boot.mjs; src/assembly/production-application.ts
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-boot-public-entry.test.ts
Hook bypass: none
Convergence: none
Deferral: none | not-a-deferral=no deferred work; the quarantine is closed, not moved

Subject (3 paths): docs/defects/production-boot-public-entry-ctx.md, reviews/w3-bootctx-change-review.md, tests/assembly/production-boot-public-entry.test.ts

## Closing block

simplestRobustRoute: the cause was already repaired at its source in the fixture host; lifting the skip and recording the diagnosis is the whole remaining change (Rule 116), with no new machinery.
80/20: installed-bin case fails on 11513eb7^ and passes on 11513eb7 and cint-L5; its sibling and the installed-executable refusal case pass; tsc, lint, register:check and architecture checks pass.
VERDICT: author submission; the independent verdict is recorded as a pass
