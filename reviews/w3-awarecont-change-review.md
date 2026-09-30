# Change review — w3-awarecont: the continuity case observes the answer after each marker; its quarantine closes

Subject base: 85b46430648ccb30cc58bac98ce0c03e9db821d4
Review state: open
Reviewed content: none
Outcome: The awareness-continuity case (a compacted or respawned session comes back with identity, recent conversation and open work, and carries on) is un-quarantined. The cause is confirmed in the test's observation, not in the grounding. The stand-in prints its marker (REGROUNDED, COMPACTED, BOOTED) before its answer, and the test asserted on the pane as soon as the marker appeared. Reproduced naturally, 1 of 40 runs under parallel preview load, with the recorded pane ending at REGROUNDED. Also reproduced mechanically: a 600 ms pause between marker and answer fails every time. expectGrounded(session, marker) now waits, bounded at 100 x 50 ms, for the complete CARRYING ON line after the last occurrence of the step's marker. It asserts that line is the unanswered user message, together with the delivered context. it.skipIf(!available) is restored and the defect record is closed with the evidence.
Affected rules: 34 (still fails when grounding is missing, late, or answered-before: four reverted mutations fail), 37 (source fix of the race, no re-quarantine, no raised timeout), 47 (startup and post-compaction grounding are both asserted as the answer, the compaction step's pane check is no longer satisfied by scrollback), 110 (the re-grounded session answers the last inbound message), 116 (smallest change: the test waits for what it asserts; the stand-in and the hook are unchanged)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (the case still asserts exactly one re-ground delivery); durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: one e2e test's observation helper and its defect record; no product code, system prompt, provider policy or invocationPolicyDigest change
Side effects: the gate now runs this case wherever tmux is available; it adds about 4 s
Undo and recovery: revert this commit; the case returns to the quarantined it.skip and the record to OPEN
Multi-machine posture: machine-local test; the record travels with the repository
Layer below: tests/e2e/awareness-fake-harness.mjs marker-then-answer output (unchanged); scripts/session-hooks/grounding.mjs (unchanged)
Bug class: integration
Bug evidence: reproducer=tests/e2e/awareness-continuity.test.ts
Hook bypass: none
Convergence: none
Decision: w3-awarecont-test-side | repaired in the test, not the stand-in: the stand-in's marker-then-answer order is correct behaviour, and the test was the party asserting before observing | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-awarecont-PROGRESS.md
Skip: tests/e2e/awareness-continuity.test.ts:22 | scope=skipIf(!available): the case needs a tmux binary and reports itself skipped where none exists
Deferral: docs/defects/awareness-continuity-respawn-flake.md:1 | not-a-deferral=a closed defect record; nothing is postponed by this change

Subject (2 paths): docs/defects/awareness-continuity-respawn-flake.md, tests/e2e/awareness-continuity.test.ts

## Closing block

simplestRobustRoute: the required outcome is a gate that proves the re-grounded answer, reliably. The simplest route is for the test to wait, bounded, for the answer it asserts, after the marker of the step it checks. That is this change. Changing the stand-in or adding synchronisation machinery would prevent no failure this route leaves open.
80/20: 0 must-fix, 0 notes — test helper and defect record only
VERDICT: author submission; the independent verdict is recorded as a pass
