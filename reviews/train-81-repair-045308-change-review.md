# Change review — train-81 platform inventory repair

Subject base: 521121348efbb19fd1e29dd2b9ba222907e64adf
Review state: open
Reviewed content: none
Outcome: Keep the platform test inventory equal to detected macOS mechanisms by including the existing Telegram file ACL proof.
Affected rules: Rules 26, 37, 49, 70, 74, 101, 102, 111, 112, 113 and 116.
Affected floors: secrets — custody and ACL assertions retained; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. No product execution changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One missing test-inventory entry; no source, model prompt, authority or assertion changes.
Side effects: The split runner schedules the entire Telegram file test file on the Mac half, including its portable cases. Unsplit runs retain all cases. This is the existing file-level partition contract.
Undo and recovery: Revert this entry only alongside removal or relocation of its Darwin-only mechanism; reverting alone restores the demonstrated drift failure. No durable runtime data changes.
Multi-machine posture: Shared git inventory partitions tests between Linux and macOS hosts; no runtime state, ownership or transport changes.
Layer below: Inspected the Darwin-gated ACL test in tests/preview/telegram-files.test.ts, detection in tests/platform/macos-only.mjs, inventory consumption in vitest.config.ts, and explicit-file partitioning in scripts/vitest-split-step.mjs.
Bug class: none
Bug evidence: The unchanged inventory assertion reproduced the exact missing Telegram file failure before repair; afterward all four inventory tests and both split-step tests passed. Missing/stale entries and portable nonmatches remain tested.
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample files.
Convergence: none
Decision: train-81-platform-inventory | Add the existing Darwin-gated Telegram ACL test to the sorted macOS partition without weakening detection or assertions | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-81-repair-045308-PROGRESS.md

Subject (1 paths): tests/platform/macos-only.txt

## Closing block

simplestRobustRoute: This is the simplest robust route: add the one detected Darwin-only test file to the existing sorted inventory. Keep detector and assertions intact; no new machinery or capability limit. Inventory equality and split-runner tests guard coverage; no unattended product-completion claim.
80/20: One inventory correction addresses the sole supplied full-suite failure; existing focused positive and negative tests establish the repair. Full-suite acceptance belongs to the Studio gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
