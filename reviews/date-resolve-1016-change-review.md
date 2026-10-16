# Change review — Repair date resolutions bound to the wrong clock

Subject base: a82cdeac28e30f18a6f3dfee9335ae71ca31b890
Review state: open
Reviewed content: none
Outcome: An operator date proposal with a missing or mismatched original clock, zone, or malformed UTC instant uses the existing single declaration repair before the runner reports it unresolved.
Affected rules: 1, 4, 26, 32, 34, 36, 49, 57, 70, 74, 83, 96, 101, 107, 111, 112, 113, 116.
Affected floors: secrets — unchanged redaction and outbound checking; spend cap — repair retains the existing call reservation and cap; stop — repair and send retain their stop checks; no duplicate sends — repair precedes the single answer, with restart replay coverage; durable intake — original accepted message remains journaled across repair and restart.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One validation branch joins the existing bounded declaration repair. No new service, parser grammar, authority, clock source, or durable state. Generated register artifacts repin the committed source in the existing shape-only replay mode; they grant no runtime authority.
Side effects: Invalid resolution bindings can spend one additional model call within the existing allowance. A second invalid response stays unresolved. Correct bindings and explicit model ambiguity spend no repair call. No date is admitted by overwriting model evidence; the corrected response must pass the unchanged date validator. The existing timeout, worker ceiling, context-wall, rate-limit and socket paths are untouched.
Undo and recovery: Revert this commit. Existing journal formats and resolution records are unchanged; no state migration or cleanup is needed.
Multi-machine posture: The original Telegram message clock and configured operator zone remain the source on every host. Existing journal sharing and conversation ownership are unchanged. Replay tests use isolated machine-local temporary journals deliberately.
Layer below: Read the full constitution and srerun2 proof report. Inspected original intake, reserved model packet, native-session Write output and delivered reply; traced datedFrom, resolvedDatedItem and formatReask through the unchanged clock/zone/instant validation and call/stop guards. The packet supplied the original clock correctly; the model copied packet.now and the repair predicate missed the resulting validation diagnostic.
Bug class: integration
Bug evidence: reproducer=tests/preview/date-resolution-repair.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks.
Convergence: none
Prompt review: No prompt wording changes. The existing original-clock repair instruction now also reaches malformed bindings. Exact native-session outputs from updates 715676630 and 715676632 are replayed. The corrected second response is explicitly counterfactual, changing only the clock binding; it is not claimed as a new live model result. Recorded summary, uncertain, Jev undecided/unsure, reviewer, delivered and empty shapes exercise repair-result handling without invented dates or duplicate sends.
Decision: date-resolution-reask | Reuse the single declaration repair for the existing binding-validation failure; supply original message clock and operator zone in its existing instruction. Do not silently replace a model clock, because its instant may have been calculated against the wrong day. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/date-resolve-1016-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: extend the existing repair predicate to the existing malformed-binding diagnostic. The credible failure is a model copying packet.now instead of datedClock.at, demonstrated by update 715676632; previously the valid repair path never fired. No new mechanism or grammar is added. Start guards are accepted operator intake and exact quote validation; end guards are unchanged date validation and one final answer; existing secrets, spend cap, stop, duplicate-send and intake floors remain. This is a recorded-path bug-fix submission, not an unattended live-model completion claim.
80/20: The original recorded mismatch and six malformed-binding neighbours failed before repair; the positive recorded neighbour and safety cases passed. All 95 tests across six targeted suites pass after repair, including seven additional real recorded output shapes. The host lane owns full-suite and independent landing acceptance.
VERDICT: author submission; no independent verdict is asserted
