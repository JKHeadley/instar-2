# Covered memory request recovery

Subject base: 90c18fac91e500a31aa1a90bab8313c8930c8f8a
Review state: open
Reviewed content: none
Outcome: Release a pending memory request that its eligible summary frontier already covers, with durable undecided provenance, so ordinary answers queued behind it can proceed.
Affected rules: Purpose constraints 2 and 3; Rules 4, 7, 10, 14, 15, 26, 34, 35, 36, 41, 46, 49, 57, 58, 60, 70, 74, 77, 85, 95, 96, 100, 101, 111, 113, 116.
Affected floors: Existing secrets, spend caps, stop, durable intake and no duplicate sends (durable send-intent uniqueness) remain on the ordinary path. Recovery neither makes a memory change nor authorizes an effect.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: This changes admission to ordinary answers after an unresolved memory request.
Side effects: A covered pending request now records memory-undecided with reason summary-covered. Later answers carry the existing unresolved-correction warning. Summary coverage is not a decided correction. Explicitly settled requests remain settled, and eligible uncovered requests still receive normal summary judgment. Future and retired summaries do not count as the eligible frontier. blockedEarlier is unchanged.
Undo and recovery: Revert the new settleBehind branch to restore prior scheduling. Existing memory-undecided projection reads the new reason without a schema migration. Already recorded undecided requests remain undecided; rollback must not erase their uncertainty or resend their replies.
Multi-machine posture: Uses the existing journal and conversation ownership boundaries on every host. No new store, transport, cross-machine authority or machine-local exception. Replay tests use disposable local stores; source snapshots stay unchanged.
Layer below: Checked pendingMemory's explicit settlement predicate, liveSummaries/summaryFor eligibility, runSummary's previous >= target early return, memory-undecided projection, unresolved packet warnings, ordinary reply reservations, durable intents and restart skip logic. The new predicate matches the summarizer's exact no-progress condition, not a semantic judgment.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/memory-strand.test.ts; live=tests/preview/fixtures/memory-strand-2026-10-15.json
Hook bypass: none; core.hooksPath unset and the shared hooks directory contains sample hooks only.
Convergence: none
Decision: covered-memory-undecided | Extend the existing recovery with the exact eligible-frontier condition and a distinct reason; retain memory judgment and all ordinary answer gates. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/memory-strand-1015-PROGRESS.md


Evidence: The committed fixture preserves exact room inputs and summary excerpts with provenance; its tests replay the reduced projection and both decision neighbors. Separate desk evidence replays the complete encrypted room-4 snapshot, including restart immediately after durable undecided, UNKNOWN send and stop, and the copied Justin journal's explicit settlement 969390512. Source hashes are checked unchanged. Recorded summary-writer, uncertain, Jev unsure/undecided, reply-review, delivered-reply and empty-bubble shapes come from the existing proof-room fixture; the same-request answer is recorded update 46039931 frame 118. Replaying shapes in another context tests handling, not semantic suitability of those old replies to new questions.
Prompt review: No prompt or parser text changes. The existing unresolved warning remains model-visible; recorded shapes exercise the released path and its failure neighbors.

Publication: Regenerated seven existing shape-only register publications from source commit e08c4b2efef19d3a6c032207714b850daa7bbae4; generation sha256:5aced2c2c9883ca7b1d472b41415b7bc2f1979055507536d465d38d57bc34a7e. No policy, declaration or runtime authority change. Tools policy sha256:5fed4bcfd823d950c1444a008a9c11d40824671dd8e68aa2f5908ed8534a2926 and conversation policy sha256:3598cc7514f4be6ffec52f1d321e1596cd2db420a67fd7958281f3862dd9ce8c are unchanged.

Prompt finding: e8708c7fea24 | protocol-literal | Existing source-provenance instruction tested at its consumer; this change leaves that text intact.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory status wording tested at its consumer; this change leaves that text intact.

simplestRobustRoute: This is the simplest robust route: append the existing memory-undecided record when a pending request is already covered by its eligible summary frontier. The named failure is room-4 update 46040116 being unselectable forever while holding 46040117/118. Start guard: pendingMemory still identifies an unsettled request and summaryFor reaches its update. End guard: the durable undecided projection releases the hold and preserves uncertainty. Existing resource, stop, ownership, outbound and deduplication guards remain. No new queue, retry service, prompt, parser or policy. Exact snapshot replay completes unattended with recorded outputs through isolated model/send ports; no fresh live-provider or deployment completion claim.
80/20: Targeted regression and direct journal consumer tests, architecture, typecheck and required pinned publication checks. Independent desk review owns convergence and live acceptance.
VERDICT: author submission; independent convergence is not claimed
