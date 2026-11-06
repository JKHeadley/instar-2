# Change review — train-176 test gate repair

Subject base: e635ded7e705ba7aef2029db981b702be18d4a24
Review state: open
Reviewed content: none
Outcome: Preserve exact canary answers alongside the shipped activation reminder; make dependency cleanup and the committed bridge fixture yield to Vitest while retaining every acceptance and refusal assertion.
Affected rules: 26, 34, 37, 70, 74, 100, 101, 102, 111, 112, 116
Affected floors: secrets — unchanged production checks; spend cap — unchanged admission; stop — unchanged; no duplicate sends — existing launcher assertions retained; durable intake — unchanged journal and recovery.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Four test files and their derived publication binding; no production behavior, prompt, model parser, authority, or governed text changes.
Side effects: The install cleanup and multi-build bridge fixture have finite 120-second budgets. Asynchronous child execution and bulk filesystem work let worker reporting progress during those operations. Unexpected cleanup errors still fail.
Undo and recovery: Revert the test repair if rejected; no installed or live state changes. Fixture cleanup remains scoped to its own temporary roots.
Multi-machine posture: Machine-local targeted tests use one worker. No ownership or replication changes; the desk retains full-suite qualification.
Layer below: Actual JKHeadley/instar main 22463d0b6a372aedb33f5f1b756e13bae89ab807 was searched in src/ and docs/specs/ for expiry, cleanup, test timeouts and exact failure strings. Inspected src/core/hostTestRunnerSemaphore.ts, docs/specs/test-runner-concurrency-bound.md and history 1f90fa1a9/618560b3e/c91b8780e/681f86543; src/monitoring/MissingLoginSessionDetector.ts and history ff8344b4b/ab26b7ca3. Bounded test execution and separately tracked diagnostic notices fit; the exact activation wording and committed-register bridge/RPC fixtures are specific to 2.0 (exact-string search found no match). Read ONEX-LESSONS.md section 6. Reuse 2.0 tests/e2e/async-child.ts, whose existing purpose is preventing synchronous child RPC starvation, and current credentialNotices/displayLabel output. No new semaphore or production feature is needed.
Bug class: integration
Bug evidence: reproducer=Supplied train-176 gate excerpts show eight exact notice mismatches, one dependency cleanup hook exceeding 10 seconds, and one four-build bridge fixture exceeding 60 seconds with worker onTaskUpdate starvation; the changed files retain those real launcher/install/CLI reproductions and their negative controls.
Hook bypass: none
Convergence: none
Prompt review: No prompt or model-facing path changes. Added fixed notice text is assertion evidence from the supplied gate, never a model trigger or dispatch rule.

Subject (12 paths): tests/e2e/register.test.ts, tests/preview/journal-agent.test.ts, tests/preview/mcp-setup.test.ts, tests/preview/review-layers-canary.test.ts, register-source/owner-references/preview.json, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

Decision: T176-R1 | Match only the current activation reminder and its exact renewal action, retaining exact answers and rejecting unrelated appended text. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-repair-PROGRESS.md
Decision: T176-R2 | Await large cleanup and reuse the asynchronous child helper for the bridge fixture; use the adjacent multi-build fixture's finite budget without weakening its assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-repair-PROGRESS.md

Publication: The delegated desk rehash tool refreshed exactly the journal-agent test artifact hash in register-source/owner-references/preview.json; the inventory repin tool changed no paths. Generated publication was replayed from d465cc295a952094de66f5b4110dab5de7c73c46: generation sha256:93be6c6bbea654e0842383d4c3172c98544ec5d917a50886e2d6eb5326787af7, 298 entries, 121 rules, 34 terms; authority remains shape-only with 48 warnings and 113 prerequisites. No hand-edited pins.

The existing source behavior is preserved: reminders remain visible, an ambient bridge still cannot satisfy the committed graph, a committed bridge still resolves identically in a fresh clone, and an extra untracked source still refuses wiring. The MCP test still exercises production npm installation and migration. This record does not supersede the independent integration review, its live acceptance obligations, or CB6-MF-A / CB7-R90 / CB1-MF5.

## Closing block

simplestRobustRoute: Correct stale assertion text and use existing asynchronous execution at the test boundary. No runtime machinery, capability restriction, quarantine, or new authority. Each resource operation remains sequential and fixture-scoped, and each test has a finite execution budget.
80/20: TypeScript and the four changed test files are the local evidence; lint, register replay and change-review checks qualify the final commit. The Studio pipeline owns the full-suite rerun and installed/live acceptance remains open.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
