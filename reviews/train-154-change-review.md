# Change review — train-154 setup supervision design

Subject base: 206bc77026aae10e4acb3ae6b177f2d0882295c8
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed setup-supervisor design into the live train-152 base; preserve runtime behavior and the requirement to qualify the candidate before distribution.
Affected rules: 4, 26, 28, 34, 36, 38, 41, 49, 55, 57, 58, 60, 65, 67, 69, 70, 74, 75, 90, 91, 95, 98, 100, 101, 102, 111, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing runtime enforcement. The design explicitly preserves isolated custody, bounded local supervision, stop, checkpoint reconciliation and unique genesis operations.
Operator questions: none
Suggested tier: ordinary
Declared tier: significant
Tier rationale: Integration of a reviewed critical-preparation design, without runtime or constitution changes.
Side effects: The candidate model remains unqualified; release builders must earn actual per-host adequacy and resource evidence. Register publication is regenerated at the reviewed member head.
Undo and recovery: Retain the live train until desk acceptance; revert the candidate through the release process and regenerate publication. No runtime state migration or effect replay.
Multi-machine posture: Existing ownership and replication are unchanged. Proposed CPU supervision and custody handles are machine-local, with single-machine operation preserved. This WSL build produces local evidence for the Studio gate.
Layer below: Full purpose and rules, reviewed member diff and SHA-verified report, prior desk chain report, existing setup-contract tests and generated-register consumers. The design preserves Rule 38 rather than claiming that exact checks waive supervision.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: No prompt, parser or runtime acceptance change; no new model-facing implementation or live qualification is claimed.
Decision: train-154-merge | Ordinary merge of exact reviewed e6b4a0a3d7366010aa5433cfb53e87d32de7eedc, fast-forward without conflicts; member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-setup-route-1025-PROGRESS.md read from the hash-verified supplied snapshot. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-154-PROGRESS.md
Decision: train-154-A | Preserve member and accepted live-base behavior byte for byte, including all changelog history; no manual resolution. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-154-PROGRESS.md
Decision: train-154-B | Create branch directly at live 206bc77026aae10e4acb3ae6b177f2d0882295c8 and retain that ancestry; no main merge or branch move. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-154-PROGRESS.md
Decision: train-154-C | No product conflicts and no omitted heads; verify membership at handoff. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-154-PROGRESS.md
Decision: train-154-D | Run targeted WSL checks; report unchanged host-dependent checks for the Studio gate without weakening assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-154-PROGRESS.md
Decision: train-154-desk | Run supplied repin/build/rehash/register-replay tools with authorized Linux sed adaptation; regenerate generated files and retain the fixed prompt guard. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-154-PROGRESS.md
Validation: Targeted setup contracts, provider subscription, default-context floor, journal tests and pinned-text selection; compile, lint, architecture, register and change-review checks. Exact results and host-dependent limitations are recorded in the handoff report.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge of the reviewed design plus the existing desk regeneration chain. No new mechanism or runtime decision is added. Start guards are exact reviewed ancestry; end guards are targeted checks and published candidate identity; limits preserve the existing five floors. The local model remains a candidate requiring independent qualification, not an unattended-completion claim.
80/20: Test the specified consumers and submit the exact pushed candidate; leave full-suite and host-specific release proof to the desk.
VERDICT: author submission; no independent verdict asserted
