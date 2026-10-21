# Change review — train-112 reserved test-login integration

Subject base: 52ead9423d978a2061f7fc32e8d53e0befc32960
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed testlogin-1021 head on the exact live train-108 base, preserving operator-reserved login refusal and the accepted live behavior.
Affected rules: 1, 4, 26, 35, 37, 42, 49, 69, 74, 90, 101, 102, 111, 112, 113, 116
Affected floors: Secrets remain unprinted and custody unread by tests; spend cap unchanged with no provider calls; stop unchanged; no duplicate sends, with no sends added; durable intake and journals unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: This is composition of an already reviewed physical test-launch guard; no application authority, model-facing text, verdict parser or runtime source changes.
Side effects: Reserved members of a fallback pool refuse even when held; missing identity refuses conservatively. The checker grants no usable quota. Studio launcher and quota-alarm changes remain desk-owned and are not installed or altered from this host. Generated register metadata is replayed for this head.
Undo and recovery: Revert the member through review and replay the register. Preserve the member's report and Studio backups; this train changes no live root, credential, runner or desk file.
Multi-machine posture: Repository guard is portable; policy, launcher installation and alarm state remain deliberately local to the Studio desk. This WSL build performs repository integration only.
Layer below: Full purpose and rules; exact member diff, actual checker and CLI tests; member report's live non-secret profile and quota evidence; existing repin/build/rehash/register tooling. No new mechanism or model-capacity claim.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory inspected: sample files only.
Convergence: none
Prompt review: No model-facing change; observer 106 recorded model-output replay does not apply. The member's recorded profile and quota replay evidence is cited, not claimed as re-executed on WSL.
Decision: train-112-merge | Ordinary merge of exact reviewed 24f7f057d04a8d89fe449c893d1edd2c2b6f033a, fast-forward with no conflicts. Member report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/testlogin-1021-PROGRESS.md, read in full. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-112-PROGRESS.md
Decision: train-112-A | Preserve all member and live-base behavior by retaining the reviewed bytes unchanged; no overlapping edits or product conflicts. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-112-PROGRESS.md
Decision: train-112-B | Create a separate worktree and new branch directly at exact live base 52ead9423d978a2061f7fc32e8d53e0befc32960; no main merge or branch reset. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-112-PROGRESS.md
Decision: train-112-D | Apply the specified WSL exception to untouched host-dependent checks; Studio owns e2e/integration register acceptance and full-suite execution. Report actual outcomes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-112-PROGRESS.md
Decision: train-112-desk | Run downloaded desk repin/build/rehash/replay with only the specified Linux sed adaptation; inventory and owner manifests required zero pin changes. Keep context guard and native certificate unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-112-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Existing generated declarations replayed with the standard generator; no postponed implementation.
Verification: Targeted guard and direct-importer tests, context floor, subscription and journal tests; typecheck, architecture, lint, register, change-review, whitespace and final-head pinned checks. Exact results and host exceptions are in the progress report.
simplestRobustRoute: This is the simplest robust route: one ordinary merge and the existing regeneration chain. Exact reviewed commit identity is the start guard, targeted checks and pushed-head evidence the end guard. Existing secrets, spend cap, stop, unique sends and durable intake limits remain unchanged. No unattended live-completion claim.
80/20: Only required targeted tests and final-head checks, foreground with one worker; no full suite, load generator or additional machinery.
VERDICT: author submission for desk gating; not independent convergence or live acceptance
