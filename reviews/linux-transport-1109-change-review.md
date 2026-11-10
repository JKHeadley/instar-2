# Change review — Linux Telegram transport resource helpers

Subject base: 0bde1fda553a2609382d221684b152aa71cdb634
Review state: open
Reviewed content: none
Outcome: Telegram identity/send and long-poll children use the existing capable-shell selection and platform-aware task census, allowing Linux Node startup within finite resource ceilings.
Affected rules: 1/60 preserve kernel limits; 26/70 test actual caller wiring and real child execution; 30 keep OS behavior in the host adapter; 42/95 preserve non-delivery versus unknown settlement; 49/74/102/111/113/116 record evidence, side effects, decisions, lower layer and local posture.
Affected floors: secrets — credential remains on stdin, unchanged custody; spend cap — unchanged; stop — existing exact-child timeout and cleanup retained; no duplicate sends — unchanged settlement and unknown handling; durable intake — unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: narrow reversible host adapter repair; resource floor remains finite and no authority is added.
Side effects: Linux selects a shell supporting process limits and counts threads rather than processes. Its per-UID headroom is 16 tasks, sufficient for observed Node startup (seven threads) and DNS/libuv (eleven), instead of four processes on macOS. The ceiling still inherits any tighter limit. Concurrent UID activity can consume headroom and refuse launch; census failure and root retain existing behavior. No resource-owner policy, model prompts, parser, grants, or send retry logic changes.
Undo and recovery: revert this commit and restart the transport host; no durable format or installed state migration. Reverting restores the Linux startup defect.
Multi-machine posture: deliberately machine-local; each transport host measures its own UID and selects its own shell. Conversation ownership and replicated state are unchanged.
Layer below: inspected resource-owner.mjs selectLimitShell, limitShell, userTaskQuery, limitedFileArgv and limit-exec.sh. Shell probes are bounded; failed selection is not cached; the shim lowers soft and hard limits before exec. Real Linux child probes showed four spare tasks time out, sixteen start Node with seven threads and perform localhost DNS with eleven threads. The transport settlement still treats only proven pre-dispatch refusal as not sent; ambiguous child exit remains unknown.
Bug class: integration
Bug evidence: reproducer=tests/preview/telegram-transport-resources.test.ts
Hook bypass: none; core.hooksPath=.husky/_ but that directory is absent in this worktree. Shared git hooks directory contains sample files only. No bypass flags used.
Convergence: none
Decision: linux-transport-existing-helpers | reuse limitShell and userTaskQuery for both Telegram invoke and poll; retain the one existing shim | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/linux-transport-1109-PROGRESS.md
Decision: linux-transport-task-headroom | use sixteen Linux tasks versus four macOS processes because Node and DNS require eleven observed threads; keep finite inherited limits | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/linux-transport-1109-PROGRESS.md
Prompt review: no model-facing prompt, output interpretation or judgment change; recorded model-output replay does not apply.

1.x comparison: searched JKHeadley/instar main at 6cbe44c819cd97aec1d9c7f470b04148fbca708d src/, docs/specs/ and history. src/monitoring/hostMemoryPressure.ts and commits 9c178dc4b/a75a55402/4bfa23f7b use platform-correct resource readings; docs/specs/forkbomb-prevention-simple.md and ONEX-LESSONS.md section 6 require host-scoped finite resource bounds and actual wiring proof. Reused that design through the already-present 2.0 helpers; memory parsers and the 1.x host semaphore do not fit this child-launch wiring repair and are not copied.

Independent second pass (review_transport): concur with the final repair and side-effects review. The first pass found that reusing a Linux thread census with four spare tasks still prevents Node startup; the final change supplies sixteen Linux tasks and retains four macOS processes. Independently reran the injected Linux/Darwin caller tests: 2 passed. Lower-layer real probes in one Linux execution namespace observed ten UID tasks: headroom four timed out, headroom sixteen started Node with seven threads, and sixteen also completed localhost DNS with eleven threads. These are bounded child probes, not a whole-host census or live Telegram deployment proof; PID namespaces and concurrent UID activity can affect available headroom. Both transport launch paths retain the existing shim and settlement distinction, with no new retry or send authority. No remaining finding in this narrow diff; independent landing acceptance remains the desk's responsibility.

simplestRobustRoute: this is the simplest route: replace the duplicated OS assumptions with two existing helpers and provide enough finite Linux task headroom for the actual runtime. Start guard is the existing shell limit shim; end-state guard is unchanged child settlement; limit guards remain CPU, handles, tasks, heap, elapsed time and output bytes. No new supervisor, policy engine, state or provider is introduced. This is a startup repair submission, not an autonomous feature completion or live deployment claim.
80/20: approximately 75 runtime/test changed lines plus this required review. Targeted caller tests and remote READY checks only; native macOS conformance re-pin belongs to the Studio desk.
VERDICT: author submission; independent landing acceptance belongs to the desk
