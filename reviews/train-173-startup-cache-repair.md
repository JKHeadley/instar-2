# Change review — reuse the signed-cache startup repair on train-173

Subject base: 83efc9a20e655fc171628e8add13de10978c4058
Review state: open
Reviewed content: none
Outcome: The existing authorized subscription profile remains usable when the pinned CLI refreshes its signed policy cache, so the tool route can reach model dispatch.
Affected rules: 9, 26, 34, 36, 37, 38, 42, 43, 49, 73, 74, 95, 101, 105, 111, 112, 113, 115, 116
Affected floors: Secrets remain in custody with outbound checks; spend caps and stop remain enforced; no duplicate sends or retries are introduced; accepted intake stays in the durable journal.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Integrates the already-owned host preflight repair without changing its implementation, model prompts or output decisions.
Side effects: Recognized signature metadata is checked for shape, path and size but is not effective policy or Instar authority. Restrictive first-fetch cache arrival preserves pre-cache enrollment; cache-bound profiles retain their policy bindings. Unknown or permissive settings, unsafe files and disabled hooks still refuse. No serving profile, grant or copied journal is edited. The Studio desk renewal tool binds the native certificate to the changed composition only after contract verification; derived pins/register are regenerated, not hand-edited.
Undo and recovery: Revert this integration and regenerate source evidence. Retained turns remain durable; do not resend unknown effects. Studio reruns the answer gate before deployment.
Multi-machine posture: Each machine inspects its own installed profile and cache; the implementation and fixture travel through git. No new shared state or ownership mechanism.
Layer below: Read-only status of forum-answer-copy-20261105-152910; actual profile inspection; provider construction and model launch boundary; the owning repair's full diff, public cache fixture and refusal tests; owner-source and register generators.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/subscription-policy-signatures.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-deploy.log
Deferral: generated/register.json:1 | not-a-deferral=Existing generated governing text; publication adds no deferred work.
Hook bypass: none; core.hooksPath unset and the common hooks directory contains samples only.
Convergence: none
Prompt review: No model prompt, model-output parser or semantic accept/refuse judgment changes. The failed update has zero model calls and no output to replay. Tests replay the actual host-cache bytes that prevented dispatch; inherited summary/Jev/reply-review and delivered-answer behavior is unchanged.
Decision: train-173-cache-owner | Reuse the exact source/tests/fixture of owning commit 0c1d832a4816aeb21891e5a89242497d12c76fc1, already identified for the same train-174/train-175 failure. Do not create a second implementation or retry loop. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-173-repair-PROGRESS.md
Decision: train-173-cache-evidence | Verify recorded metadata and refusal neighbors, then inspect the actual profile read-only; the Studio pipeline owns the new live answer and full suite. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-173-repair-PROGRESS.md

Decision: train-173-cache-publication | Use the existing desk native-contract renewal and source-pin/register tools to bind verification to this composition; preserve all authority and runtime settings. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-173-repair-PROGRESS.md

Recorded evidence: The 2026-11-05 15:29–15:30 train-173 check kept update 840344300 with zero model launches and a model-not-started hold. Read-only inspection reproduced `policy-limits.json.signature.json: unexpected file; activation hold`. After the unchanged owner repair, the same installed profile reports identityMatches=true, managedMatches=true, hooksDisabled=false. No runner was started against the preserved copy. The eight reminder assertion failures supplied in the brief were already repaired in this starting head and remain intact.

1.x comparison: Inherit the owning repair's actual JKHeadley/instar main cc11e45f92e2590dd1bbd3c3facb5b849532f0fc search of src/, docs/specs/ and git history for policy-limits/remote-settings; no matching cache inspector. Related src/core/SessionManager.ts handleReadyAndInject and docs/specs/cli-login-expired-opens-repair.eli16.md, history 7da5a52ff, preserve real startup evidence. Independently verified current main 154a09ffd44749ceac6205e4a95a9df4c56f4659 and searched src/ and docs/specs/ for startup failures, folder trust and cache names; inspected SessionManager.ts ensurePinnedHomeInteractiveReady, docs/specs/spawn-postdelivery-bookkeeping-truth.eli16.md and history 4e38b9fda, e460a9be3, ab26b7ca3. ONEX-LESSONS.md sections 2 and 4 apply. These establish pre-launch versus post-launch evidence discipline, not a matching 1.x cache implementation; reuse the whole existing 2.0 owner repair instead of unrelated session retry code.

Validation: `nice -n 10 npm run typecheck` and build exited 0. The two affected test files passed all 122 tests in 175.52 seconds. Real-profile read-only inspection matched both existing digests with hooks enabled. The desk native renewal passed 9/10 before (only stale certificate) and 10/10 after, exit 0. Desk owner rehash and repin both exited 0 with no changed pins. Final publication and cheap-gate results are recorded in the canonical repair PROGRESS file.

simplestRobustRoute: This is the simplest robust route: apply the single owning repair unchanged, retaining the existing profile, hook and effect checkpoints. It repairs the observed cache mismatch without narrowing tools, adding retries or changing authority. Recorded input and exact owner patch guard entry; positive/refusal tests and read-only real-profile inspection guard this submission; Studio's answer gate guards live acceptance.
80/20: Run tsc, the two affected test files and required cheap gates. Full-suite and live-answer acceptance remain with the automatic pipeline; no new full-run report is claimed.
VERDICT: author submission; no independent convergence claimed
