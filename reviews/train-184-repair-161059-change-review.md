# Change review — train-184 activation notice consumers

Subject base: 6ba08adb6daaa2560c5151800bcf14da66e1866e
Review state: open
Reviewed content: none
Outcome: The real-launcher answer assertions accept the existing activation-expiry reminder while still checking the exact answer and rejecting unrelated appended prose.
Affected rules: Rules 34, 37, 42, 70, 74, 95, 101, 102, 113, 116.
Affected floors: secrets — no custody or outbound change; spend cap — no new calls; stop — existing signal assertions retained; no duplicate sends — existing exact send assertions retained; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Two test-consumer expressions, explanatory comments and captured-notice positive/negative regression cases; no product change.
Side effects: The delegated desk scripts refresh the test-source owner pin and regenerate the register from the committed source. A due activation reminder no longer masks the answer/review assertions. The new alternative fixes the activation label and renewal action exactly; it does not accept arbitrary appended prose or change runtime generation.
Undo and recovery: Revert this repair commit; the previous exact expectations return. No migration or persistent data change.
Multi-machine posture: Deliberately host-local test expectations; no ownership, replication, transport or authority changes. The Studio reruns its full gate; this WSL builder runs only targeted checks.
Layer below: tests/preview/credential-reminders.ts credentialNotices; tests/preview/credential-reminders.test.ts activation reminder cases; supplied fast-train-184-6ba08adb failure bytes; the existing answerOf exact-answer checks in both test consumers; 1.x comparison below.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-agent.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompt, model parser or runtime accept/escalate/refuse logic changed. The captured gate notice is replayed against both test matchers, with unrelated-prose negative neighbors.
Decision: train184-repair-notice | Accept the existing activation reminder as its own precise alternative in both answerOf consumers; preserve exact answers and all review assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-161059-PROGRESS.md

Decision: train184-repair-host | Retain the existing process safeguards; WSL sh rejects ulimit -u before the launcher reaches replies. The brief assigns ulimit-shim/launcher, native audio and e2e host checks to Studio. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-161059-PROGRESS.md

Decision: train184-repair-pins | Recompute the stale owner pin using the supplied desk scripts and regenerate generated/ with build-register --replay; no hand-edited hash. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-161059-PROGRESS.md

1.x FIRST: Actual JKHeadley/instar origin/main b227aed934ce3c61cda09142f46de06834aacc9c. Searched src/ and docs/specs/ for credential expiry/reminder behavior; inspected src/monitoring/SessionCredentialManager.ts and docs/specs/unified-session-lifecycle-robustness.md, with history df4446717, f26468ed2 and 16f6f26ef. Those references provide session credential isolation and truthful timeout handling, not this 2.0 activation notice grammar. Reuse 2.0 credentialNotices unchanged, fixing its stale consumers. ONEX-LESSONS.md sections 2 and 6 cover indeterminate timeouts, bounded concurrency and production-consumer tests. No feature code copied or rebuilt.

## Closing block

simplestRobustRoute: This is the simplest robust route: extend the two stale test expectations to the already shipped activation notice. No new helper, runtime mechanism, state, gate or authority. Start with the recorded failing notice; finish with targeted checks and the ordinary desk gate; retain all production floors.
80/20: Repair the exact mismatch, keep unrelated prose rejected, run the changed test files and cheap checks, and report host-dependent evidence at its actual tier.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
