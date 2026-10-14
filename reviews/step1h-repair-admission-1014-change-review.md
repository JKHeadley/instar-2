# Change review — reserved format-repair topic admission

Subject base: 763634f7810272ded82ecec22ff9eab979f531c3
Review state: open
Reviewed content: none
Outcome: An exactly reserved format-repair child inherits its admitted parent's topic while retaining a distinct operation and request digest. Unreserved suffixes refuse before worker dispatch.
Affected rules: Rules 1, 4, 26, 29, 34, 36, 42, 46, 49, 55, 57, 68, 70, 74, 75, 77, 88, 95, 101, 102, 111, 113, 116.
Affected floors: Existing secrets, spend cap, stop, durable intake and no duplicate sends remain enforced. No digest exception, new reservation, retry loop, store or scheduler.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Repairs the shipped conversation coordinator boundary using exact recorded packets and the real coordinator, session adapter, journal and send recovery paths.
Side effects: Topic lookup recognizes only the canonical Telegram parent plus one format-retry suffix, with an accepted parent, reserved answer and durable format-retry marker. Original operation lookup is unchanged. Execution keeps the child's identity; delivery keeps the parent's send intent. The existing one-repair cap, authority, resource and request-digest checks are unchanged.
Undo and recovery: Revert the topic lookup change to restore the earlier refusal. Preserve all journals and host inputs; never erase or repeat unknown work. Completed child inputs replay from custody; parent send receipts prevent duplicate delivery after journal reopening.
Multi-machine posture: No new state or ownership path. Existing host-owned journal and conversation custody remain the only admission and outcome authorities. No second machine receives dispatch authority.
Layer below: Checked journal.ts format-retry projection and one-repair cap; conversation-topics.ts routing, recovery and shared allowance; production-conversation-session.ts same-operation digest conflict and persisted outcomes. The old single-topic bridge fixture omitted the failing production closure; it now exercises that closure through the real coordinator.
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-conversation-session.test.ts; live=tests/preview/fixtures/repair-admission-rewalk-2026-10-14.json
Hook bypass: none; core.hooksPath unset and common hooks directory checked before commit.
Convergence: none
Prompt review: No prompt or parser wording changes. Exact A04/B04/B24 reserve and repair packets from recorded updates 840342746, 840342756 and 840342762 replay through the shipped bridge and coordinator. Recorded repair execution never occurred, so successful repair output is explicitly simulated, not presented as a live result. No Telegram sends or live-root access.
Decision: step1h-topic | Resolve only the canonical, durably reserved repair child to its admitted parent's topic; preserve execution and send identities. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1h-repair-admission-1014-PROGRESS.md
Decision: step1h-proof | Replace the bridge fixture's single-topic shortcut with the real topic coordinator and replay the three recorded repair packets through it. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1h-repair-admission-1014-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: extend the existing topic lookup to the journal's already-reserved child. The named failure is that a reserved repair cannot find its topic and returns an honest failure instead of executing. Reusing the durable reservation prevents unreserved suffixes from widening admission; no new state, scheduling or retry machinery is needed. Start guards are accepted intake and reserved repair, existing authority, cap and stop checks; end guards are durable outcomes and the parent's send receipt. Recorded-packet offline tests prove admission, digest refusal and duplicate-free recovery; no unattended live-send acceptance of this changed build is claimed.
80/20: Targeted bridge/topic and recorded-shape tests, typecheck, architecture, lint, register, change-review and pinned READY checks; no full suite, walk or load test.
VERDICT: author submission for desk review; no independent convergence claimed
