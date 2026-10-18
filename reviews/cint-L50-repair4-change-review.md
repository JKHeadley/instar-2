# Change review — cint-L50 repair 4: the dark rungraph core's graduation deadline, and the gate's default test deadline

Subject base: 675445463de74808368e2d64049e66fc9b526158
Review state: open
Reviewed content: none
Outcome: The Studio gate at 67544546 failed eight tests, from two causes. (1) tests/e2e/register.test.ts fails deterministically from 2026-10-05T00:00:00Z: rungraph-core is a dark feature whose gate.deadline was that instant, set when the part-five slice landed on 2026-09-05, and checkDeadlines (src/rulegraph/graph.ts) refuses a dark or soaking feature past its deadline. The run started 00:01 UTC. The deadline is renewed to 1893456000000, the value the other dark src/ features of this build already carry (the Telegram and Slack conversation adapters); the feature's status, gate test and metrics are unchanged, and the register was replayed so generated/register.json carries the renewed declaration. (2) Six cases that take 0.1-1.4 s in isolation were reported as timed out at 10.2-38.0 s under the gate's six fork workers, on the 10 s global default in vitest.config.ts; five of the six have synchronous bodies, so the 10 s timer could not fire until the starved body yielded, which is why the reported durations exceed the bound they broke. The default is raised to 90 s, 2.4x the worst duration seen, the margin convention docs/defects/full-suite-load-timeouts.md already applies. No case is skipped and no assertion or declared budget changes. The eighth failure (the two-machine stale-owner exit code) is recorded in the same defect record with its measured rate and the exit paths ruled out; it is left active, not quarantined, and no code is changed for it.
Affected rules: 2, 37, 42, 74, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: one dark feature's review date and one test-runner deadline; no product behaviour, no decoder, no durable format and no floor is touched
Side effects: a hung test now takes up to 90 s to be reported instead of 10 s; it is still reported as a timeout and never as a pass (Rule 42)
Undo and recovery: revert the two commits; the deadline and the timeout are each a single value, and the register replays from the declarations
Multi-machine posture: unchanged; both values are repository-wide and machine-independent
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md; docs/defects/full-suite-load-timeouts.md; src/rulegraph/graph.ts checkDeadlines
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed
Decision: cint-L50-r4-rungraph-deadline | rungraph-core is still dark, so its expired graduation deadline is renewed to the 2030-01-01 value its sibling dark src/ features carry, rather than graduating a feature whose gate evidence this repair does not hold | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L50-repair-172105-PROGRESS.md
Decision: cint-L50-r4-global-test-deadline | the six load timeouts share the global default rather than any declared budget, so the one default is sized to the measured worst case instead of adding a declared timeout to six unrelated files | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L50-repair-172105-PROGRESS.md
Decision: cint-L50-r4-twomachine-active | the two-machine stale-owner exit-code failure is recorded with its measured rate and the ruled-out exit paths and left active: a skip would remove Rules 31/63 replicated(1) floor coverage and the contract checkers refuse a skipped proof case, and no teardown guard is added on an unobserved cause | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L50-repair-172105-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): docs/defects/full-suite-load-timeouts.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/rungraph/rungraph.declarations.json, vitest.config.ts

## Closing block

simplestRobustRoute: two values and one record. The simpler route for (1) would be to leave the deadline and graduate the feature, which this repair has no gate evidence for; for (2) it would be to declare a timeout on each of the six files, which leaves every sibling case in the same class still on a 10 s default. No machinery is added, and the eighth failure gets a record rather than a guard for a cause nothing observed.
80/20: tests/e2e/register.test.ts 6/6 pass, lint (architecture) passes apart from this host's node-version parity row, register:check passes, change-review check passes apart from Studio-only artifact paths, tsc --noEmit clean. The full suite reruns in the pipeline.
VERDICT: author submission; the independent verdict is recorded as a pass
