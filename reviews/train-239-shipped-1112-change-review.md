# Change review — named shipped preview inventory

Subject base: 1ece5f547397c4c5b50053290d0a32ea9f734a52
Review state: open
Reviewed content: none
Outcome: The real-launcher test checks all seven intended preview features by identity and availability.
Affected rules: 5, 26, 37, 49, 66, 69, 70, 74, 78, 84, 101, 102, 108, 111, 112, 113, 116, 123
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain unchanged runtime enforcement.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test expectation repair only; no product, declaration, prompt or fixture changes.
Side effects: Future feature additions/removals/renames must update the exact named expected inventory.
Undo and recovery: Revert this commit; no live state or installation changes.
Multi-machine posture: Same deterministic source-closure assertions on every machine; no state or transport changes.
Team posture: No owner/member/guest access or sharing changes; existing owner-only private reports remain intact.
Layer below: journal.declarations.json:5, journal-agent.mjs:52/2210, journal.ts:10636 and register-shipped.mjs:70-73 establish declaration, actual wiring and computed availability.
Bug class: integration
Bug evidence: reproducer=tests/register/shipped.test.ts
Hook bypass: none
Convergence: none
Decision: train-239-shipped-inventory | Private reports correctly are not-loaded in agent.mjs and available in journal-agent.mjs. Replace both stale six-element arrays with exact seven-feature maps; retain closure and dark-status assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-239-shipped-1112-PROGRESS.md
Prompt review: No model-facing changes; only exact feature-id and availability expectations change.
1.x comparison: Inherit and re-verify JKHeadley/instar main db3ed6d3052cfcc24888b6c8bc86086abcfc2987 with git ls-remote; search src/ and docs/specs/ and history 948d48d0a02accf7969f744db0d7e6b065f5caa0 / ab26b7ca36c1375d855f08c9a6a66e84e2b656e2. PrivateViewer.ts create/get/provenance/marked GFM behavior and commands/server.ts wiring remain adapted unchanged. Specs dashboard-conversations-browser-device.md section 4.12 and CAPABILITY-MAP-SPEC.md publishing entry fit; bearer/PIN admission differs from 2.0 owner sessions and durable journal/send (existing private-view HTTP/restart evidence). ONEX-LESSONS.md section 3 preserves send intent, ambiguous-send uncertainty and empty-visible refusal. No new runtime port is needed for this test-only repair.
Validation: Build first; reproduce 8 pass / 1 failure at the anonymous count; rerun shipped plus all three first-repair files and charter gates. Exact results are in the Studio report above.

simplestRobustRoute: Correct the stale expected inventory using existing capabilityBriefing output; name every feature on both launchers so loss, rename, addition and wrong availability fail. Start with the built failing test, end with both exact inventories passing; retain all five floors and add no runtime machinery.
80/20: One test and this review, under 60 changed lines; targeted foreground checks, pipeline owns the full suite.
VERDICT: author repair submission; independent desk owns acceptance
