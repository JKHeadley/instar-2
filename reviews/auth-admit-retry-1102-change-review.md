# Change review — use the real Claude session to establish subscription availability

Subject base: 81517fbe093c525559ee497fcd79bf964b07459b
Review state: open
Reviewed content: none
Outcome: The 12:34 live #2190 task reached the per-topic conversation host on sagemind-echo. The host recorded `subscription authentication status unavailable`, no child worker, and zero input-dispatch attempts. It settled the task uncertain and sent failure notice 704. A same-login read-only status call at 12:42 passed in 775 ms. The failed call's exit code or timeout detail was not retained, so its immediate cause is unknown. The observer confirmed 1.x does not use `claude auth status` as a pre-dispatch grant; a real Claude Code session is the working-login test.
Affected rules: R1 no duplicate sends and durable intake, R68 queued accepted work across launches, R70 live-path reproduction, and R95 subscription-pool placement.
Affected floors: No duplicate sends and durable intake are preserved by the existing conversation host. Secrets floor: the selected profile identity, managed configuration and executable artifact are still checked before launch, and the handed-over secret remains confined to the launcher. The session's real outcome drives the existing failure and login-swap path. Spend and stop boundaries are unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes live handling of an admitted operator task. Justin requested 1.x parity, and the observer requested the smallest fix to the 14-second failure.
Side effects: Delegated-session admission stops executing `claude auth status --json` before launch. A stale or unavailable status report cannot consume the accepted task. A real session may now launch on a login whose metadata status would have refused it; its actual result remains governed by the existing session, provider failure and login-swap handling.
Undo and recovery: Revert the source and generated register in an isolated worktree, or roll back the serving build while preserving the journal. A queued item remains in durable custody across runner restarts.
Multi-machine posture: This is within the Studio-local conversation host; it adds no shared owner, sender, or credential path.
Layer below: The installed host's delegated-session admission checks `claude auth status --json` under `_instarharness` for the selected Echo profile before any worker launch. Its generic failure was treated as an uncertain completed attempt despite zero dispatch. The actual session is the discriminating probe for login availability; pre-launch identity and artifact checks remain.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/production-provider-subscription.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-trial-root/justin-group-20261010/session-work-state/conversation.json
Hook bypass: none
Convergence: none
Verification: Delegated-session admission test asserts zero auth-status commands while preserving artifact and profile checks (103/103 passed). The refreshed native composition contract passed 10/10 on the current bytes. Exact-head full suite and live retest pending.
Prompt review: No model-facing prompt changed.
Prompt finding: 0d4664ea9de7 | protocol-literal | Existing test fixture wording is unchanged; this patch removes only a delegated-session metadata probe.
Prompt finding: 14d7eeccc218 | protocol-literal | Existing test fixture wording is unchanged; no model-facing instruction changed.
Prompt finding: 38a2c5d186f1 | protocol-literal | Existing test fixture wording is unchanged; no model-facing instruction changed.
Prompt finding: 9781075d458e | protocol-literal | Existing test fixture wording is unchanged; no model-facing instruction changed.
Prompt finding: 45e37ea2e9e9 | protocol-literal | Existing test fixture wording is unchanged; no model-facing instruction changed.
Prompt finding: b1bb3946362d | protocol-literal | Existing test fixture wording is unchanged; no model-facing instruction changed.
Subject: src/assembly/production-provider.ts, src/assembly/harness.declarations.json, tests/assembly/production-provider-subscription.test.ts, generated/*

Decision: auth-status-session-parity-1311 | Delegated session admission verifies the selected profile and executable, then lets the real Claude Code session establish whether the login works; no metadata-only status call gates dispatch. | reported=reviews/auth-admit-retry-1102-change-review.md

## Closing block

simplestRobustRoute: Remove the metadata-only status call from delegated-session admission while retaining physical identity checks.
80/20: Let the real Claude Code session test the selected login and drive the existing failure and swap path.
VERDICT: author submission; no independent review verdict claimed.
