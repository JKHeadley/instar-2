# Change review — train-245

Subject base: e3cb0f08d3a74d70c9e059edbd64fc457492bfff
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed activation-reminder head: one no-action notice per activation end date, truthful status and self-state, with real credential reminders unchanged.
Affected rules: 8, 34, 36, 37, 42, 49, 52, 69, 74, 87, 90, 100, 101, 102, 111, 113, 116, 123
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain existing enforcement. No added model call or authority.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates operator-facing reply composition and durable closing-notice replay.
Side effects: Activation-record due data stays visible on status but no longer generates escalating reply lines. Legacy notice wording and recorded notice keys prevent upgrade duplicates. Compact self-state stays within the unchanged context floor. Generated register metadata is replayed.
Undo and recovery: Revert behavior with a reviewed repair that retains validation of the newly recorded closing text; a blind validator revert would reject journals already carrying it. Preserve journal history and regenerate the register.
Multi-machine posture: Existing journal-local activation and reply owner retain dispatch, restart and compaction custody; no new store or cross-journal deduplication claim. Source and generated metadata travel in Git.
Team posture: Existing verified operator conversation and authenticated status audience only; no member or guest access is widened and no sharing or approval is introduced.
Layer below: Unit diff, durable closing intent and legacy answerNotices, credential expirySource projection and genuine expiry schedule, journal-agent composition, reply-check, self-state and status/dashboard consumers, unchanged context guards and native certificate checks.
Bug class: integration
Bug evidence: reproducer=tests/preview/activation-reminder-once.test.ts
Hook bypass: none
Convergence: none
Prompt review: No additional model-facing changes beyond the reviewed member. Replay its real recorded answer, summary uncertainty, Jev uncertainty/undecided, reply-review and empty candidate shapes; the report names update IDs. Member prompt dispositions are preserved.
Decision: train-245-M1 | Ordinary fast-forward merge of exact reviewed f98b62cf0bd0a3ab9e515006592963311540b906; evidence /Users/dabombstudio/.instar/agents/echo/.instar/lanes/activation-reminder-once-1112-PROGRESS.md, copied to its cited build-report destination on Studio. No unreviewed branch tip. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-245-PROGRESS.md
Decision: train-245-A | Preserve all member behavior and accepted live behavior; no conflicts or changelog edits. Regenerate generated outputs mechanically. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-245-PROGRESS.md
Decision: train-245-B | Use the provisioned isolated train-245 checkout whose branch starts at exact live e3cb0f08d3a74d70c9e059edbd64fc457492bfff. No branch move or main merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-245-PROGRESS.md
Decision: train-245-desk | Existing repin/build/rehash/replay chain; zero source or owner pins needed. Keep context guards and test timeouts unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-245-PROGRESS.md

1.x comparison: Actual JKHeadley/instar origin/main db3ed6d3052cfcc24888b6c8bc86086abcfc2987 searched in src/, docs/specs/ and history before merging. Read src/core/SubscriptionReloginApprovalReminder.ts, src/commands/server.ts:18025–18065 and docs/specs/notification-selectivity.md; history 7f50d366a and 982978c44. Reuse once-per-episode identity and quiet status. Approval ageing is not activation expiry: 2.0's existing durable closingNotices already handles restart and unknown sends, so no timer/attention subsystem transplant fits. ONEX-LESSONS.md lines 72–73 and 103 support preserving unknown-send custody, deduplicating re-emission and retaining real credential repair.

simplestRobustRoute: One exact-head ordinary merge and the existing desk tools; this is the simplest robust route and adds no machinery. Start guards: exact live base and reviewed member. End guards: targeted boundary/lifecycle and recorded-shape tests, generated consistency, final-head checks and clean pushed custody. Runtime safety limits remain unchanged; no new unattended capability is claimed.
80/20: Product changes are the member's 23 changed lines across four files; integration adds only review and generated metadata. Run changed tests, direct affected consumers, mandatory register/subscription/context checks and pinned READY files in foreground chunks; the desk owns full-suite and independent live acceptance.
VERDICT: author submission; independent desk owns landing approval
