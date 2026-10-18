# Change review — count delivery notices independently of uncertain answers

Subject base: 5e41cdec0a0b2d1b50f5148784e6370f3da376cc
Review state: open
Reviewed content: none
Outcome: Repair all five reported train-15 assertions by distinguishing an unknown answer from its separately fenced delivery notice. Retain exact send content, target, retry, promise, timing, restart and compaction assertions.
Affected rules: Rules 1, 13, 26, 37, 42, 49, 52, 70, 74, 87, 101, 102, 111, 112, 113, 116
Affected floors: secrets — outbound checks unchanged; spend cap — capacity checks unchanged; stop — existing notice floor verified; no duplicate sends — exact answer and notice dispatches checked independently across drains and restart; durable intake — existing journal cursor and recall assertions retained
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-contract repair only; no model-facing runtime, parsing, admission, authority or journal changes.
Side effects: The four tests now admit the existing content-free loss notice while still detecting repeated answers and repeated notices. UNKNOWN counts include all three uncertain effects when a limited answer, final answer and delivery notice all lack receipts. Source-reference pins and generated register publications must follow the modified tests.
Undo and recovery: Revert the four test changes and regenerate pins and publications with the existing tools. This restores stale expectations but changes no runtime or journal data. Never erase intent fences or retry uncertain effects.
Multi-machine posture: No new runtime state. Existing shared durable facts, single-owner effect admission and restart fences remain unchanged. Handoff tests cover process replacement and compaction; this is not a new cross-machine live proof.
Layer below: Read needsDeliveryNotice, noticeUnknownReplies, delivery-notice projection, sendOutcomeCounts and the handoff child. The existing notice has a separate durable target, does not upgrade the answer outcome, respects stop/capacity/audience gates and cannot recursively generate another notice. The send-unknown-notice suite verifies both known and unknown outcomes plus stop and capacity neighbors.
Bug class: integration
Bug evidence: reproducer=tests/preview/phase-timing.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only
Convergence: none
Decision: train15-150900-effect-counts | Repair the four stale consumers, preserving the existing loss notice and proving exact answer and notice effects independently rather than changing runtime capability. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-15-repair-150900-PROGRESS.md
Decision: train15-150900-pins | Use delegated desk rehash and repin tools and the register generator for any changed reference pins; never hand-edit a pin. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-15-repair-150900-PROGRESS.md
Prompt review: No prompts, model output parsing, accept/escalate/refuse decisions or runtime sources changed. Existing recorded declaration replay retains updates 715674118, 715674119, 715674175, 715674172, 715673614, 6232373, 6232374 and 6232376; the uncertain transport is injected and is not claimed as live evidence.

simplestRobustRoute: This is the simplest robust route: repair the stale exact assertions at their source using the existing answer and notice targets. Add no runtime mechanism or quarantine. The durable intent for each effect is the no-repeat guard, and the existing stop, audience and capacity checks remain its limits. No autonomous-completion or live-release claim is made.
80/20: Reproduce the five bounded failures, fix only their shared test-contract cause, verify affected files and required cheap gates, and leave the full suite to the Studio pipeline.
VERDICT: author submission; this record asserts no independent verdict
