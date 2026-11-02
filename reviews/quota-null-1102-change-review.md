# Change review — 1.x parity when five-hour telemetry is missing

Subject base: a3197321b31b292a2c429d9b905b9fc6bb8c2d71
Review state: open
Reviewed content: none
Outcome: Justin directed 2.0 to match shipped 1.x: when five-hour telemetry is absent, fresh weekly usage decides placement; an actual provider rate limit triggers the normal swap. Malformed present windows and malformed scoped weekly caps still block placement.
Affected rules: R95 quota threshold and the retained 80% lag-aware placement ceiling; durable session handoff remains required.
Affected floors: secrets — unchanged transient credential handling; spend cap — no new provider call or inference; stop — unchanged; no duplicate sends — unchanged; durable intake — queued turns remain in the host and are not replayed by this change.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes live login admission on a serving runner. Justin directed immediate 1.x parity, targeted tests and installation; the review record remains explicit about that scope.
Side effects: An approved account with fresh weekly headroom can be selected when the five-hour field is missing or null. Active scoped weekly limits are also checked; existing provider-limit holds persist. No account, credential or message is copied.
Undo and recovery: Keep this worktree isolated until gated. If installed and the live check fails, restore the previously attested build through the paused switch while retaining the current journal and queued turn.
Multi-machine posture: Studio-local serving login pool; no remote machine or shared quota file is changed.
Layer below: At 11:14 PST Justin directed exact 1.x subscription-pool parity. Fresh polling shows all eight Claude accounts lack five-hour readings, including heavily used Adriana (99% weekly). An Echo-profile provider call succeeded and a subsequent poll still omitted the short reading. This is missing telemetry, not proof the limit is inapplicable. Weekly data and actual provider refusals govern placement as in shipped 1.x.
Bug class: live-path
Bug evidence: reproducer=tests/preview/harness-login-pool.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/SEAM-LEDGER.md
Hook bypass: none
Convergence: none
Verification: Focused quota-reader and login-pool tests 97/97 PASS at 11:17 PST. The four targeted files passed 132 tests (one skipped) at 11:51 after adding the real 1.x fallback case. At 12:08, harness-user, login-pool and quota-reader tests passed 147/147 after raising the bounded harness access probe to cover the current large /private/tmp census. Exact-head preflight and live reply evidence pending.
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No model-facing prompt or fixture text changed. The user-visible pool status says five-hour unreported when the provider omits it. No model-facing prompt changed.

Subject (13 paths): scripts/claude-pool-quota.mjs, tests/preview/claude-pool-quota.test.ts, tests/preview/harness-login-pool.mjs, tests/preview/harness-login-pool.test.ts, tests/preview/harness-user.mjs, tests/preview/harness-user.test.ts, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

Decision: weekly-parity-1114 | Justin ordered shipped 1.x quota behavior for 2.0; source commit 05db58a09 and generated register commit 7761e4159 are both inside this reviewed change. Missing short telemetry is unreported, active scoped weekly caps remain checked, and actual provider refusals keep their holds. | reported=reviews/quota-null-1102-change-review.md
Decision: fallback-weekly-1150 | The live provider quota endpoint returned 429 at 11:50 while the fresh 1.x pool snapshot showed Echo at 11% weekly with no five-hour field and no 2.0 marker. A 2.0-only marker cannot be required for that 1.x snapshot; a fresh, valid weekly window and absent short window are sufficient. | reported=reviews/quota-null-1102-change-review.md
Decision: register-pin-1154 | Generated register files were pinned to source commit 7a484f2d7 in commit 37945c153; this is the generated counterpart of the reviewed weekly fallback source, with no additional runtime behavior. | reported=reviews/quota-null-1102-change-review.md
Decision: harness-probe-1208 | The copied canary refused before launch because the separate harness user's required access proof timed out at 10 seconds while checking more than 2,700 operator-owned temporary entries. Keep every kernel access check and allow that bounded one-shot proof up to 45 seconds; never fall back to the operator's account. | reported=reviews/quota-null-1102-change-review.md

## Closing block

simplestRobustRoute: Keep the current reader and selection path; treat an absent short window beside fresh weekly data as unreported in both live and 1.x snapshots, and carry active weekly limits from the raw response.
80/20: Use a fresh weekly reading when the short reading is missing, reject malformed present windows and active scoped limits, and keep provider-refusal holds.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
