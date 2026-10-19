# Change review — Repair historical identity replay assertions

Subject base: be0a10a649a13ea13b5dc7cc163938caf24353cc
Review state: open
Reviewed content: none
Outcome: Repair seven failed assertions across five replay/activation tests after the reviewed runtime identity changed. Preserve real captured bytes and compare all remaining prompt content exactly.
Affected rules: Purpose self-knowledge and ability preservation; 34, 36, 37, 49, 58, 70, 74, 84, 101, 111, 112, 113, 116
Affected floors: secrets — no runtime change; spend cap — no runtime change; stop — no runtime change; no duplicate sends — recorded memory restart replay still sends once; durable intake — encrypted journal reopening remains asserted
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only integration repair; no production prompt, parser, authority, tool, budget, persistence or send behavior changes.
Side effects: Historical replays explicitly reconstruct only the old identity prefix; every other byte remains checked. Current identity is asserted by agentready, while the existing selfdesc-abilities capture binds the current model inputs. No fixture bytes change.
Undo and recovery: Revert this repair commit. No data migration or persisted state changes.
Multi-machine posture: Repository-shared tests; no machine-specific runtime state, ownership, transport or replication changes.
Layer below: Inspected subscription policy construction, the composed tool/native prompts, captured system digests, journal-test-worker and model error handling. A stale assertion inside the model callback became an unknown model outcome and prevented the replay send; moving that assertion outside makes future failures direct.
Bug class: integration
Bug evidence: reproducer=tests/preview/inrole-memory-live.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample files
Convergence: none
Prompt finding: 30b0bb720603 | quoted-evidence | Identity prefix compared with immutable historical prompt evidence; no production prompt or phrase gate is introduced.
Prompt finding: 7edc071186a4 | quoted-evidence | Identity prefix compared with immutable historical prompt evidence; no production prompt or phrase gate is introduced.

Subject (5 paths): tests/preview/act-first.test.ts, tests/preview/agentready.test.ts, tests/preview/inrole-memory-live.test.ts, tests/preview/offline-canary.test.ts, tests/preview/renew-activation.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: update the reviewed policy expectations and identity assertion, reconstruct only the historical identity prefix for immutable captures, and retain all other equality and delivery checks. No machinery or runtime guard is added; existing start, authority, resource and durable send floors remain intact. No new autonomous-completion claim.
80/20: All 37 tests in the five repaired files pass, including positive and negative renewal cases, successful and failed reads, uncertain reviewer shapes, durable intake and restart deduplication; typecheck and build pass. Full-suite execution belongs to the pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
