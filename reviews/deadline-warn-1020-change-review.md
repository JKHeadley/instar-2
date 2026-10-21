# Change review — graduation deadlines warn a day ahead; an overdue dark feature no longer fails unrelated builds

Subject base: ac681e8ad49d8ebd893f1af3d91ad94a7e680c13
Review state: open
Reviewed content: none
Outcome: `node scripts/build-register.mjs --check` prints a `REGISTER-DEADLINE WARNING` line from 24 h before a dark or soaking feature's graduation deadline, and a `REGISTER-DEADLINE OVERDUE` line on every run after it. Each line names the feature, the deadline, where it is declared, and the owner of the next step (the latest new-deadline entry of the promotion record beside the declaration). The stdout summary carries `deadlines: { dueSoon, overdue }`. An overdue DARK feature no longer fails the deadline check, so a train that does not touch it passes its paperwork step. An overdue feature switched to soaking fails its own check ("graduation overdue while soaking"). The real-clock capabilities test applies the same split. On 2026-10-20 the expired preview.step-check deadline failed every train's paperwork step from 17:00 to 17:27; this removes that train-wide failure without hiding the obligation. The step-check deadline is unchanged (2026-10-24T00:00Z) and is not extended.
Affected rules: Rules 72 and 73 (graduation deadlines and dark features); also 37 (fix at the source), 101 (plain commits), 102 (decision reported), 116 (simplest route).
Affected floors: secrets — unchanged; nothing is read or printed beyond the committed promotion record's owner text; spend cap — unchanged, no model calls; stop — unchanged; no duplicate sends — unchanged, nothing sends; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: It changes what a build gate refuses: an overdue dark feature now passes the register check with a loud line instead of failing it. The obligation stays: every check output and the operator's status keep naming the overdue feature, and switching it on past the deadline still fails.
Side effects: After 2026-10-24T00:00Z, step-check's expired deadline is printed on every check run and in status but no longer fails unrelated trains. The real-clock capabilities test still reports the overdue line as a finding and fails if the overdue capability is not dark or if any other finding appears. A second feature, rungraph-core (src/rungraph/rungraph.ts, deadline 2026-10-25T00:00Z, no promotion record), will start warning at 2026-10-24T00:00Z. The desk driver (a desk file, not in this commit) now logs each REGISTER-DEADLINE line to the ledger and wakes the desk once per line per day.
Undo and recovery: Revert the four source commits and regenerate the register; the overdue check then fails builds again. For the driver, restore driver.py.bak-deadline-warn-1020.
Multi-machine posture: Shared repository code and generated publication; every machine runs the same check with its own clock. The driver change and its notice file live only on the Studio desk.
Layer below: Inspected checkDeadlines (src/rulegraph/graph.ts), runRegisterChecks (src/register/workflow.ts), build-register.mjs's build/run and readCommit pinning (an owner lookup reads the committed promotion record through the same pinned `show`), capabilityFindings and proofStatusLines in tests/preview/capabilities.ts (status already says "graduation overdue"), the e2e CLI deadline cases, and the desk driver's paperwork_check, which shows output only on failure.
Bug class: clock-dependent gate failing unrelated work
Bug evidence: lanes/stepcheck-grad-1020-PROGRESS.md and the observer's 17:44 note: train-95's 17:06 paperwork "failure" was the step-check deadline passing, not its change.
Hook bypass: none; plain commits, no bypass flags.
Convergence: none
Decision: deadline-warn-forced-dark | Overdue is the feature's own failure, not every build's: dark-and-overdue passes with a loud line on every run; soaking-and-overdue fails. The register sees declarations, not train diffs, so "forced dark" is the simplest rule it can check; it keeps the obligation visible without guessing which train touches the feature. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deadline-warn-1020-PROGRESS.md
Prompt review: The new lines are build-check output read by the desk. No model prompt, parser or accept/refuse logic for a model changes.
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Verification: Recorded in the deadline-warn-1020 PROGRESS report.

## ELI16

Some features ship switched off and have a date by which they must prove themselves or be removed. Until now, when that date passed, the build check failed for everyone, so a train that had nothing to do with that feature failed too. That happened tonight for 27 minutes. Now the check warns a day before the date, naming the feature, the date and who owns it, and the desk is woken with that line. After the date it keeps shouting on every run and in status, but it only fails if someone tries to switch the late feature on. The feature still has to be proven or removed; it just stops blocking everyone else.

## Closing block

simplestRobustRoute: Reuse the existing deadline check and register output: one pure function lists due and overdue features, the existing check keeps failing only the case that endangers anything (an overdue feature that is switched on), and the existing CLI prints the lines. The owner comes from the existing promotion record. No new store or schema field.
80/20: Verify both sides in the rule graph unit test, the CLI e2e cases (overdue dark passes and prints, overdue soaking fails, within 24 h warns, before that silent), the owner lines, the real-clock capabilities test on fixed clocks, and a real `--check --now` run at three times around the step-check deadline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
