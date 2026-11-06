# Change review — train-184 shared signed-cache integration

Subject base: 87c11cb7d3cf9982c648d8983f5e361db3c70691
Review state: open
Reviewed content: none
Outcome: Integrate the exact owner cache repair for an admitted profile's pre-child refusal. Source handoff only under original D; release and real-answer acceptance remain separate.
Affected rules: 26, 34, 36, 37, 42, 49, 69, 70, 74, 95, 101, 102, 105, 109, 111, 112, 113, 116
Affected floors: secrets — existing custody unchanged; spend cap — no calls or retries added; stop — existing dispatch checks; no duplicate sends — no runner or replay; durable intake — original retained inputs preserved.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Exact narrow pre-child host repair, preserving owner source and tests.
Side effects: The existing inspector validates bounded signature metadata separately from effective policy. Restrictive first-cache arrival preserves pre-cache enrollment after validation; cache-bound enrollment retains its binding. Unknown or unsafe files, permissive settings and hook changes remain refused. Metadata grants no authority; the CLI verifies signatures.
Undo and recovery: Revert the integration and regenerate publication through the desk chain. Original pre-child refusal returns. Retain input and unknown effects; do not resend them.
Multi-machine posture: Machine-local cache inspection under existing enrollment. No ownership, replication, authority or transport change. Studio owns native and installed/live qualification.
Layer below: Exact owner 0c1d832a4816aeb21891e5a89242497d12c76fc1; subscriptionServerPolicy and inspectSubscriptionProfile; real public cache fixture; desk profile-readonly.json comparison of 87c11cb7 refusal and 669e02ab identity/digest match with hooks enabled. Original drain and notice repairs remain intact.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/subscription-policy-signatures.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/train184-desk-1701/profile-readonly.json
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only
Convergence: none
Prompt review: Model instructions, output parsers and judgments are unchanged. Replay captured public metadata offline; preserve historical captures, questions, rubrics and PASS/FAIL. No model or provider call.

1.x FIRST: Owner comparison is pinned to cc11e45f92e2590dd1bbd3c3facb5b849532f0fc. Verified src/core/SessionManager.ts handleReadyAndInject retention and bounded stale-resume retry. Fresh origin/main da443e0dce3e7b85b8b44548c9c98bd0333b6a80 searches covered src/, docs/specs/ and git -G history for policy-limits, policyLimits and remote-settings.json. The inspected relevant behavior is startup retention and corroborated login failure in docs/specs/cli-login-expired-opens-repair.eli16.md and commit 7da5a52ff43bfdde2403f43e7696df9e6d22fbb6, which repairs account state after repeated CLI expiry signals. That mechanism does not inspect the 2.0 cache schema. ONEX-LESSONS section 4 supports corroboration and captured-byte replay. Reuse the whole existing 2.0 owner fix rather than add login retry machinery.

Decision: train184-cache-reuse | Apply exact six-file owner patch without unrelated train-175 history; rebind only copied review metadata and preserve source/test/fixture bytes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-1714-PROGRESS.md
Decision: train184-cache-host | Preserve original D and every observed failure. The physical positive case returned transport uncertainty with zero synthetic commands, while preflight identity/digest assertions passed; local /bin/sh rejects ulimit -u. Correct-host native/full/independent/answer/install/live evidence remains required. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-1714-PROGRESS.md

Verification: Portable signatures 17/17. Changed provider cases 2 passed, 1 failed, 102 unselected; a single diagnostic repeated the physical failure (transport, zero commands). Typecheck passed. Full gate outcomes and final publication checks are recorded in the report. Temporary diagnostic removed; no timeout, guard or certificate altered.

## Closing block

simplestRobustRoute: Reuse the exact owner repair through the existing bounded inspector. This is that route. Start at exact 87c11cb7 with the desk's profile evidence; finish with a pushed candidate and finite checks. Identity, policy, hook, cap, stop, intake and uniqueness floors remain. This record claims no unattended live completion.
80/20: Finite portable signature suite, directly changed provider cases, and structural checks. Studio retains full and native qualification and independent acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
