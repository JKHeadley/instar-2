# Change review — queue a task when the pre-dispatch subscription status check is unavailable

Subject base: 81517fbe093c525559ee497fcd79bf964b07459b
Review state: open
Reviewed content: none
Outcome: The 12:34 live #2190 task reached the per-topic conversation host on sagemind-echo. The host recorded `subscription authentication status unavailable`, no child worker, and zero input-dispatch attempts. It settled the task uncertain and sent failure notice 704. A same-login read-only status call at 12:42 passed in 775 ms. The failed call's exit code or timeout detail was not retained, so its immediate cause is unknown.
Affected rules: R1 no duplicate sends and durable intake, R68 queued accepted work across launches, R70 live-path reproduction, and R95 subscription-pool placement.
Affected floors: No duplicate sends and durable intake are preserved by retaining the same request ID before dispatch. Secrets and harness identity are unchanged; worker launch still requires a successful status check. Spend and stop boundaries are unchanged; the queued request gets no extra allowance.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes live handling of an admitted operator task. Justin requested 1.x parity, and the observer requested the smallest fix to the 14-second failure.
Side effects: Only the exact `subscription authentication status unavailable` admission error is deferred. A five-second local backoff avoids a tight retry loop. Other errors remain failures. No external action occurs before a successful admission.
Undo and recovery: Revert the source and generated register in an isolated worktree, or roll back the serving build while preserving the journal. A queued item remains in durable custody across runner restarts.
Multi-machine posture: This is within the Studio-local conversation host; it adds no shared owner, sender, or credential path.
Layer below: The installed host's `resources.admit` checks `claude auth status --json` under `_instarharness` for the selected Echo profile before any worker launch. Its generic failure was treated as an uncertain completed attempt despite zero dispatch. The host already has a null-resource result path that keeps the request queued and retries on the ordinary tick.
Bug class: live-path
Bug evidence: reproducer=tests/preview/session-auth-admission.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-trial-root/justin-group-20261010/session-work-state/conversation.json
Hook bypass: none
Convergence: none
Verification: `session-auth-admission.test.ts` 2/2 and `production-conversation-session.test.ts` 172/172 pass; build passes. Exact-head full suite and live retest pending.
Prompt review: No model-facing prompt changed.
Subject: scripts/session-auth-admission.mjs, tests/preview/journal-agent.mjs, tests/preview/session-auth-admission.test.ts, generated/*

Decision: auth-status-queue-1250 | A status probe that cannot establish auth before worker launch returns the host's existing no-resource result, keeping the task queued for the same ID; all other admission errors remain failures. | reported=reviews/auth-admit-retry-1102-change-review.md

## Closing block

simplestRobustRoute: Reuse the host's existing queued, pre-dispatch resource-refusal path for this one status-unavailable result.
80/20: Keep the admitted task; retry the bounded auth check after five seconds; dispatch only when it succeeds.
VERDICT: author submission; no independent review verdict claimed.
