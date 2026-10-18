# Change review — sb-w4-honest-limit: honest launch and usage-limit replies

Subject base: 9d8089a6db175d9ed72ae30a7f8347b158301ffe
Review state: open
Reviewed content: none
Outcome: Merge reviewed w4-honest-limit 1937b4a619fbaa77102baebd4b8ed785484c5520 onto the exact live server-policy base. The ordinary merge fast-forwarded without conflicts. Carries honest pre-launch replies, metered capacity holds with reset time, one notice per topic and one desk alert per episode, and the repair covering retries, timeout replacements, lookup and retained active alerts. The integration repairs a test's before-send failure injection to observe model completion instead of counting admission reads; shipped unit code is unchanged.
Affected rules: purpose 2/3; 1, 4, 14, 26, 34, 36, 37, 39, 42, 49, 52, 53, 60, 63, 66, 69, 70, 74, 75, 77, 87, 89, 90, 95, 101, 111, 112, 113, 116
Affected floors: secrets — fixed sanitized notices and existing outbound checks; spend cap — launched attempts and prior UNKNOWN/tool liability remain charged; stop — existing dispatch checks; no duplicate sends — durable minimal intent and per-episode deduplication; durable intake — encrypted held originals retained, explicit resend required
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Carries changes to provider admission outcome accounting and user-visible failure delivery.
Side effects: Capacity alerts derive from durable episode facts until successful model recovery. Certified nonlaunch releases only the current invocation's reservation. The original turn stays held; no automatic retry or recovery promise. The new hold metadata must remain readable after rollout. No source, prompt, guard constant or authority change is added by the integration.
Undo and recovery: Before rollout, revert this integration and carried changes. After new hold rows or snapshots exist, retain a compatible reader and journal; do not replay unknown launches or sends. Restore prior artifacts together with their source pins if reverting the register.
Multi-machine posture: Existing exclusive journal writer and replication. Episode and notice facts live in the journal; no additional machine-local store or authority.
Layer below: Carried reviews/w4-prelaunch-honest-change-review.md, reviews/w4-honest-limit-change-review.md and reviews/w4-honest-limit-repair-change-review.md; launch certification, invocation settlement, durable holds, minimal intent, ownership/disclosure/stop, status projection and register pins. The before-send fixture now denies only after its model callback has run and retains all recovery and deduplication assertions.
Bug class: integration
Bug evidence: reproducer=tests/preview/group-carry-requests.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Decision: w4-honest-limit-resend | carry the reviewed unit's durable hold and minimal responder, explicit resend requirement and retained launched attempt at 1937b4a6 | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-honest-limit-PROGRESS.md
Decision: sb-w4-honest-limit-merge | ordinary fast-forward from the required live head, no conflicts or document edits | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-honest-limit-PROGRESS.md
Decision: sb-w4-honest-limit-disclosure-fixture | model-completion observation locates the before-send refusal despite the additional admission check; retain all original assertions | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-honest-limit-PROGRESS.md
Decision: sb-w4-honest-limit-desk | use the cint-L37 repin/build/rehash/register-replay chain; generated output is never hand-edited | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-honest-limit-PROGRESS.md
Prompt review: No new prompt wording. Replay carries the genuine September 24 quota frame, 384 proof-room rows at updates 715672479–715672500 (including summaries, uncertain summary reservations, Jev unsure/unavailable/undecided, reply reviews and deliveries), recorded timeout 6230665, and P4 lookup output for question 6230509 and memory 6230474. The recorded answer 715672480 exercises group disclosure recovery. The inherited read-only inspection found no captured empty delivered bubble; the separate empty-answer control is explicitly synthetic. The October 10 session wording is reconstructed in a captured envelope, not claimed as raw captured bytes.
Prompt finding: 849db3a6296a | protocol-literal | existing fixed memory-list reply wording, unchanged by this integration
Prompt finding: bd01de21286a | protocol-literal | existing source citation guidance, unchanged by this integration
Prompt finding: fb5fa7e706c8 | protocol-literal | existing source grounding guidance, unchanged by this integration

simplestRobustRoute: This is the simplest robust route: merge the reviewed code and reuse the existing desk chain. The only test repair binds its injected fault to observed model completion. No new machinery. Provider admission, stop, ownership and spend remain start/limit guards; durable send intent is the end-state guard. Offline shipped-worker/status replay supports the submission, not a live deployment claim.
80/20: Targeted verification is recorded in the lane PROGRESS, including the initial two fixture failures and their repair. Plain always-sent bytes are 21,693 under the unchanged 22,959 guard; tool bytes are 23,322 under the existing 24,503 allowance. The desk chain refreshed no inventory or owner pins and replayed seven generated artifacts against 57130731467f7898eac39b083004b6a6445c0225; build-register --check is true. Typecheck, lint and architecture pass. The macOS fixed-volume tool-persist case is omitted per the task; no checked-in skip is added. Full suite and independent landing review belong to the pipeline. This record asserts neither deployment nor independent convergence.
VERDICT: author submission; the independent gate records its own verdict
