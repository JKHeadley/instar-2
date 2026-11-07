# Change review — train-169 deterministic status work regression

Subject base: dd78bb652abb24b19d1b47a03b0ae2b9e6a20fa0
Review state: open
Reviewed content: none
Outcome: Make P2-OCC-07 decide incremental status work independently of host scheduling, while detecting full-history re-derivation deterministically.
Affected rules: 13, 26, 34, 37, 49, 70, 74, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — unchanged production custody; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair; no production, prompt, parsing, authority or model decision changes.
Side effects: Wall times remain diagnostic, not a gate: this test no longer claims a host-latency ratio. A call-through spy counts envelope validation at status derivation above the historical-body memo, with exact one-new-status bounds and full-rebuild controls. Existing historical/live counts and all oracle/invalidation tests remain. Spies are restored in finally blocks.
Undo and recovery: Revert this commit; no persisted state or migration changes. That restores the flaky timing assertion, not a product behavior.
Multi-machine posture: Counters and spies are deliberately local to each test process. No shared store or ownership changes. Identical deterministic bounds apply on each host.
Layer below: Read the full constitution, store.readForProjection, snapshot.extendSnapshot/factStatus/prepareSnapshot, and historical.decodeHistoricalBody. Historical-body memoization can hide repeated status derivation from the owned decoder count, so the new count observes envelope validation at the start of each status derivation. Full rebuild exercises that same real validation path.
Bug class: integration
Bug evidence: reproducer=tests/facts/incremental-status.test.ts
Hook bypass: none
Convergence: none
Decision: train-169-repair-work | Replace timing as the acceptance oracle with exact status-work counts; retain timing diagnostics and real full-rebuild controls. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-169-repair-PROGRESS.md

Subject: tests/facts/incremental-status.test.ts

Evidence: Supplied Studio gate failed at ratio 3.7304214389042984 after the prior fastest-of-nine repair, while deterministic counts passed. The repaired file passes all 9 tests: one derivation and one historical owned decode per turn at both sizes; live refresh beyond the expected owned population is zero. Full rebuild controls validate 59 and 209 envelopes. Disabling running-snapshot reuse temporarily makes P2-OCC-07 fail with derivations 51 through 59 rather than one (negative log in the desk lanes directory); the production file was restored byte-for-byte. An injected performance clock reporting every small turn as 1 ms and every large turn as 1000 ms still passes the work test (clock log beside it); injection restored. An initial draft control using only historical decodes failed because the existing body memo returned zero: that exposed and corrected the measurement gap before submission. No full suite or live acceptance claimed; the pipeline owns full-head requalification.

## Closing block

simplestRobustRoute: Reuse existing fixtures and call through the real envelope validator with a test-only spy, keeping full-rebuild and mutation controls. This is the simplest robust route to detect full-history status re-derivation without mistaking scheduler delay for work. No production instrumentation, new policy, retries or threshold relaxation. Start guard: warm real store; end guard: exact counts and real rebuild controls; limits: existing bounded 50/200 histories and nine turns. All five production floors remain unchanged.
80/20: One touched test file plus its change review, targeted positive and negative evidence, TypeScript and cheap gates. No new timing harness or host load; the full Studio gate remains separate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
