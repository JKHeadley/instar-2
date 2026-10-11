# Change review — Inventory envelope budget regression repair

Subject base: 30e9d7b8fe790457e96eb1e40b7b9f4835699b48
Review state: open
Reviewed content: none
Outcome: Restore the inventory overflow regression by measuring its byte boundary from current real intake envelopes instead of a repeatedly retuned fixed budget.
Affected rules: 25, 26, 37, 46, 49, 60, 70, 74, 101, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain existing checkpoints; the test proves one call and one send within the envelope cap.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Only a regression test changes; runtime behavior, prompts, authority and model-output interpretation are unchanged.
Side effects: The test creates a second temporary encrypted journal for measurement. It still fails if the inventory cannot be omitted, the ordinary envelope cannot fit, or intake does not drain exactly once.
Undo and recovery: Revert this test and review in a new commit; no production data or migration is involved.
Multi-machine posture: Test-only, deliberately machine-local temporary journals; runtime ownership, replication and transport are unchanged.
Layer below: Inspected prepareJournalEnvelope's system-prompt-inclusive byte check, preparedFor's inventory and ordinary variants, and real intake writer binding. Assertions run outside callbacks whose failures the worker catches.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: inventory-measured-budget | Measure the smallest inventory envelope and a smaller ordinary variant, then replay fresh intake at one byte below that inventory boundary. This removes repeated manual prompt-size adjustments while preserving the negative and positive assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-self-knowledge-repair-PROGRESS.md

Validation: The original targeted file reproduced the reported failure (4 pass, 1 fail). After repair all 5 tests pass with nice -n 10 and --maxWorkers 1. Typecheck, build and architecture/register-wiring lint pass. No model-facing code changes, so no new model-quality or live acceptance claim is made.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the existing worker and envelope serializer to locate the boundary instead of another fixed byte adjustment. The named failure is recurring fixture drift whenever the briefing grows. Start guard: both measured envelopes exist and ordinary is smaller. Limit guard: every actual inventory attempt overflows the real cap. End state: one accepted ordinary context, one recorded call and one delivered reply. No runtime machinery or ability restrictions are added.
80/20: Repair is limited to the failing test and its review; the pipeline owns full-suite execution and independent landing review.
VERDICT: author submission; the independent verdict is recorded as a pass
