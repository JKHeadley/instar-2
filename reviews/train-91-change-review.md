# Change review — train-91 one-line installation

Subject base: e44d3ce1985cc2e47620541d55ab03ae0bba8f8b
Review state: open
Reviewed content: none
Outcome: Include the reviewed runtime TypeScript dependency repair so npm's GitHub installation can execute setup.
Affected rules: 5, 30, 34, 37, 49, 66, 69, 70, 74, 90, 101, 102, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake remain unchanged; setup grants no account, channel or paid use.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Carries a reviewed install dependency correction with recorded shipped-path evidence; no production logic or model-facing change.
Side effects: TypeScript is installed for runtime consumers as well as development. Package size grows; setup can load its existing translator. README describes setup's actual limits. No new launcher or authority.
Undo and recovery: Revert the dependency change and regenerate bindings through review; this would restore the known setup failure. Existing setup data remains untouched.
Multi-machine posture: Machine-local installation, deliberately; the dependency declaration applies equally on each host. No shared state or ownership protocol changes.
Layer below: Full constitution, exact member diff and report, setup loader imports, recorded clean-home install fixture and existing desk regeneration chain.
Bug class: integration
Bug evidence: reproducer=tests/preview/one-line-install.test.ts; live=tests/preview/fixtures/one-line-install-2026-10-20.txt
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Decision: train-91-merge | Merge exact reviewed f3d1e15a82c409657736dde843309c0a914df1c0; member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/clean-install-1020-PROGRESS.md read remotely. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-91-PROGRESS.md
Decision: train-91-A | Preserve all member behavior and reviewed bytes; no product repair beyond the reviewed member. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-91-PROGRESS.md
Decision: train-91-B | Create branch at exact live base e44d3ce1985cc2e47620541d55ab03ae0bba8f8b and retain its ancestry without a main merge or branch movement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-91-PROGRESS.md
Decision: train-91-C | No product conflict or omitted head; generated files are regenerated through the desk chain. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-91-PROGRESS.md
Decision: train-91-D | Apply WSL host exclusions and report checks requiring Studio execution, without modifying conformance declarations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-91-PROGRESS.md
Decision: train-91-desk | Use downloaded repin/build/rehash/register replay tools with Linux sed syntax; preserve context guard constants. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-91-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Existing declaration text reproduced by the generator, not a new deferred repair.
Verification: Targeted install and onboarding tests, requested journal/subscription/context tests, pinned READY checks and static/register checks; results in the handoff report.
simplestRobustRoute: This is the simplest robust route: ordinary exact-head merge plus existing desk regeneration. npm's existing installer handles distribution; no new machinery. All safety floors are unchanged. The member's recorded clean-home run is carried as evidence, not claimed as a new live run by this builder.
80/20: Targeted and explicitly requested checks only; no full suite or base comparison worktree.
VERDICT: author submission for desk gate, not independent convergence or live acceptance
