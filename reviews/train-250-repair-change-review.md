# Change review — train-250 answer-check diagnosis

Subject base: 47d0dffffc4d0c48bdf190d0c70b1bee27a568d6
Review state: open
Reviewed content: none
Outcome: Supplement the original train-250 integration review with the copied live-path evidence. Record why the answer gate reported a false failure and reuse the single shared train-249 probe repair. The candidate delivered the requested marker; the browser observer had already returned on an infrastructure reminder.
Affected rules: 26, 34, 35, 36, 37, 42, 43, 49, 62, 70, 74, 89, 101, 102, 111, 113, 116, 123
Affected floors: secrets remain in existing vault/child memory; spend cap and stop unchanged; no duplicate sends preserved by read-only diagnosis and the existing one-send probe; durable intake and delivery receipts unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: The review subject includes the original critical integration; this evidence supplement changes only documentation and shared desk artifact custody, with no product behavior, test guard, prompt or authority change. Original integration evidence remains in reviews/train-250-change-review.md.
Side effects: No product change. The shared desk repair waits within the existing 420-second bound for the probe's existing exact marker in its requested topic. Generic sender behavior and the final journal/API-accepted/browser evidence checks remain unchanged. It may wait longer when an infrastructure notice precedes an answer, as intended.
Undo and recovery: This documentation-only commit can be reverted without changing the journal. Shared desk files have .bak-train-249-repair backups, owned by train-249. Do not revert those independently or resend an uncertain probe. Retain the failed copy read-only for evidence.
Multi-machine posture: Studio-local proof instrumentation, with the existing room lock and bot ownership. No product ownership, replication or transfer change.
Team posture: Existing test-room bot, topic and browser lock remain the audience boundary; no sharing or role grant changes. No new disclosure surface.
Layer below: Read-only journal status/inspect, signed infrastructure notice versus durable agent reply receipt, browser observation timing, optional marker wiring from answer-check-forum.sh through forumroom-send.mjs to hasAnswer, and final independent journal/browser marker gate.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only.
Convergence: none
Prompt review: No model-facing change. Exact recorded reminder and delivered reply replay exercises the shared probe predicate; no new summary, Jev or reply-review implementation is introduced.
Decision: train-250-repair-1 | Reuse train-249's already-applied shared desk repair, with exact-byte verification; do not duplicate its fix or change the product to mask a premature browser observation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-250-repair-PROGRESS.md

Evidence: preview-deploy.log 2026-11-12 13:49:04 returned reminder message 2967 after probe 2966 at 14 seconds. Read-only status and inspect of forum-answer-copy-20261112-134807 show update 367056463 answered, marker probe-b23edf44 in Telegram message 2968, outcome api-accepted, intake-to-API-accepted 26320 ms. The probe had captured the earlier notice and never refreshed its browser observation. No runner was launched against the copy. No fresh live gate pass is claimed.

1.x comparison: searched actual local JKHeadley/instar origin/main db3ed6d3052cfcc24888b6c8bc86086abcfc2987 src/ and docs/specs/, then read src/messaging/shared/isSystemOrProxyMessage.ts, docs/specs/compaction-recovery-proxy-filter.md and its git history ab26b7ca3. ONEX-LESSONS.md delivery/compaction section 3 covers infrastructure notices masking unanswered work. Reuse that behavior; the text-prefix catalogue is unnecessary for this exact-marker probe. The existing groupmain-send.mjs marker mechanism is reused by train-249. No claim of newly fetched 1.x state.

Shared repair custody (all paths under /Users/dabombstudio/.instar/agents/echo/.instar/lanes/, never committed; each backup is the path plus .bak-train-249-repair):
- forumroom-send.mjs: sha256 dcec205ab57563a6f215bf4dfcc2d45da0658e805f493b663268a14cd066ae60
- answer-check-forum.sh: sha256 7d10e784fb216bc61431762f7b5a621e3917b7479392651641acbf9c146da6ab
- helper-forumroom/forum-topic.mjs: sha256 8c53e3c19a3d2c15525480e617878c9e30f257b08cbbe47c2164624d067a0d5b
- helper-forumroom/forum-topic.test.mjs: sha256 c88df8b025da24c3ee64e9068245af087fa01834913abc68743eac1a1e041bd1

Verification: shared helper suite 9/9 passed; node --check sender and bash -n answer-check passed. Desk-only train-250-repair-replay.mjs reads the exact logged 2967 reminder and copied journal's 2968 answer: reminder alone stays pending; later answer satisfies the marker; wrong topic, wrong marker and empty bubble stay pending. The repair report records final typecheck and cheap gates. Full suites and fresh live probe execution remain pipeline-owned as instructed.

simplestRobustRoute: Reuse the single existing shared probe repair and record exact evidence. No additional runtime mechanism is needed. Start guard is the exact sent probe/topic; end guard remains both the API-accepted journal reply and browser observation containing its marker; the existing wait bound and one-send behavior hold. This is the simplest robust route, with no new unattended live completion claim.
80/20: No product edits. Exact copied-journal evidence and the existing nine-case helper suite establish the cause and both predicate neighbors without a full suite or another live send.
VERDICT: author submission; independent review and the fresh pipeline answer check remain outstanding.
