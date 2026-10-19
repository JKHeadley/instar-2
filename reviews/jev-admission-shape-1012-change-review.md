# Change review — Separate Jev admission and provider budgets

Subject base: 5e41cdec0a0b2d1b50f5148784e6370f3da376cc
Review state: open
Reviewed content: none
Outcome: Cold audience admission no longer consumes the Jev provider allowance; both phases remain bounded and visible per turn, with one reserved retry and subscription fallback.
Affected rules: Purpose least revelation; Rules 1, 13, 28, 32, 35, 36, 39, 41, 42, 49, 55, 58, 60, 63, 67, 70, 74, 75, 77, 95, 100, 101, 102, 111, 113, 116.
Affected floors: Secrets — unchanged audience permission and exact outbound secret checks; no diagnostic content. Spend — unchanged durable reservation for each of two calls. Stop — unchanged worker and retry stop gates. No duplicate sends — unchanged journal send intents and no provider continuation after timed-out admission. Durable intake — unchanged accepted records and recovery.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Reply-check timing and diagnostics at the existing disclosure and provider boundaries; no prompt or verdict semantics changed.
Side effects: A pair of slow admissions can take up to 6000 ms in addition to 3350 ms of provider allowances. The existing turn deadline clips both. Unavailable checks continue into the subscription review; never accepted by default. Existing summary and step-check timeouts are unchanged. Three additive phase names enter the existing bounded numeric diagnostic stream.
Undo and recovery: Revert this change together; original retained diagnostic frames remain evidence. Readers predating the new phase names reject them, so rollback requires a reader that accepts the additive names. Durable call reservations and UNKNOWN send/call recovery are unchanged.
Multi-machine posture: Admission timing and audience cache are deliberately process-local observations; no grant or peer evidence is cached. Ownership and peer replication remain host admission requirements. Durable phase records use the existing journal replication path.
Layer below: Read worker disclosure, host requireGroupDisclosure, peerHolds, createGroupAudienceCache and verifyGroupAudience. Both checkpoints used to consume the provider timeout. Cache lifetime is already per runner, not per turn, with stable lineage keys and no ordinary text invalidation. Its ten-second non-sliding lifetime expires during long turns; extending it would weaken the current audience evidence floor.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/jev-retry.test.ts; live=tests/preview/fixtures/jev-admission-2026-10-12.json
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains sample hooks only.
Convergence: none
Decision: jev-shape-phase-budgets | Share a separate 3000 ms admission allowance across worker and host per attempt, then start the existing 850/2500 ms provider allowances; preserve turn deadline, reservation and fallback. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/jev-admission-shape-1012-PROGRESS.md
Decision: jev-shape-audience-bound | Retain the existing ten-second start-based cache bound and membership invalidation; no widening of private disclosure standing to keep long turns warm. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/jev-admission-shape-1012-PROGRESS.md
Decision: jev-shape-trace | Reuse phase-timing with turn-bound worker admission, host admission and provider durations, no text or new store. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/jev-admission-shape-1012-PROGRESS.md
Decision: jev-shape-replay | Replay recorded 969390426/427 admission timings with the separately recorded 969390424 response control; do not claim these failed turns originally dispatched Jev. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/jev-admission-shape-1012-PROGRESS.md
Prompt review: No prompts, scores or parser acceptance changed. Replay recorded admission failures and continuation control, with refused/hanging admission, deadline, cap, stop, crash and summary neighbors. Additional existing recorded-shape suites are listed with their actual results in the report.
Prompt finding: 5b486d8bd247 | protocol-literal | Existing reviewer output protocol or secret-standing instruction; unchanged by this timeout-only repair — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "prioritize verdicts; do not repeat rules or context."
Prompt finding: 5fa1a20c4031 | protocol-literal | Existing reviewer output protocol or secret-standing instruction; unchanged by this timeout-only repair — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "an illustrative or quoted literal the verified operator explicitly requested or "
Prompt finding: aef7d91bef51 | protocol-literal | Existing reviewer output protocol or secret-standing instruction; unchanged by this timeout-only repair — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "give each listed rule, and no others, one verdict"
Prompt finding: b288d6ef1604 | protocol-literal | Existing reviewer output protocol or secret-standing instruction; unchanged by this timeout-only repair — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "keep reasoning under 400 characters and all json under 4000 so every verdict fit"
Prompt finding: e769ca9dd959 | protocol-literal | Existing reviewer output protocol or secret-standing instruction; unchanged by this timeout-only repair — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "pass means no breach; violation means a breach, named in its reason."
Prompt finding: feadb66b8ad1 | protocol-literal | Existing reviewer output protocol or secret-standing instruction; unchanged by this timeout-only repair — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "any live authentication secret reaching anyone but the verified operator who sup"

Prompt finding: e8708c7fea24 | protocol-literal | Existing recall source-label/unknown-source instruction, unchanged here. The fixture checks delivery of that general provenance instruction, not an answer-trigger phrase; the admission split changes no prompt bytes.
Prompt finding: 849db3a6296a | protocol-literal | Existing deterministic empty-memory status text and its consumer expectation, unchanged here; not a model instruction to match an operator phrase or an asserted reviewer answer.

Publication: Regenerated the existing shape-only register from source commit 5093e14d3fde6facb49c63b64c0e1594836e5955; generation sha256:ec5b20d34b364deff7b50244d0e0adb9f2bb1cb3e403ce6e9d74346836295031. No declaration, authority or capability changed. Focused 54 tests and the pinned six-file/89-test gate pass; typecheck, build and architecture pass. Final publication checks and direct-consumer results are reported separately.

simplestRobustRoute: This is the simplest robust route: split the existing timer at admission, sharing one finite admission allowance across its two existing checkpoints. The small shared timer helper prevents duplicate implementations and late provider dispatch. No new retry, cache, scheduler, grant or store. Start guards remain admission, stop, spend and peer; end guards remain interpreted checks and contextual fallback; limits remain two attempts and the turn deadline. Tests replay shipped client and durable worker; no unattended live deployment or independent convergence is claimed.
80/20: Targeted real-shape replay and decision-boundary tests, architecture/type checks and the existing publication gates; independent landing review belongs to the desk.
VERDICT: author submission; independent convergence is not claimed
