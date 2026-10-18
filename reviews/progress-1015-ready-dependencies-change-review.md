# Change review — retain shared dependencies for repeatable READY checks

Subject base: 893af539221ea79c07386419eed723c50b6f042c
Review state: open
Reviewed content: none
Outcome: The node_modules ignore rule covers both a local directory and a shared-dependency symlink, allowing a clean worktree to retain the dependencies needed by the desk's READY check.
Affected rules: 26, 37, 49, 70, 74, 101, 105, 111, 113, 115, 116
Affected floors: secrets — no outbound or custody change; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One ignore-pattern repair and restoration of the existing local dependency link; runtime source, dependency manifests, lockfile and conformance declaration are unchanged.
Side effects: Git ignores node_modules symlinks as well as directories. The prior repair removed its untracked dependency symlink after verification, which made the architecture check's exact composition closure incomplete. The link is now retained through verification, push and handoff. Fresh worktrees still require dependency installation or linking before verification.
Undo and recovery: Restore the directory-only pattern if needed, while retaining installed dependencies; do not remove a verified dependency root merely to clear status. Missing package bytes must continue to fail conformance rather than receive an invented certificate.
Multi-machine posture: The ignore rule is portable. Each host supplies its own dependency installation; this Studio worktree links the already installed shared dependencies. No absolute machine path is committed.
Layer below: Git directory-only ignore semantics; composition-digest.mjs packageFiles requires node_modules/typescript package and entry bytes; actual missing-root R105 reproduction; unchanged conformance digest and existing native contract.
Bug class: none
Bug evidence: none; local dependency preparation and handoff repair, with commands and reproduced R105 evidence in the repair PROGRESS record.
Hook bypass: none
Convergence: none

## Closing block

simplestRobustRoute: This is the simplest robust route: correct the existing ignore rule and retain the dependency installation already used for verification. No checker weakening, package-resolution fallback, certificate change or ability restriction.
80/20: Missing local dependencies reproduced the desk's exact R105 failure. Git now ignores the retained symlink. The final-head lint, register, change-review, typecheck, native and pinned results are recorded in the repair report before READY.
VERDICT: author submission; independent review pending
