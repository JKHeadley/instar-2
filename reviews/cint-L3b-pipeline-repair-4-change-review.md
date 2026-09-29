# Change review — cint-L3b pipeline repair 4: briefing tests assert the one-line feature texts; R105 parity test gets its own ceiling

Subject base: f8fa3bec03ba0abb5fd3f2fb7c65ec50d2eaa038
Review state: open
Reviewed content: none
Outcome: Test-only repair. The capability-note source now carries one-line feature texts (the full descriptions live in the README Details lines), so the upcoming-date and memory-denial tests assert the generated one-liners instead of the old long descriptions. The R105 parity test re-hashes the whole composition closure for each of its nine drift cases (about 8 s alone) and exceeded the 10 s default under the loaded full suite, so it gets its own 60 s ceiling. No source, prompt or behavior changes.
Affected rules: 37, 74, 84, 116
Affected floors: secrets — unchanged, tests only; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: three test files change their expected strings or timeout; no source path changes
Side effects: none outside the test run
Undo and recovery: revert the commit; nothing durable changes
Multi-machine posture: not applicable, tests only
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md (read in full); the capability-note generator's one-line feature texts that the two preview tests now assert; scripts behind R105 whose closure hashing sets the test's cost
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none

## Closing block

simplestRobustRoute: The failures were stale expectations and a timeout on a bounded but heavy test. The source fix is to assert the text the generator actually emits and to give the one heavy test an explicit ceiling; no quarantine and no new mechanism (Rule 37).
80/20: tsc, the architecture check, lint and the three touched test files pass on this machine; the full suite reruns at the gate.
VERDICT: author submission; the independent verdict is pending
