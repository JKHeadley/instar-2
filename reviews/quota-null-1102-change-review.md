# Change review — Explicitly absent five-hour usage window

Subject base: a3197321b31b292a2c429d9b905b9fc6bb8c2d71
Review state: open
Reviewed content: none
Outcome: An explicit provider `five_hour:null` with only weekly limits is represented as not applicable; fresh measured weekly headroom can admit an approved fallback. Missing and malformed windows still block proactive placement.
Affected rules: R95 quota threshold and the retained 80% lag-aware placement ceiling; durable session handoff remains required.
Affected floors: secrets — unchanged transient credential handling; spend cap — no new provider call or inference; stop — unchanged; no duplicate sends — unchanged; durable intake — queued turns remain in the host and are not replayed by this change.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes live login admission on a serving runner. Full exact-head gate and independent review are required before installation.
Side effects: A weekly-only approved account can be selected when its five-hour field is explicitly null and the provider lists weekly limits only; no account is added, no credential or message is copied.
Undo and recovery: Keep this worktree isolated until gated. If installed and the live check fails, restore the previously attested build through the paused switch while retaining the current journal and queued turn.
Multi-machine posture: Studio-local serving login pool; no remote machine or shared quota file is changed.
Layer below: The provider OAuth usage endpoint returned HTTP 200 with `five_hour:null`, weekly utilization 8%, and weekly-only limits for Echo at 08:49 PST. The official Claude /usage view displayed only weekly usage. The imported 1.x snapshot drops the null; the 2.x live reader carries the explicit fact. Treating that pair as no configured five-hour window is an inference from the response shape and the official client view, subject to independent review.
Bug class: provider-declared absent quota window interpreted as incomplete telemetry
Bug evidence: Live message 701 remained queued with primary at 99% weekly; fresh 1.x poll read 13/13 but all lacked five-hour values. Current 2.x selector requires both windows for a destination. Ledger 2026-11-02 08:50 PST.
Hook bypass: none
Convergence: Focused quota-reader and login-pool tests 93/93 PASS; direct selector boundary PASS; typecheck PASS. Lint, register:check and typecheck PASS after exact source pin regeneration; full gate and independent review pending.
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No model-facing prompt or fixture text changed. The user-visible pool status now says five-hour not applicable only when that specific provider fact is present.

Subject (11 paths): scripts/claude-pool-quota.mjs, tests/preview/claude-pool-quota.test.ts, tests/preview/harness-login-pool.mjs, tests/preview/harness-login-pool.test.ts, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: Keep the current reader and selection path; carry one explicit applicability bit from the raw response to the selector.
80/20: Handle the observed weekly-only response and refuse omitted, malformed, stale, or non-weekly limit shapes.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
