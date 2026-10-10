# Change review — integrate unavailable-review release

Subject base: 26ba472680a770a9f35a7050809a1d6d323b60c7
Review state: open
Reviewed content: none
Outcome: Integrate w4-unavail-release a9c19561 unchanged onto the exact live base. Replies whose contextual review is unavailable reach the existing durable send path; rejected obligations remain rejected. Credential and shared-audience floors retain the candidate and send the content-free notice. Recover silent unavailable holds only without prior intents or notices. Refresh the affected owner reference and replay the register.
Affected rules: purpose 2, 4, 35, 36, 37, 41, 42, 49, 55, 57, 60, 66, 69, 70, 74, 77, 86, 90, 95, 101, 102, 111, 112, 113, 116
Affected floors: secrets — existing credential and outbound checks; spend cap — unchanged limits and no added paid retry; stop — existing gates before send; no duplicate sends — existing durable intents and receipts; durable intake — existing journal preserves inputs, unavailable checks and rejected declarations
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The integrated unit changes a reply-release decision; the integration adds only pin and generated evidence refreshes.
Side effects: Previously silent unavailable holds may produce their first bounded reply or content-free notice. Already-noticed or sent turns do not repeat. Unavailable-release accounting includes turns without Jev flags and excludes holding notices. No new queue, timer, model prompt or schema.
Undo and recovery: Revert the unit and replay generated register evidence. Durable intents and receipts remain valid and deduplicate after rollback; reverting restores the old silent-hold defect.
Multi-machine posture: Machine-local preview journal, deliberately; no change to conversation ownership, forwarding, replication or effect authorization. Repository artifacts travel with the branch.
Layer below: Read the constitution in full; inspected journal intent recovery, unavailable-release accounting, credential/audience branches, captured output-cap cases and the owner-reference replay tool's committed-source requirement. The unit fast-forwarded without conflicts from the exact live head.
Bug class: integration
Bug evidence: reproducer=tests/preview/review-unavailable-release.test.ts
Hook bypass: none
Convergence: none
Decision: sb-w4-unavail-release-merge | ordinary merge fast-forwarded a9c19561 onto exact live head 26ba4726 without conflicts; unit rationale and recorded cases are in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-unavail-release-PROGRESS.md | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-unavail-release-PROGRESS.md
Decision: sb-w4-unavail-release-desk | use the existing desk chain; commit the one refreshed preview owner pin before replay because the generator reads committed bytes | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-unavail-release-PROGRESS.md
Prompt review: No new prompt or parser change in this integration. The unit's unavailable-verdict consumer is model-facing; replay captured updates 715675322/327 plus the existing summary, Jev, review and delivered/empty-reply records through targeted offline tests. No live-provider or Telegram claim.
Prompt finding: 849db3a6296a | protocol-literal | unchanged fixed memory-inventory reply
Prompt finding: bd01de21286a | protocol-literal | unchanged memory-grounding instruction
Prompt finding: fb5fa7e706c8 | protocol-literal | unchanged memory-grounding instruction
Deferral: generated/register.json:1 | not-a-deferral=generated runtime declarations, not a promise to postpone work
Deferral: tests/preview/reply-check.declarations.json:13 | not-a-deferral=runtime review outcomes, not deferred implementation

Subject (16 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/README.md, tests/preview/fail-direction-agreement.test.ts, tests/preview/fixtures/review-unavailable-2026-10-09.json, tests/preview/held-cascade-replay.test.ts, tests/preview/journal.ts, tests/preview/reply-check.declarations.json, tests/preview/reply-check.test.ts, tests/preview/review-unavailable-release.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge of the reviewed unit, existing desk repin/build/rehash/replay, and targeted consumer checks. No added machinery. Start guards are the exact base and preserved review/credential checks; end-state is one durable reply or content-free notice with honest unavailable provenance; stop, send, spend and reply bounds remain enforced. The pipeline owns independent and live deployment gates; no autonomous live completion is claimed.
80/20: Keep the unit bytes intact and refresh only stale derived evidence. Run its changed tests, recorded-shape replays, default-context floor, register lifecycle and cheap static checks, not the full suite.
VERDICT: author submission; no independent pass is asserted
