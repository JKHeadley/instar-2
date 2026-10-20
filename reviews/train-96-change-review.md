# Change review — train-96 clean install integration

Subject base: 39d72c391905038ad7da24c51c6c0e8df5732b0f
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed clean-install-1020 head while preserving the live base, and regenerate its register through the existing desk chain.
Affected rules: 5, 30, 34, 37, 49, 62, 69, 70, 74, 90, 101, 102, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake unchanged. No account, channel, paid use or authority is added.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Integration of the reviewed user-facing clean-install fix; no additional product behavior.
Side effects: npm git installs include TypeScript as required by setup's registered loader. Generated register provenance advances to the merge; no source or prompt changes beyond the reviewed member.
Undo and recovery: Revert this integration through normal review; the prior install limitation returns. No serving root is changed.
Multi-machine posture: Machine-local installation, deliberately; no shared state or ownership change.
Layer below: Constitution read in full; runtime loader dependency declaration and lockfile; member review and recorded macOS install evidence; live-base ancestry; desk chain from cint-L37-PROGRESS.md.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/one-line-install.test.ts; live=tests/preview/fixtures/one-line-install-2026-10-20.txt
Hook bypass: none; core.hooksPath unset, common hooks directory contains sample files only.
Convergence: none
Prompt review: No model-facing prompt, parser or verdict changes. The unchanged default-context-floor guard is exercised.
Decision: train-96-merge | Merge exactly f3d1e15a82c409657736dde843309c0a914df1c0, as reviewed in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/clean-install-1020-PROGRESS.md; sync of that report is preserved at reviews/train-96-member-progress.txt. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-96-PROGRESS.md
Decision: train-96-A | Preserve the full reviewed member behavior; the ordinary merge has no conflicts. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-96-PROGRESS.md
Decision: train-96-B | Start directly at the exact live base 39d72c391905038ad7da24c51c6c0e8df5732b0f; do not move the branch or merge main. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-96-PROGRESS.md
Decision: train-96-D | Apply the explicit WSL exception to untouched macOS and host-dependent checks; report their actual results separately. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-96-PROGRESS.md
Decision: train-96-desk | Run the downloaded desk repin, build, owner-manifest rehash and register replay; generated files are never hand-edited. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-96-PROGRESS.md
Verification: Targeted member tests, onboarding, default-context-floor, provider-subscription, journal tests, READY pinned tests, typecheck, lint, architecture, register and change-review checks; exact results and WSL exceptions in the handoff report.
simplestRobustRoute: This is the simplest robust route: one ordinary merge of the reviewed fix and the existing desk chain, with targeted regression evidence. No new machinery. Exact base and member SHAs are the start guards; clean committed pushed state and recorded verification are the handoff guards; no live root or serving login is touched.
80/20: Run the specified targeted checks, not the full suite; Studio owns the final platform gate.
VERDICT: author submission for desk gate, not independent convergence or live acceptance
