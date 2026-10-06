# Change review — sb-w4-replycheck pipeline repair 2: a stop during the runner's minimal step, and the late-review test's budget (plan #542)

Subject base: 293729ca84a1c8aabffd2d3cd5e6e4957507b049
Review state: open
Reviewed content: none
Outcome: The studio gate at 293729ca failed two tests. (1) review-yes-wiring "asks the reply reviewer whether an answer reports a shared-access approval": its late reviewer advanced the clock by 30001 ms, the former reply-check budget; this unit raised the budget to 60 s (REPLY_CHECK_BUDGET_MS), so the review arrived in time and recorded a readable "no". The test now advances by REPLY_CHECK_BUDGET_MS + 1, tied to the constant. (2) two-machine-floors "the stop floor on two machines": under suite load the stopped runner exited 1, not 0. In tests/preview/journal-agent.mjs the run loop awaited worker.minimal(), and worker.gate() refuses by throwing once the stop file exists; a stop latched during that await reached main(), which maps any throw to exit 1, while every other stop check in the loop breaks. The loop's three worker steps (gate+minimal, the post-work gate, the post-intake minimal) now run through untilStopped (tests/preview/live-sentinels.ts): a refusal while the loop's own stop condition holds ends the loop cleanly with its recorded stop reason; any other failure is rethrown unchanged.
Affected rules: 4 and 15 (the stop still ends everything; it now also ends the process with the clean status the supervisor reads), 55 (a real failure still ends the run non-zero: untilStopped rethrows anything that is not a stop), 37 (fixed at source, no quarantine), 116 (one small helper at the existing loop, no retry or new machinery), 34 (both sides proven), 63 (a lost lease ends the loop cleanly, as the loop's top check already does), 74 (this record), 90 (register replayed by the script, not hand-edited), 101 (plain commits), 113 (machine-local)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — strengthened: a stop that latches mid-step ends the runner with status 0 and the "operator stop latched" record instead of a crash exit, and nothing further is sent or spent because the gate still refuses first; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a preview runner loop's exit status on an already-latched stop, plus one test constant; no gate, send or spend decision changes.
Side effects: a stop or lost ownership that coincides with a worker step no longer prints "preview refused to start or continue" and exits 0 with the stop reason already recorded; generated/ carries generation undefined.
Undo and recovery: revert 961a34d7 and its register replay c14c2885; nothing is migrated and no stored state changes.
Multi-machine posture: machine-local, deliberately — each runner's own loop and exit status; the two-machine stop floor test covers both machines.
Layer below: tests/preview/journal.ts createJournalWorker gate() and minimal() (refuse by throwing on stop/expiry), unchanged; tests/preview/journal-agent.mjs main() catch (any throw exits 1), unchanged.
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-due-loop.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.worktrees/gate-sb-w4-replycheck/.test-results.json
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: sbreplycheck-stop-midstep | a worker refusal is treated as the stop only when the loop's own stop condition holds after it, rather than catching every worker error or making the worker's gate non-throwing, because the gate's throw is what keeps a stopped worker from sending and any other failure must still end the run non-zero | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-replycheck-PROGRESS.md
Prompt review: no system prompt, provider policy, model input or verdict parsing changed; the change is a runner loop's stop handling and a test clock value.
Prompt finding: 0c0c2c5478e2 | protocol-literal | a refusal detail of the admission, matched by its own test; not prompt text (as in the carried record)
Deferral: generated/register.json:1 | not-a-deferral=generated register output, written by scripts/build-register.mjs and never hand-authored

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-agent.mjs, tests/preview/journal-due-loop.test.ts, tests/preview/live-sentinels.ts, tests/preview/review-yes-wiring.test.ts

## Closing block

simplestRobustRoute: the loop already ends cleanly on every stop check; routing its three worker steps through one helper that applies that same stop condition to a refusal closes the window between the check and the awaited step, without touching the worker's refusal itself.
80/20: journal-due-loop 6/6 (new: real worker, stop latched while the minimal step is awaited → clean end; same refusal without a stop → rethrown; non-stop error with/without the condition), review-yes-wiring 15/15, two-machine-floors 4/4, two-machine-runner 3/3, live-sentinels 15/15, native-harness-contract 9/9. tsc --noEmit exit 0, npm run lint exit 0, npm run register:check true. The full suite is the gate host's.
VERDICT: author submission; no independent pass is recorded for this record
