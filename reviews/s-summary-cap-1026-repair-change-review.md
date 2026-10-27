# Change review — Repair summary cap tool-route regression evidence

Subject base: 452b122f02aac03b56ff28c5dea907a7572916e6
Review state: open
Reviewed content: none
Outcome: Correct the tool-route generation expectation while retaining its unchanged answer-bound refusal, and record the required 1.x comparison.
Affected rules: 13, 37, 49, 70, 74, 101, 111, 112, 113, 116.
Affected floors: secrets — unchanged custody; spend cap — unchanged admission and total accounting; stop — unchanged latch; no duplicate sends — no send path changed; durable intake — no journal mutation changed.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test assertion and comparison evidence only; no runtime, prompt, capability or policy change.
Side effects: The test now exercises both generation headroom and its previously unreachable over-cap refusal. No tool is removed or narrowed.
Undo and recovery: Revert this repair commit to restore the earlier test and record; runtime and persisted state require no recovery or migration.
Multi-machine posture: Test/evidence-only, machine-independent assertions. Existing journal ownership and replication remain unchanged; no new machine-local state.
Layer below: Inspected production-provider.ts generation environment and policy answer bounds, and both 1.x sources at the pinned commit described below. The adapter continues to admit answer tokens separately from whole-output metering.
Bug class: none
Bug evidence: none — test expectation and missing comparison repair; original runtime regression and recorded live evidence remain in s-summary-cap-1026-change-review.md.
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->

Subject (1 paths): tests/assembly/production-provider-tools.test.ts

1.x reuse-or-no-fit comparison: Read JKHeadley/instar at the locally available origin/main 7376810e2b7770fc7c954c1a64d6cadfdd745f59 using git show from /Users/dabombstudio/.instar/agents/echo. src/memory/TopicSummarizer.ts inherits the proven rolling-summary behavior: previous summary plus bounded new messages, a response-token budget, call attribution/provenance, and a saved summary frontier. Its implementation selects the newest bounded message suffix, truncates individual messages, accepts a PURPOSE/text response, and saves through TopicMemory; it does not provide the 2.0 journal's exact accepted oldest-prefix frontier, durable over-cap failure history or faithfulness-before-commit checkpoint. Reusing that behavior through the existing 2.0 journal worker is appropriate; transplanting the class would add a second memory authority and would not repair repeated oversized prefix selection. src/core/ClaudeCliIntelligenceProvider.ts supplies the inherited CLI JSON invocation, .result extraction and usage reporting (input including cache components, whole output_tokens). It has no separate thinking-aware generation allowance versus answer admission, and its raw-text fallback does not fit 2.0's exact terminal/summary parsing. The existing 2.0 production-provider.ts owns the pinned CLI environment, answer admission and whole-output metering, so it is the appropriate place to add measured thinking headroom. The existing journal worker owns shrinking failed prefixes via its durable frontier. Reuse verdict: reuse those established behaviors and current 2.0 owners; no legacy implementation transplant, new summarizer, store or retry engine is needed. This repair changes only the stale tool-route test and records this comparison; runtime behavior remains as reviewed.

Decision: repair-scope | Correct the test and comparison only; follow the repair-specific targeted verification scope. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-cap-1026-repair-PROGRESS.md

Validation: nice -n 10 npx vitest run --maxWorkers 1 --configLoader runner --project parallel tests/assembly/production-provider-tools.test.ts: 10/10 pass, including unchanged over-cap refusal; nice -n 10 npm run typecheck: exit 0. Logs are in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-cap-1026-repair-evidence/. No full suite or live-model call was run in this repair.

## Closing block

simplestRobustRoute: Update the existing test description and generation assertion, keep its answer-bound and refusal checks, and document the 1.x comparison. This is that route. Start: reviewed source head. End: targeted tool-route test and cheap gates pass. Limits: no runtime, ability, floor or authority changes; no new machinery or autonomous-completion claim.
80/20: Both must-fix findings are addressed at their smallest existing sites; no broader implementation change is justified.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
