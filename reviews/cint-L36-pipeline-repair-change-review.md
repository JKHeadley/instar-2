# Change review — cint-L36 pipeline repair: the requested-action status check no longer depends on the run date

Subject base: 41b3d05caa4b9646fe56368b65e2f3996f0e3be8
Review state: open
Reviewed content: none
Outcome: The Studio full run of cint-L36 (head 41b3d05c) failed one test, journal-requested-action "answers a requested action once at its due time...": it asserted the status line "Requested actions Telegram accepted: 1 today, 1 in this trial". The test sends the due turn on a simulated Friday 2026-10-02, but the status command it spawns (tests/preview/journal-agent.mjs status) counts "today" on the real wall clock, so the assertion held only when the suite ran on 2026-10-02 and failed at 2026-10-03 00:34 PDT. The status command's behaviour is correct (a status read reports the real day). The source of the failure is the test's date-bound expectation, so the fix is in the test: it now fixes the trial-wide count (1) and the not-yet-sent count (0) exactly and accepts a today count of 0 or 1. No product file changes. journal-requested-action 20/20 pass; tsc, lint, register:check clean.
Affected rules: 37 (fixed at source; nothing quarantined), 74 (this record), 90 (register replayed by the desk tools, not hand-edited), 101 (plain commits), 116 (one assertion changed; no clock override added to the status command)
Affected floors: secrets — unchanged (the test passes the storage key in the child environment only, as before); spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (the test still asserts exactly one push and one due call across restarts); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a test-only change to one assertion; no product, prompt or send path is touched
Side effects: none
Undo and recovery: revert the repair commit, the repin and replay commits and this record
Multi-machine posture: machine-local preview test; no replicated state
Layer below: tests/preview/journal-agent.mjs status (unchanged; reads the real clock by design)
Bug class: none
Bug evidence: none
Hook bypass: none (plain commits; no bypass flag used)
Convergence: none
Decision: cint-L36-status-today-wallclock | assert the trial count exactly and accept today 0 or 1, instead of adding a clock override to the status command, because the status read is correct and the simpler test change removes the date dependence | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L36-PROGRESS.md
Prompt review: no model-facing change; no prompt text, parser or decision path is touched
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-requested-action.test.ts

## Closing block

simplestRobustRoute: change the one date-bound assertion; regenerate only the pins and generated output with the desk tools
80/20: 1 failure repaired, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass
