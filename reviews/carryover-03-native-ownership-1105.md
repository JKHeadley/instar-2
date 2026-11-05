# Change review — Row03 native ownership counterexample and ancestry floor

Subject base: 7c250514aba64a267c6438f08ac4f0957807bb78
Review state: open
Reviewed content: none
Outcome: Preserve unknown-owner refusal, repair recovery after an unavailable ancestry read, and make native completion and its unknown-worker neighbor independently falsifiable. Native positive completion remains blocked; this is a partial repair and a reproducible design counterexample, not feature closure.
Affected rules: 2, 8, 26, 29, 32, 34, 37, 42, 49, 63, 70, 74, 83, 95, 101, 102, 107, 111, 112, 113, 116; NF-52.
Affected floors: secrets — encrypted journal and held-material checks retained; spend cap — unchanged call/send budgets; stop — existing observation/intake/execution fences; no duplicate sends — source/checkout dedupe and uncertain-effect fences retained; durable intake — signed raw requests remain journaled before acceptance.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Ownership exclusion can admit concurrent checkout recovery; the native counterexample disproves the attempted relaxation, which is not shipped.
Side effects: Unavailable, empty or malformed ancestry now refuses recovery even with an empty UID population. Native tests create disposable fixtures under the installed harness identity, admit synthetic input only into a separate test journal and use an in-process reply sink. Native positive test deliberately fails while the production capability is incomplete; it runs only with the existing explicit native-test environment switch.
Undo and recovery: Revert this source guard and matching tests if required, retaining the counterexample evidence. Prior native cwd, certificate and publication repairs remain intact. No installed authority, process launcher or live runner is changed.
Multi-machine posture: Physical census, ancestry and recursive watch evidence remain machine-local. No unseen remote process is inferred absent. Existing topic ownership still controls intake and dispatch.
Layer below: Current 1.x OrphanedWorkSentinel, orphanedWorkGit and tests; 2.x launchMembership/candidates, resource-owner joins and documented detached-child residue; physical session journal and exact tmux identity; harness-launch members/seen and advisory terminal claim; native complete UID census, cross-UID cwd, recursive watch and private-path refusal.
Bug class: integration
Bug evidence: reproducer=tests/preview/host-worktree-recovery.test.ts
Hook bypass: none
Convergence: none
Prompt review: No production prompt, model parser or judgment change. Tests reopen the existing captured journal-shape fixture; the reply sink does not send a message.

Decision: c03-native-reject | Reject an attempted existing-owner membership exclusion: an older unregistered worker holding a checkout file open outside its cwd was classified non-owner and recovery was wrongly admitted. The same proposal passed the native positive case, demonstrating why both sides are necessary. Preserve the rejected patch and failing log only in lanes evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-03-native-ownership-1105-PROGRESS.md
Decision: c03-native-ancestry | Require complete ancestry both when establishing source lineage and when admitting owner absence. Missing, empty and malformed parent-table tests failed before the guard and pass afterward. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-03-native-ownership-1105-PROGRESS.md
Decision: c03-native-proof | Replace the refusal-only native test with strict signed original-topic intake and retained-checkout consumption plus an unknown live worker counterexample. Preserve its red positive result honestly; no READY or unattended completion is claimed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-03-native-ownership-1105-PROGRESS.md

Evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-03-native-ownership-1105-evidence/results.jsonl records commands, PIDs, heads and exit codes. rejected-native-7c250514aba6.log demonstrates unsafe admission; ancestry-before-7c250514aba6.log demonstrates three ancestry failures; focused-7c250514aba6.log demonstrates the guard repair. The rejected patch is not production code.

## Closing block

simplestRobustRoute: Reuse the current classifier and refuse unknown ownership. The attempted launch-membership shortcut is insufficient: a complete current process table does not establish unrelated ownership for an older unregistered checkout holder. The final source change only repairs the missing ancestry floor. Native completion requires additional authoritative non-ownership evidence from the existing launch owner; this submission does not invent a second classifier or claim that evidence exists.
80/20: Native positive and unknown-holder counterfactual, before/after ancestry tests, focused direct callers and final-head checks. Independent review, full suite and installed live task remain desk gates. Positive native completion remains an explicit failed acceptance condition.
VERDICT: author submission; partial repair, no independent verdict or native completion
