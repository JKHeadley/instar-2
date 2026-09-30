# Change review — cint-L8 pipeline repair: the topic-answer launcher test long-polls like Telegram

Subject base: ab8d69232269a4398b27fe4c9962336d7603da40
Review state: open
Reviewed content: none
Outcome: The Mama PC full run failed one test: tests/preview/journal-agent.test.ts "the real launcher answers a topic from the main chat … (endpoint drop-thread)" saw one send where two were expected, after 1364 ms. The fake Telegram endpoint answered every empty getUpdates instantly, so the launcher's three bounded cycles could end within a single ordinary drain pass or within its 1 s retry backoff after a transient failed pass; the loop then awaited only the job already running and exited with the second topic reply never attempted. Real Telegram holds an empty getUpdates for its timeout. The endpoint gains an opt-in long-poll mode (argv[5] 'long-poll': an empty getUpdates waits min(timeout, 5) s before answering); this test uses it with four cycles, so its bounded cycles span real time. Every other endpoint user is unchanged (no fifth argument). Proven both ways with a temporary injected one-time failure of the second turn's drain: the old instant endpoint reproduced the gate's exact assertion ("expected length 2 but got 1") in both echo and drop-thread modes; the long-poll endpoint passed both. The whole file (15 tests) passes; tsc is clean. Launcher and worker source are unchanged. The register was regenerated with the desk scripts (owner-manifest rehash: 1 preview pin; repin chain: 0 inventory pins; build-register --replay).
Affected rules: 37 (the red test is fixed at its source, nothing quarantined), 74 (this record), 116 (simplest route: a test-fixture change, no launcher machinery)
Affected floors: secrets — unchanged (test fixture only); spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (the UNKNOWN drop-thread send is still asserted unknownSends 1); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: only a test fixture and one test's arguments change; no source under src/ or the preview launcher/worker changes
Side effects: this one test runs about 2 s longer (empty polls now wait their 1 s timeout)
Undo and recovery: revert the three repair commits and this record
Multi-machine posture: machine-local test fixture
Layer below: tests/preview/journal-agent.mjs poll loop (background drain skipped while a drain job or its retry backoff is pending; unchanged)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: cint-L8-longpoll-fixture | the failure was the fake endpoint's instant empty polls, not launcher behaviour; making the fixture long-poll as Telegram does (opt-in, one test) is simpler than changing the launcher's shutdown | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L8-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-agent.test.ts, tests/preview/journal-poll-endpoint.mjs

## Closing block

simplestRobustRoute: an opt-in Telegram-faithful long-poll in the fake endpoint for the one test that needs its cycles to span real time; no launcher change
80/20: 0 must-fix, 0 notes — one fixture mode, one test's arguments, generated output
VERDICT: author submission; the independent verdict is recorded as a pass
