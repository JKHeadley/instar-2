# Change review — canonical test temporary paths

Subject base: d6711fc3878ca0de0f6ff292e74141372f3e66b5
Review state: open
Reviewed content: none
Outcome: Let temporary journal fixtures run through their actual behavior on macOS when TMPDIR names /var or another filesystem alias.
Affected rules: Rules 1, 26, 34, 37, 49, 70, 74, 101, 102, 111, 113, 116.
Affected floors: secrets — journal directory substitution rejection unchanged; spend cap — no budget or reservation change; stop — existing stop replay retained; no duplicate sends — existing uncertain-send replay retained; durable intake — journal storage and guards unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test environment path spelling only; no runtime model, authorization, storage or delivery behavior changes.
Side effects: Both inherited and selected test temporary roots now use their canonical spelling. Teardown restores the original TMPDIR spelling and removes only the run-owned directory. Backing medium selection and warning classification are unchanged.
Undo and recovery: Revert this repair commit; no durable product data or migration is involved. Existing test roots and aliases are preserved.
Multi-machine posture: Deliberately host-local test setup; macOS aliases and explicit aliases on other hosts resolve to the same underlying directory, without state transfer.
Layer below: Read the journal substituted-directory guard, temporary-root selection and cleanup, and all supplied gate failure rows. 118 of 121 failing cases stopped at the path guard; three hdiutil failures are separate host-dependent volume checks.
Bug class: integration
Bug evidence: reproducer=tests/unit/test-tmp-canonical.test.ts
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains samples only.
Convergence: none
Prompt review: No prompt, parser, judgment or dispatch change. Existing recorded send-stage, acknowledgement and topic-session tests exercise the restored fixture paths.
Decision: train-32-p2-p2-repair-path | Canonicalize TMPDIR once in the existing test setup for both inherited and selected roots, instead of weakening the journal guard or patching fifteen test files. Preserve teardown restoration and backing medium selection. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-32-p2-p2-repair-131424-PROGRESS.md
Decision: train-32-p2-p2-repair-host | Preserve real volume checks and real-disk checks; report this sandbox's hdiutil and /var/tmp restrictions for Studio verification, without replacing physical evidence with mocks or extending production timeouts. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-32-p2-p2-repair-131424-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: resolve the already-selected test directory before giving it to fixtures. No new product machinery, bypass, timeout or quarantine. Start guards remain actual root accessibility and backing checks; teardown restores the original environment; the journal still refuses symlink substitution. This claims fixture repair, not unattended product acceptance.
80/20: Reproduce the supplied path failure, prove inherited and explicit alias roots plus the rejected symlink neighbor, run focused recorded replays and cheap gates, and hand physical host checks to the Studio.
VERDICT: author submission for desk review; no independent acceptance claim
