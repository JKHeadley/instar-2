# Change review — train-219 repair 170331: update-lifecycle fixture holds polls from each run's launch

Subject base: e6c555eeda53c0f6e74422891a9b0964907a5430
Review state: open
Reviewed content: none
Outcome: The m5pro full run of train-219 e6c555ee failed one test, tests/preview/update-lifecycle.test.ts, with "expected undefined to match object { status: 'verified' }" at line 73, the same signature train-216 repair 062348 addressed. The whole test took 85 s, while a normal first run alone takes about 127 s: the pre-update agent ended on its 35-cycle limit before any update was requested. The 062348 hold covers only the npm install itself; the window before it (the updater's 10 s first tick, release discovery and update preparation) still ran at 1 s per cycle, and under four-way full-suite load it outlasted the cycles. Each run now writes the hold marker at launch, so empty polls are held their full 5 s until the fixture install ends; the npm shim still clears the marker when its install ends, and the rest of the run keeps its 1 s pace. Product code is unchanged. Rule 24: this is the second repair for the same signature, and the recurrence was the evidence that the first hold covered only part of the window; the root cause is that the fixture's real-time budget was tied to the npm call rather than to the whole pre-update window, and this repair ties it to the launch.
Affected rules: 24, 37, 55, 70, 74, 101, 102, 111, 113, 116
Affected floors: secrets — no credential path touched; spend cap — no model call added (tools off, zero calls asserted); stop — unchanged; no duplicate sends — no send path added; durable intake — unchanged. Test fixture only.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test file: the fixture writes an existing marker file once more, before each spawn. No src/ or scripts/ change, no runtime behavior change, no other caller affected.
Side effects: The update-lifecycle run() helper writes the existing `installing` marker before each host-watch spawn. The fixture endpoint already holds empty polls 5 s while that marker exists, so the pre-install window now spends at most 35 x 5 s of real time instead of 35 x 1 s. The AutoUpdater's first tick is a wall-clock timer, so unloaded runs do not slow down: 263 s against a 256 s baseline on the Mama PC. No other test passes the marker argument.
Undo and recovery: Revert commit 40942e62 on train-219; nothing outside the repository is written.
Multi-machine posture: Machine-local, deliberately: a single-host test fixture; nothing is shared or replicated.
Layer below: Read the AutoUpdater start path (scripts/update-auto.mjs start(): first tick after a 10 s timer), scripts/update-product.mjs (check: discovery through the owned executor, then applyUpdate through updateRoot) and the journal-agent poll loop (the update controller starts only after a successful poll, so every pre-install second is spent in counted cycles). 1.x comparison: JKHeadley/instar main 70ac49c8, src/core/AutoUpdater.ts line 280 has the same `setTimeout(() => this.tick(), 10_000)` first tick that 2.0 carried over; 1.x's update lifecycle test drives apply through POST /updates/apply with no cycle-bounded runner (per the train-216 repair 062348 record), so 1.x has no counterpart for this race and the fix is local to the 2.0 fixture.
Bug class: integration
Bug evidence: reproducer=tests/preview/update-lifecycle.test.ts
Hook bypass: none; core.hooksPath unset and the clone's hooks directory holds only samples, so no hook ran; plain git commit with no bypass flag, no stash.
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: train-219-repair-170331-cause | Classified the repeat failure as the pre-install window, not the install, outrunning the 35-cycle budget: the 85 s failing test is shorter than one normal first run (127 s), which only fits a first agent that hit its cycle limit with no update requested. Reproduced with an injected 40 s delay before the install starts: the original fixture fails with the identical m5pro assertion in 60 s, the fixed fixture passes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-219-repair-170331-PROGRESS.md
Decision: train-219-repair-170331-marker-at-launch | Set the existing marker at each run's launch instead of raising --max-cycles. A larger cycle cap lengthens every post-update agent run and pushes runs toward the 200 s spawn bound; the marker spends real time only until the install ends, and it reuses the 062348 mechanism with no new fixture argument. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-219-repair-170331-PROGRESS.md
Prompt review: No model instruction, prompt, parse or accept/refuse rule changes in this repair.

Verification: typecheck, npm run lint, npm run register:check, node scripts/check-change-review.mjs check; vitest tests/preview/update-lifecycle.test.ts on WSL with bash as /bin/sh (private mount namespace) and the local-only, uncommitted Linux transport ps patch, four runs: original (pass, 256 s), original plus injected 40 s pre-install delay (fail, identical assertion), fixed plus the same delay (pass, 353 s), fixed (pass, 263 s). Exact outcomes in the desk report.

Subject (1 paths): tests/preview/update-lifecycle.test.ts

## Closing block

simplestRobustRoute: The required outcome is that the update lifecycle proof passes independent of host load. The simplest robust route extends the existing marker hold to start when each run launches, one write in the test, so the whole pre-update window is covered and not only the npm call. No product machinery and no new fixture argument are added. The safety guards (stop, spend, sends) are untouched.
80/20: The one failing test was run four ways (original, original with a slow pre-install window, fixed with the same delay, fixed) plus typecheck, lint, register and change-review checks; no full suite, per the brief.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
