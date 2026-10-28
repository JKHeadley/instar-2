# Change review — Preserve T1 review time and T4 checked-tool uncertainty

Subject base: 19d9a4e77ab0203072d90a769af04e53289a39a7
Review state: open
Reviewed content: none
Outcome: The copied T1 answer was held after a revision consumed the shared review deadline; the copied T4 turn had six checked tool results but ended without an answer or notice. This isolated candidate reserves time for the required T1 remainder review and lets the existing one-time uncertain notice settle a fully checked T4 turn after a host gate refusal. Generated source register files are replayed against the exact combined code commit. No live switch is included.
Affected rules: 4, 8, 10, 26, 34, 46, 49, 55, 60, 70, 74, 92, 102, 110, 116
Affected floors: secrets — existing outbound redaction and claim review remain; spend cap — the existing shared deadline and model call limit remain; stop — wrapper and native stop still hold; no duplicate sends — the existing unique notice and receipt path remain; durable intake — copied journals only, with no live source mutation
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Both changes affect whether a real user receives a reply or a failure notice, so they need critical review despite their small production diffs.
Side effects: A locatable T1 objection clips the revision deadline to leave 25 seconds for mandatory review of the claim-excised remainder. A fully checked, no-child T4 tool turn may send the bounded uncertain notice after a gate refusal; incomplete traces and stops still hold. Generated register outputs reflect the committed combined source.
Undo and recovery: Revert the isolated branch before any switch. No live journal or schema was changed. If later deployed, existing held turns stay held unless retried through the normal durable path.
Multi-machine posture: Conversation ownership and send receipts remain the current authorities; these changes add no cross-machine state.
Layer below: Reuses the existing reply-review deadline, claim excision, tool trace, and unique uncertainty notice; no second send path was introduced.
Bug class: integration
Bug evidence: T1 stopped copy and exact review timing in .instar/lanes/real-task-candidate-20261027/PROGRESS.md; tests/preview/t1-review-budget-replay.test.ts reproduces coherent and incoherent remainder boundaries; T4 stopped copy has six paired results and exit 1; tests/preview/tool-failure-answer.test.ts covers gate refusal with complete and incomplete traces. Focused combined tests passed 96/96; typecheck, register check and lint passed. Full suite and five-task candidate score remain pending.
Hook bypass: none
Convergence: Independent scoped reviewer found no concrete safety or correctness defect and cleared isolated copy trial; live acceptance still depends on full suite and task score.
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: real-task-r3-review-budget-1028 | Reserve 25 seconds for mandatory review of a claim-excised remainder so a slow full revision cannot consume the whole review deadline. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/real-task-candidate-20261027/PROGRESS.md
Decision: real-task-r3-gate-notice-1028 | Permit the existing unique uncertain notice only after all admitted tool results are paired, no child remains, and no stop occurred. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/real-task-candidate-20261027/PROGRESS.md
Prompt review: No new operator-facing instruction text is added. T1 and T4 fixtures are recorded evidence and synthetic replay inputs. The generated register is a pinned description of the combined tree.
Prompt finding: 4106b49fff07 | protocol-literal | Preexisting topic-awareness regression phrase, not a new behavioral instruction.
Prompt finding: 849db3a6296a | protocol-literal | Preexisting memory-list regression phrase, not a new behavioral instruction.
Prompt finding: 85544c20941f | protocol-literal | Preexisting conversation-session regression phrase, not a new behavioral instruction.
Prompt finding: e8708c7fea24 | protocol-literal | Preexisting hallucinated-memory-rate regression phrase, not a new behavioral instruction.
Deferral: generated/register.json:1 | not-a-deferral=Generated source register metadata, not postponed work.

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal.ts, tests/preview/t1-review-budget-replay.test.ts, tests/preview/tool-failure-answer.test.ts, tests/preview/tool-turn.mjs

## Closing block

simplestRobustRoute: Keep the two small repairs in the existing review and notice paths, rerun the full gate, then measure the same five user tasks on fresh copies before any switch.
80/20: Reserve review time for one observed T1 failure and settle one fully checked T4 failure; keep all other reply and tool safety boundaries intact.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
