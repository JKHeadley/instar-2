# Change review — train-164 platform inventory repair

Subject base: 7d0bf06a4240ecf8aca24dacc2658dfde4620c9c
Review state: open
Reviewed content: none
Outcome: Route setup-owner-ipc.test.ts to the macOS half of split testing and restore exact agreement between the checked-in inventory and its detector.
Affected rules: 1, 26, 37, 49, 70, 74, 101, 102, 107, 111, 112, 113, 116; purpose Rule 3.
Affected floors: secrets — no custody or credential changes; spend cap — no model calls or bounds changed; stop — no runtime changes; no duplicate sends — no dispatch changes; durable intake — no journal or intake changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One existing test inventory entry, a consumer routing regression and this review record; no product behavior, detector or existing assertion changes.
Side effects: The entire IPC test file runs in the Mac half instead of the Linux half, including its portable TLS cases. Unsplit runs retain the same file. Its privileged launchd case retains its existing explicit opt-in.
Undo and recovery: Revert the one inventory entry if the test loses its Darwin-only mechanism, with the existing detector checking the replacement inventory. No runtime state or evidence is removed.
Multi-machine posture: Shared git inventory routes tests to their capable host. WSL checks prove inventory and selection; the Studio owns macOS execution and the full gate.
Layer below: Read the purpose and rules in full, matching origin/main; inspected the IPC test's Darwin-only launchd case, macos-only.mjs detection, vitest.config.ts consumers, split-step tests and actual runner discovery tests.
Bug class: unit
Bug evidence: reproducer=tests/platform/gate-split.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only.
Convergence: none
Decision: train-164-repair-211147-D1 | Add the already detected Darwin-gated IPC file to the sorted existing list; retain all assertions and use existing split/discovery controls instead of adding another mechanism. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-164-repair-211147-PROGRESS.md

The exact supplied failure reproduced locally: missing setup-owner-ipc.test.ts, no stale entries. Initial consumer checks passed all 13 existing tests, including real Vitest file discovery across both halves. A focused regression additionally pairs the actual IPC path with the portable owner-transport test across unsplit, Mac and Linux selections. No model-facing change or new acceptance decision is introduced; recorded model-shape replay is therefore outside this repair's scope. The retained review's open installation, custody, live-serving and Rules 117/118 obligations remain open.

simplestRobustRoute: This is the simplest robust route: update the existing enumerated list for the existing Darwin-only test and verify its existing consumers. Start guard: reproduce the exact missing entry; end guards: no inventory drift and every test discovered exactly once across the split; limit guard: unchanged runtime and safety floors. No new machinery or unattended product-completion claim.
80/20: One missing entry repairs the supplied assertion at its source; existing detection and consumer tests prove both halves without duplicating the Studio full suite.
VERDICT: author submission; no independent verdict asserted
