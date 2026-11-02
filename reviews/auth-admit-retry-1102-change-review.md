# Change review — use the real session for descriptor-handoff login availability

Subject base: 81517fbe093c525559ee497fcd79bf964b07459b
Review state: open
Reviewed content: none
Outcome: The 12:34 live #2190 task reached the per-topic conversation host on sagemind-echo. The host recorded `subscription authentication status unavailable`, no child worker, and zero input-dispatch attempts. It settled the task uncertain and sent failure notice 704. A same-login read-only status call at 12:42 passed in 775 ms. The failed call's exit code or timeout detail was not retained, so its immediate cause is unknown. The observer confirmed 1.x does not use `claude auth status` as a pre-dispatch grant; a real Claude Code session is the working-login test.
Affected rules: R1 no duplicate sends and durable intake, R68 queued accepted work across launches, R70 live-path reproduction, and R95 subscription-pool placement.
Affected floors: No duplicate sends and durable intake are preserved by the existing conversation host. Secrets floor: the selected profile identity, managed configuration and executable artifact are checked before launch, the handed-over secret remains confined to the launcher, and stored-login sessions retain account, organization, plan and auth-method verification. A typed rate-limit observation holds the selected login for subsequent work; generic auth failures are not claimed to swap logins. Spend and stop boundaries are unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes live handling of an admitted operator task. Justin requested 1.x parity, and the observer requested the smallest fix to the 14-second failure.
Side effects: Delegated-session admission skips `claude auth status --json` only when the host declares a descriptor handoff. A stale or unavailable metadata report cannot consume that accepted task. Sessions without a descriptor handoff still execute and validate status before launch. The real session's result remains governed by the existing session and provider-failure handling; only typed rate limits currently drive a login hold and later swap.
Undo and recovery: Revert the source and generated register in an isolated worktree, or roll back the serving build while preserving the journal. A queued item remains in durable custody across runner restarts.
Multi-machine posture: This is within the Studio-local conversation host; it adds no shared owner, sender, or credential path.
Layer below: The installed host's delegated-session admission checks `claude auth status --json` under `_instarharness` for the selected Echo profile before any worker launch. Its generic failure was treated as an uncertain completed attempt despite zero dispatch. In the descriptor-handoff path, status cannot establish account identity, so the actual session is the discriminating availability probe; pre-launch identity and artifact checks remain. Independent review of the first unconditional patch found a reachable stored-login path that still needs status verification; this correction preserves it.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/production-provider-subscription.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-trial-root/justin-group-20261010/session-work-state/conversation.json
Hook bypass: none
Convergence: none
Verification: First candidate's admission tests passed 103/103 and native composition contract 10/10, but independent review gave NO-GO for the stored-login path. Corrected candidate's native composition contract passed 10/10. Its provider test file passed 104/105 under concurrent full-suite load; the sole byte-boundary answer case (unrelated to session admission) passed on immediate isolated rerun. Focused descriptor and stored-login branch tests are running. Lint, register, independent re-review and live retest pending; full suite is a follow-up under the observer's fast-lane direction.
Prompt review: No model-facing prompt changed.
Prompt finding: 0d4664ea9de7 | protocol-literal | Existing test fixture wording is unchanged; this patch removes only a delegated-session metadata probe.
Prompt finding: 14d7eeccc218 | protocol-literal | Existing test fixture wording is unchanged; no model-facing instruction changed.
Prompt finding: 38a2c5d186f1 | protocol-literal | Existing test fixture wording is unchanged; no model-facing instruction changed.
Prompt finding: 9781075d458e | protocol-literal | Existing test fixture wording is unchanged; no model-facing instruction changed.
Prompt finding: 45e37ea2e9e9 | protocol-literal | Existing test fixture wording is unchanged; no model-facing instruction changed.
Prompt finding: b1bb3946362d | protocol-literal | Existing test fixture wording is unchanged; no model-facing instruction changed.
Subject: src/assembly/production-provider.ts, src/assembly/harness.declarations.json, tests/assembly/production-provider-subscription.test.ts, generated/*

Decision: auth-status-session-parity-1351 | Descriptor-handoff session admission verifies the selected profile and executable, then lets the real Claude Code session establish availability; stored-login sessions retain account, organization, plan and auth-method status checks. | reported=reviews/auth-admit-retry-1102-change-review.md

## Closing block

simplestRobustRoute: Bypass the metadata-only status call only for descriptor handoffs, with physical identity checks unchanged; preserve stored-login status verification.
80/20: Let the real Claude Code session test the handed-over login; retain typed rate-limit swap behavior without claiming generic auth-failure swap.
VERDICT: author submission; no independent review verdict claimed.
