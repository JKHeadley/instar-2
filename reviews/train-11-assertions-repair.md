# Change review — Preserve historical replay checks after prompt shortening

Subject base: bbd19ee159dcac876810d12bef8b10a6c70030f6
Review state: open
Reviewed content: none
Outcome: Repair seven stale assertions in five preview tests without changing the runtime, captured evidence or historical digest pins.
Affected rules: 11, 19, 36, 37, 47, 49, 58, 70, 74, 101, 110, 111, 113, 116; purpose ability preservation.
Affected floors: secrets — unchanged custody; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged durable claims; durable intake — unchanged journal.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only assertion repair; no model-facing source, parser or acceptance behavior changes.
Side effects: Historical comparisons explicitly translate only known shortened prose. Capture bytes, verdict digests, packet hashes, capability inventory and negative cases remain intact. No skipped tests or new machinery.
Undo and recovery: Revert this test-only commit. No runtime state or journal migration is involved.
Multi-machine posture: Identical stateless assertions on every machine; existing temporary offline replay journals remain machine-local. No ownership or transport change.
Layer below: Read both constitutional documents in full and inspected ANSWER_PROTOCOL, MIND_INSTRUCTIONS, ANSWER_INSTRUCTIONS, packetFor recall/pushback guidance, the 89fca853 diff and immutable self-description/promise captures.
Bug class: integration
Bug evidence: reproducer=tests/preview/selfdesc-abilities.test.ts; Before: fast-train-11-bbd19ee1 reports seven failures across the five repaired files. After: nice -n 10 npx vitest run --maxWorkers 1 on all five files passes 49/49; nice -n 10 npm run typecheck exits 0.
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt finding: 034c5250da92 | quoted-evidence | Existing protocol and capability wording is compared with historical capture text; no runtime prompt is edited or derived from a semantic answer — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "run without another yes. the operator can tighten or revoke trust through setup-"
Prompt finding: 45e37ea2e9e9 | quoted-evidence | Existing protocol and capability wording is compared with historical capture text; no runtime prompt is edited or derived from a semantic answer — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 4b98dc2a1b9f | quoted-evidence | Existing protocol and capability wording is compared with historical capture text; no runtime prompt is edited or derived from a semantic answer — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "tools: full claude code set"
Prompt finding: 6af48f94b789 | quoted-evidence | Existing protocol and capability wording is compared with historical capture text; no runtime prompt is edited or derived from a semantic answer — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "sends remain outside the one-machine closed set. the effect doorway reports any "
Prompt finding: 95e349aaf4ac | quoted-evidence | Existing protocol and capability wording is compared with historical capture text; no runtime prompt is edited or derived from a semantic answer — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "via the doorway's four tests; standing grants need no new approval."
Prompt finding: b00ed403060a | quoted-evidence | Existing protocol and capability wording is compared with historical capture text; no runtime prompt is edited or derived from a semantic answer — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Deferral: tests/preview/selfdesc-abilities.test.ts:41 | not-a-deferral=The historical instruction uses defer for instruction precedence, not postponing work.

Subject (5 paths): tests/preview/journal-longchat.test.ts, tests/preview/promise-fulfilment-quote.test.ts, tests/preview/recall-latency.test.ts, tests/preview/retrospective-live-failures-3.test.ts, tests/preview/selfdesc-abilities.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: update stale consumers and explicitly translate only the previously reviewed prose. No production change, cap expansion, capability restriction or quarantine. Existing floors and checkpoints remain; no new autonomous-completion claim.
80/20: Every reported failure now passes; preserved historical hashes and negative replay verdicts constrain the repair. The pipeline supplies a fresh full gate; no independent convergence is claimed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
