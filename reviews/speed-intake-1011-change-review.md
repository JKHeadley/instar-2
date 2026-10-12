# Change review — bounded group membership observations

Subject base: 208a222111a384b04db9bff4ab7f02ba7d452703
Review state: open
Reviewed content: none
Outcome: Reuse one verified membership observation across the runner's repeated audience checkpoints, bounded to ten seconds from probe start and invalidated by membership/service updates before batch intake.
Affected rules: Purpose least revelation; Rules 1, 4, 13, 28, 32, 34, 35, 36, 49, 60, 63, 70, 74, 77, 95, 101, 102, 111, 113, 116.
Affected floors: secrets — same outbound redaction and exact audience predicates; spend cap — unchanged reservations; stop — unchanged independent stop and intake; no duplicate sends — unchanged durable send intents and receipts; durable intake — unchanged journal intake, invalidation preceding worker wakeup.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Observation freshness at the private-memory disclosure boundary changes, as expressly requested by the builder brief; every predicate and current grant check remains.
Side effects: A verified audience observation may be reused for less than ten seconds from the first read. An unseen membership or exposure change may remain unseen until expiry; delivered membership updates invalidate immediately. Telegram has no atomic membership/send operation. Probes exceeding the age bound refuse, failures are never cached, and invalidation during a pending probe refuses its waiters. A service/non-text update conservatively invalidates even when unrelated. Cold intake still pays one complete probe. Measurements establish warm-cache improvement only, with live latency unmeasured.
Undo and recovery: Revert the source/test commit and regenerate publications against that committed source. No durable schema or state migration; restarting loses the observation and reads again.
Multi-machine posture: Deliberately process-local, one entry keyed by full source/destination/chat/operator/bot scope. Each runner retains its ownership gate and grant checks; a new runner starts cold.
Layer below: Read the verifier, grant resolver, six-read transport, worker audience checkpoints, durable intake/reserve/send paths, and authority-cache hotfix record. All original forum/private-exposure, bot identity, member identity/status and both count predicates remain. The host uses its existing monotonic clock, observes the full polled batch before duplicate filtering, and subscribes to both membership update types. One-time carry still probes fresh.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset; common hooks directory contains sample hooks only.
Convergence: none
Decision: bounded-audience-observation | Reuse one scope-bound success for ten seconds from probe start, without sliding expiry or caching failures, and coalesce pending reads. The explicit cache direction permits this engineering default; least revelation and Rules 4/28/95 retain every predicate and current grant check. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speed-intake-1011-PROGRESS.md
Decision: invalidate-before-intake | Observe the full Telegram batch including duplicates before intake; membership/service updates invalidate cached and pending evidence. Subscribe to chat_member and my_chat_member. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speed-intake-1011-PROGRESS.md
Decision: fixture-latency-scope | Measure the recorded group question through the real worker with injected read latency; distinguish cold and warm. Studio performs live-root replay as instructed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speed-intake-1011-PROGRESS.md
Prompt review: Prompt text, model parsers, review selection and verdict semantics are unchanged. Recorded group update 969390330 and seven recorded memory/review/reply shapes exercise the new cache, including wider-audience refusal and recovery.
Verification: The 1000ms/read replay measures intake-to-reserve 12000ms before, 6000ms cold, 0ms warm, with six checkpoints, two reviews and one reply each. Reopening does not repeat the send. Six targeted files pass 73 tests. Three copied-runner launch cases refuse under WSL and are reported for the Studio gate. Typecheck and architecture pass. Final evidence is in the remote unit report.

Subject (5 paths): tests/preview/group-disclosure.ts, tests/preview/journal-agent.mjs, tests/preview/group-audience-cache.test.ts, tests/preview/group-carry.test.ts, tests/preview/group-membership-io.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: retain the verifier and grant checks, add one observation entry at their shared host boundary, and invalidate in the existing poll loop. Coalescing prevents duplicate concurrent reads; scope, expiry and invalidation prevent reuse across identity or known audience changes. Start guard: existing exact verifier. End guard: current observation and grant at each checkpoint. Limit guards: one entry, ten seconds, existing bounded transport. Unattended evidence is the fixture worker; live acceptance belongs to the desk replay.
80/20: Warm repeated-read cost is removed and cold intake cost halved. Both sides, recorded-shape recovery and no-duplicate replay are tested; independent review and live latency remain desk gates.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
