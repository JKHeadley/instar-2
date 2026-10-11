# Change review — train-6 ordered integration

Subject base: f34d2b940c1da2678bfe7b32ce70ca5f58fd0784
Review state: open
Reviewed content: none
Outcome: Integrate the requested train heads in order from f34d2b94, retaining landed main and excluding heads that require a behavioral choice. Dispatch-now, honest-limit, act-first and trust-default are included; holding and harness-logins were aborted for runtime conflicts.
Affected rules: 1, 4, 18, 26, 34, 36, 37, 44, 49, 63, 74, 84, 90, 91, 101, 102, 104, 105, 111, 112, 113, 116
Affected floors: secrets — existing custody and outbound gates retained; spend cap — reservations and bounded trust grants retained; stop — existing stop and stale-group guards retained; no duplicate sends — durable send intent retained; durable intake — original journal and accepted input retained
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration touches provider guidance, trust admission, held replies and durable dispatch.
Side effects: Combined prompt wording increases context bytes; existing hard budget assertions remain. Provider composition changes invalidate the prior Darwin conformance claim until the desk runs its contract.
Undo and recovery: Ordinary corrective commits or reviewed merge reverts; retain all history and journals. Do not retry uncertain effects. After capacity rows exist retain a compatible reader.
Multi-machine posture: Git-shared integration; runtime keeps exclusive ownership, replication and the single-machine closed set. Trust policy and vault bindings remain installation-local by explicit operator setup.
Layer below: Both parent diffs, constitution on main, existing admitted effect doorway, journal content authentication, source-pin and composition-digest checks, real recorded replay fixtures and hard context limits.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: train6-heads | Use exactly the six named tips; all matched fetch, main was already an ancestor; exclude holding and harness-logins because their runtime conflicts require a behavior choice. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-6-PROGRESS.md
Decision: train6-derived | Retain current generated files during merges, then regenerate once; retain landed conversion and owner pins until exact-byte rehash. Preserve main documentation at the conflict. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-6-PROGRESS.md
Decision: train6-additive | Combine the dispatch stale-group guard with honest capacity reply selection; union act-first imports; compose independent historical prompt translations and add measured context deltas without weakening fit guards. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-6-PROGRESS.md
Decision: train6-conformance | Retain the last declared Darwin conformance rather than assert a new certificate from WSL; record the R105 finding and require the Studio contract before ready. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-6-PROGRESS.md
Prompt review: No invented prompt wording. Carry act-first and trust guidance; combine exact historical prompt translations in the K11a test. Recorded act-first web calls, uncertain/undecided summary and review shapes, delivered and empty replies are replayed by the carried fixtures. No live deployment or independent convergence is claimed.
Prompt finding: 034c5250da92 | quoted-evidence | Existing protocol or shipped guidance is quoted by the regression test; no semantic trigger or expected answer is injected into a prompt.
Prompt finding: 450c79237a95 | quoted-evidence | Existing protocol or shipped guidance is quoted by the regression test; no semantic trigger or expected answer is injected into a prompt.
Prompt finding: 45e37ea2e9e9 | quoted-evidence | Existing protocol or shipped guidance is quoted by the regression test; no semantic trigger or expected answer is injected into a prompt.
Prompt finding: 6af48f94b789 | quoted-evidence | Existing protocol or shipped guidance is quoted by the regression test; no semantic trigger or expected answer is injected into a prompt.
Prompt finding: 849db3a6296a | quoted-evidence | Existing protocol or shipped guidance is quoted by the regression test; no semantic trigger or expected answer is injected into a prompt.
Prompt finding: b00ed403060a | quoted-evidence | Existing protocol or shipped guidance is quoted by the regression test; no semantic trigger or expected answer is injected into a prompt.
Prompt finding: bd01de21286a | quoted-evidence | Existing protocol or shipped guidance is quoted by the regression test; no semantic trigger or expected answer is injected into a prompt.
Prompt finding: fb5fa7e706c8 | quoted-evidence | Existing protocol or shipped guidance is quoted by the regression test; no semantic trigger or expected answer is injected into a prompt.
Deferral: tests/preview/dispatch-now.test.ts:12 | not-a-deferral=Captured model output or test scenario describing scheduled work; no implementation is postponed.
Deferral: tests/preview/dispatch-now.test.ts:18 | not-a-deferral=Captured model output or test scenario describing scheduled work; no implementation is postponed.
Deferral: tests/preview/dispatch-now.test.ts:65 | not-a-deferral=Captured model output or test scenario describing scheduled work; no implementation is postponed.
Deferral: tests/preview/dispatch-now.test.ts:78 | not-a-deferral=Captured model output or test scenario describing scheduled work; no implementation is postponed.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:73 | not-a-deferral=Captured model output or test scenario describing scheduled work; no implementation is postponed.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:112 | not-a-deferral=Captured model output or test scenario describing scheduled work; no implementation is postponed.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:138 | not-a-deferral=Captured model output or test scenario describing scheduled work; no implementation is postponed.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:139 | not-a-deferral=Captured model output or test scenario describing scheduled work; no implementation is postponed.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:151 | not-a-deferral=Captured model output or test scenario describing scheduled work; no implementation is postponed.

Subject (48 paths): docs/defects/stale-main-baseline-additivity.md, docs/standing-trust-setup.md, register-source/owner-references/preview.json, scripts/check-p15-additivity.mjs, scripts/first-landing.mjs, scripts/setup-standing-trust.mjs, src/assembly/README.md, src/assembly/harness.declarations.json, src/assembly/production-codex-provider.ts, src/assembly/production-provider.ts, src/assembly/tool-answer-guidance.ts, tests/assembly/production-provider-subscription.test.ts, tests/assembly/production-provider-tools.test.ts, tests/first-landing.test.ts, tests/integration/act-first-live.test.ts, tests/preview/act-first.test.ts, tests/preview/briefing.ts, tests/preview/default-context-floor.test.ts, tests/preview/dispatch-now.test.ts, tests/preview/effect-doorway.mjs, tests/preview/effect-doorway.test.ts, tests/preview/egress-proxy.test.ts, tests/preview/fixtures/act-first-2026-10-10.json, tests/preview/group-carry-requests.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-capacity.test.ts, tests/preview/journal-commitments.test.ts, tests/preview/journal-envelope.ts, tests/preview/journal-longchat.test.ts, tests/preview/journal-memory-inventory.test.ts, tests/preview/journal-prelaunch-evidence.md, tests/preview/journal-prelaunch.test.ts, tests/preview/journal-provider.test.ts, tests/preview/journal-recall-lookup.test.ts, tests/preview/journal.ts, tests/preview/live-sentinels.ts, tests/preview/reply-check.test.ts, tests/preview/reply-check.ts, tests/preview/selfdesc-abilities.test.ts, tests/preview/tool-admission.mjs, tests/preview/tool-admission.test.ts, tests/preview/tool-persist.test.ts, tests/preview/tool-turn.mjs, tests/preview/tool-turn.test.ts, tests/preview/trust-setup.mjs, tests/preview/trust-setup.test.ts, tests/preview/trust-signoff.test.ts, tests/scheduled/review-round17.test.ts

Publication: generated/ replayed from 743ac7a86a44fcbfef9b8efc8df9d8d39b3a2265 using the existing builder; no generated bytes hand-edited.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merges and existing tests/checkers. No new machinery. Start guard is exact fetched ancestry; end guard is pushed content and honest check results; limit guards are existing secrets, spend, stop, ownership and intake. Runtime-conflicting heads are excluded rather than redesigned.
80/20: Typecheck and build pass. Changed-file tests expose a 33-byte review-reserve overflow and four stale act-first real-capture assertions after prompt composition, plus WSL provider-launch failures. Retain those failing guards: the prompt combination needs a fresh Studio real capture and a reviewed budget repair. R105 Darwin conformance also requires the Studio. Submission is BLOCKED, not ready; no test bar or captured evidence is weakened.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
