# Change review — Repair act-first prompt and capacity test consumers

Subject base: abc261dd3d87bfe3c97c89e626dd45aa9560da49
Review state: open
Reviewed content: none
Outcome: Repair the three fail-fast test regressions caused by act-first prompt composition; preserve exact assertions, historical fixtures and the shipped runtime.
Affected rules: 25, 26, 34, 36, 37, 40, 46, 47, 49, 65, 70, 74, 78, 84, 101, 111, 112, 113, 116.
Affected floors: secrets — unchanged; spend cap — unchanged, envelope capacity still enforced; stop — unchanged; no duplicate sends — one call and one send asserted; durable intake — accepted inventory question drains exactly once.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Only three test consumers change; no runtime, fixture, prompt, parser, authority, or state changes.
Side effects: The capacity case adapts to prompt length by measuring actual ordinary and empty-inventory candidate envelopes; it fails if either side disappears or an inventory candidate fits under the selected cap. Exact historical prompt equality now allows only the two declared read-first insertions.
Undo and recovery: Revert this repair commit. Runtime and journals require no migration or recovery; reverting restores the stale failing test assumptions.
Multi-machine posture: Test-only changes; shared runtime, ownership and checkpoint behavior on every machine remain identical. No new state or peer requirement.
Layer below: Read both governing documents in full, the fail-fast findings, actual journal fitter and read-only probe, envelope assembly and memory-lookup availability, shared tool guidance, historical K11a captures and act-first replays. Existing compiled register and architecture checks pass without repinning.
Bug class: none
Bug evidence: Provided fast.log reproduces all three original failures. Foreground nice -n 10 vitest with --maxWorkers 1: 35/35 passed across the three changed files plus act-first recorded-shape replay; typecheck and build pass. Evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-act-first-repair-tests.log.
Hook bypass: none
Convergence: none
Decision: repair-test-assumptions | Fix exact assertions and derive the capacity window from prepared bytes; keep the reviewed runtime unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-act-first-repair-PROGRESS.md
Prompt finding: 19f601351a87 | protocol-literal | Exact boundary in the existing tool prompt, quoted only to verify the historical capture differs by the declared read-first insertions; no production prompt or classifier changes.
Prompt finding: 83812befa673 | protocol-literal | Exact boundary in the existing tool prompt, quoted only to verify the historical capture differs by the declared read-first insertions; no production prompt or classifier changes.
Prompt finding: 9248e5418f4f | protocol-literal | Exact boundary in the existing tool prompt, quoted only to verify the historical capture differs by the declared read-first insertions; no production prompt or classifier changes.

Subject (3 paths): tests/preview/journal-commitments.test.ts, tests/preview/journal-memory-inventory.test.ts, tests/preview/selfdesc-abilities.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: repair stale test consumers and use the existing read-only fitter to derive the actual capacity window. It prevents the repeatedly documented failure of a fixed byte budget after prompt changes. No runtime machinery is added. Start guard: exact captured prompt and real serialized candidates; end guards: exact prompt assertions, overflow refusal, one accepted answer and one send; all named floors unchanged. No new autonomous capability is claimed.
80/20: Run the three changed test files, existing real recorded-shape replay, tsc and all required cheap checks; no full suite or load test. The pipeline generates full-run evidence after push.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
