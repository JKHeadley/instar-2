# Change review — train-180 exact notice owner integration

Subject base: 1b2ddfec74e1387e3b749456f45b841915a296d9
Review state: open
Reviewed content: none
Outcome: Integrate the exact e7f0d6de54c3731784cd8740318e372c385339f5 patch to the two stale launcher notice readers, preserving all other train-180 source and failure evidence.
Affected rules: 26, 34, 36, 37, 49, 70, 74, 95, 100, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing runtime enforcement; only test assertions and derived publication metadata change.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Paths suggest critical because of derived owner/register metadata; declared ordinary because this is an exact test-only owner patch integration with no production or model-facing behavior changes.
Side effects: Both readers accept the shipped activation label with the exact renewal action. Separate model-route matching and controls rejecting unrelated text, substituted actions, garbage and contradictory reviews remain. Derived register publication may bind a new source commit; no certificate, profile, provider or expiry change.
Undo and recovery: Revert this integration's two test edits and replay the register through the existing tools; base and previous red evidence remain available. No runtime state or send recovery is changed.
Multi-machine posture: Test source travels through git; verification here is WSL-local. Full-head review, native/installed/live checks and host-affected cases belong to Studio. No Studio write or cross-machine authority change.
Layer below: Read full constitution, train-180 integration and startup-cache reviews, e7 owner review and patch, credentialNotices/remainingText in tests/preview/credential-reminders.ts and credentialDisplayLabel in tests/preview/credential-display.ts. Inspected existing canary negative controls and the normal desk repin/rehash/register tools.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-agent.test.ts
Hook bypass: none; core.hooksPath unset, common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No model prompt, runtime output parser or acceptance policy changed. Captured reminder lines originate from the owner's train-173 Studio gate at 9cf2e24c; the two control tests run locally without a provider. Existing garbage and contradictory-review cases are preserved, not newly claimed as run here.
Decision: train180-notice-owner | Apply e7's exact two-file patch without importing train-173/192 ancestry or changing runtime labels. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-180-repair-0101-PROGRESS.md
Decision: train180-notice-checks | Run build/typecheck, only the two captured notice controls and portable metadata checks; preserve all prior red evidence and leave full-head qualification to the desk. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-180-repair-0101-PROGRESS.md
Decision: train180-notice-publication | Use the existing owner rehash, Linux-adapted chain repin and exact committed-source register replay, with one final history check after metadata corrections. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-180-repair-0101-PROGRESS.md

Owner provenance: e7f0d6de54c3731784cd8740318e372c385339f5:reviews/train-173-notice-assertion-repair-change-review.md, original Subject base 9cf2e24c3aa9d0929915327ed28fbb5ddc3d159c. That original review is retained in git at the named owner commit, not copied as a current-ancestry review. Its decisions notice-assertion (recognize shipped notice with exact action) and runner-evidence (retain original RPC failure evidence) remain attributed to that owner. No historical base is imported merely to make it an ancestor.

1.x comparison: Searched actual JKHeadley/instar main c79dd645fbd5c0e99d4cc4e988155b600c6f19b7 src/, docs/specs/ and history. Inspected src/monitoring/MissingLoginSessionDetector.ts and docs/specs/scrape-fixture-realness.md; history ff8344b4b, 5da7c75da, 54b192d32. Read Studio ONEX-LESSONS.md sections 4 and 6. Missing-login notices do not implement this 2.0 activation assertion; reuse captured-byte verification discipline, not unrelated runtime code. The owner's comparison at 4e38b9fdaae43b62940a6a43e1e69094d1b91bd1 is retained as attributed provenance.

Evidence boundary: The supplied authenticated task reports eight exact-M5 notice assertion failures, all matching e7, remaining unrelated/unknown zero. Original failure artifacts are preserved. Owner and cartographer successes are source-pattern evidence, not proof of this head. Current main Rule 122 merge and fresh full-head/native/installed/live qualification remain the desk's stated work, not production work added by this integration.

Deferral: generated/register.json:1 | not-a-deferral=Existing governing text carried by the generated register, not a new promise or postponed repair.

Validation: Build and typecheck exited 0; two selected captured notice controls passed, 22 other cases deliberately unselected. Both complete test files match e7 bytes. Owner rehash updated one preview artifact pin; chain repin updated zero. Register replay binds committed source 2347372712c3c217dda5121f41a3555892f52bc9 (298 entries, 121 rules, 34 terms). Fresh final portable-check results are recorded in the report.

simplestRobustRoute: This is the simplest robust route: apply the single owning test patch, use existing captured controls and normal publication tooling, and preserve runtime floors unchanged. Entry is the exact assigned base, exit is pushed source with selected controls and portable checks green, and the desk retains full acceptance. No new machinery or unattended-live success is claimed.
80/20: Correct the common assertion source once; run only the two selected controls and cheap checks, never repeat the known WSL launcher refusals or broad suites.
VERDICT: author submission; no independent convergence claimed
