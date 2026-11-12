# Change review — train-249 forum answer probe repair

Subject base: 4ea8cbbfa3dc3ba5c0e97cd5acf30f4c4faab15b
Review state: open
Reviewed content: none
Outcome: Let the forum answer probe wait for its own marker instead of stopping the candidate on an activation reminder.
Affected rules: 26, 34, 35, 36, 37, 42, 43, 49, 62, 70, 74, 101, 102, 111, 113, 116, 123
Affected floors: secrets — existing vault key only in diagnostic child memory; spend cap — unchanged; stop — same bounded wait and stop path; no duplicate sends — unchanged one-send path; durable intake — failed copy opened read-only.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Desk instrumentation repair with a product-journal regression; no product behavior changes.
Side effects: Marker probes can wait the full existing 420-second budget through notices; generic sends keep their prior acknowledgement filter. No product behavior or review judgment changes.
Undo and recovery: Restore the four exact desk backups listed below together; no journal rollback or effect replay. Reverting this review alone does not revert desk scripts.
Multi-machine posture: Studio-local probe instrumentation; existing owned journal and replication remain unchanged.
Team posture: Existing test bot/topic/browser lock and audiences unchanged; no new visibility or grant.
Layer below: Read the room-one sender wait, groupmain marker wait, forum helper verdict, answer-check marker/journal gate, and read-only preserved journal call outcomes.
Bug class: integration
Bug evidence: reproducer=tests/preview/activation-reminder-once.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model-facing change. Captured reminder text is offline test evidence, not a new judgment or prompt. The existing exact-marker proof gate remains unchanged.
Decision: train-249-repair-1 | Repair the probe wait: the notice ended observation while the journal shows reply revision still running; reuse the existing marker wait and preserve product behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-249-repair-build-report.md

1.x comparison: Searched actual JKHeadley/instar origin/main db3ed6d3052cfcc24888b6c8bc86086abcfc2987 src/ and docs/specs/, read src/messaging/shared/isSystemOrProxyMessage.ts and docs/specs/compaction-recovery-proxy-filter.md, and their history f0d03ccc8 / ab26b7ca3. Read ONEX-LESSONS.md section 3. Reuse the distinction between notices and answers; its prefix catalogue is unnecessary for an exact-marker probe. Existing 2.0 groupmain-send.mjs already provides the fitting marker wait.

Evidence: preview-deploy.log 2026-11-12 13:46:51 and 13:47:29; preserved forum-answer-copy-20261112-134548. Message 2965 is only a reminder after probe 2964. Update 367056462 produced model output, completed review, then its revision was interrupted by the probe's SIGTERM. The sender stopped waiting after 14 seconds despite its 420-second budget. Read-only status and inspect were used; no runner ran against the copy.

Verification: the journal regression holds a model call with an injected promise, proves the reminder is delivered while the answer stays pending, then releases real recorded model output and proves exactly one answer. Nine offline forum-helper tests pass, including exact recorded reminder text, later matching answer, wrong marker/topic, empty and acknowledgement negatives, and ordinary answer positive. Sender node syntax and shell bash syntax checks pass; tsc --noEmit passes. The missing inherited work-repair-uncertain-1112-build-report.md was materialized from its existing original PROGRESS report, exactly as that handoff requests. The automatic pipeline owns the fresh live proof and full suite. No new live-answer success is claimed.

Desk artifact custody (not committed, per charter):
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/forumroom-send.mjs | sha256 dcec205ab57563a6f215bf4dfcc2d45da0658e805f493b663268a14cd066ae60 | backup /Users/dabombstudio/.instar/agents/echo/.instar/lanes/forumroom-send.mjs.bak-train-249-repair
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/answer-check-forum.sh | sha256 7d10e784fb216bc61431762f7b5a621e3917b7479392651641acbf9c146da6ab | backup /Users/dabombstudio/.instar/agents/echo/.instar/lanes/answer-check-forum.sh.bak-train-249-repair
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/helper-forumroom/forum-topic.mjs | sha256 8c53e3c19a3d2c15525480e617878c9e30f257b08cbbe47c2164624d067a0d5b | backup /Users/dabombstudio/.instar/agents/echo/.instar/lanes/helper-forumroom/forum-topic.mjs.bak-train-249-repair
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/helper-forumroom/forum-topic.test.mjs | sha256 c88df8b025da24c3ee64e9068245af087fa01834913abc68743eac1a1e041bd1 | backup /Users/dabombstudio/.instar/agents/echo/.instar/lanes/helper-forumroom/forum-topic.test.mjs.bak-train-249-repair

simplestRobustRoute: Reuse the existing marker-aware wait in the existing sender/helper; no new classifier catalogue or runtime machinery. Start guard is the existing bot/topic and one sent probe; end guard remains marker plus journal api-accepted delivery; existing timeout and stop remain the limits. This is the simplest robust route. No autonomous shipped-path completion claim is made.
80/20: Target the diagnosed early-exit condition, its positive and negative neighbors, and required cheap gates; no full suite or live rerun on the preserved copy.
VERDICT: author submission; independent compliance and landing verdict remain with the desk
