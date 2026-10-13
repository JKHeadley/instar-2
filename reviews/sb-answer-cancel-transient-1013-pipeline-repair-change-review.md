# Change review — prepare the core before direct register wiring checks

Subject base: 3711d8019e7c5a6eebb0e5d7feb31c6d651c9378
Review state: open
Reviewed content: none
Outcome: A direct invocation of the register wiring checker builds an absent compiled core before importing its consumers, and reports a failed build as a finding rather than crashing during module resolution.
Affected rules: 1, 26, 37, 49, 69, 70, 74, 95, 101, 102, 111, 113, 116; purpose constraint 3.
Affected floors: secrets — no credential handling changed; spend cap — no model calls; stop — runtime unchanged; no duplicate sends — no send paths changed; durable intake — no runtime store changes.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes a release-check entry point and its build preparation, preserving all wiring assertions.
Side effects: A direct wiring check now invokes the existing compiler when dist/index.js is absent, just as the architecture check does. It creates generated local dist files; it does not generate or accept register evidence. Imports of the scanner for library use no longer load CLI-only compiled consumers.
Undo and recovery: Revert this repair commit and its generated register projection together. No runtime or persisted agent state migration is involved; a caller would again need to build before invoking the direct checker.
Multi-machine posture: Build output is deliberately worktree-local and reproducible from source on each gate host. Committed source and register evidence remain shared through git; no new machine state authority or peer dependency.
Layer below: Existing buildCoreIfAbsent helper, its absent/success/failure checks, TypeScript compiler, CLI import graph, and the unchanged committed-register/source-pin checks.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none
Decision: cancel-pipeline-build-precondition | reuse buildCoreIfAbsent and defer CLI-only compiled imports, repairing the direct entry point without adding a second build mechanism or changing cancellation behavior | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-answer-cancel-transient-1013-repair-094001-PROGRESS.md
Prompt review: No model-facing change: no prompt, output parser, acceptance, escalation or refusal decision used by a model changes. This repair only prepares compiler output for a release checker.

## Closing block

simplestRobustRoute: This is the simplest robust route: use the build helper already used by architecture lint, before loading compiled consumers in the direct wiring command. It prevents the supplied clean-worktree module-resolution crash; no new service, retry, state store or policy is added. Start is the direct CLI call; completion is the existing wiring verdict; failed compilation exits nonzero before consuming register evidence. Runtime safety floors remain untouched. No unattended product-completion claim.
80/20: Real compiler subprocess tests cover absent output becoming loadable and a failed build stopping before imports. Existing direct scanner consumers and the cheap gate checks supply regression evidence. Independent acceptance remains with the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
