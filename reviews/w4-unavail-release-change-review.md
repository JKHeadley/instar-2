# Change review — release replies when their review is unavailable

Subject base: 26ba472680a770a9f35a7050809a1d6d323b60c7
Review state: open
Reviewed content: none
Outcome: Live updates 715675322 and 715675327 produced answers but no send or holding notice. Both rejected blocker declarations went directly to subscription review (no Jev call); reviews exceeded the 2048-token output cap at 2116/3915 tokens, returned uncertain, and became unavailable. The unavailable branch treated the rejected declaration as a veto, wrote a permanent hold and skipped the existing release/notice path. Unavailable review now releases the operator's reply with its unavailable result recorded; the rejected declaration remains rejected. Credential and shared-audience floors still withhold the candidate and send the existing content-free notice. Silent unavailable holds resume through the same bounded durable send path without repeating paid reviews. Already-noticed holds stay recorded. The release counter includes unavailable checks without Jev flags and excludes holding notices.
Affected rules: purpose Rule 2 (no silently lost answer), 4/57/86 (secrets and audience floors), 41/42 (unavailable and rejected records stay honest), 55/60 (existing review deadline and call cap), 77/95 (reachability fails open), 35/70 (offline replay of actual records), 49/74/111/113/116 (traceability, side effects, underlying path, machine posture, simplicity), 101 (no hook bypass)
Affected floors: secrets — exact checks and credential flags still withhold candidate text; spend cap — no additional retry or raised limit; stop — existing gates precede intent/send; no duplicate sends — existing durable intent and send receipts, tested across reopen; durable intake — original inputs, answers and unavailable results retained
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes the reply-release decision at the operator send doorway
Side effects: unavailable review of a rejected obligation declaration no longer withholds the reply; it does not accept that declaration. Previously silent unavailable holds can produce their first reply or holding notice under ordinary reply bounds. Existing sent or noticed holds do not get resent. Release totals now include unavailable checks without Jev flags.
Undo and recovery: revert this change; no schema migration or new state. Existing release intents and receipts retain send deduplication on rollback. Rollback restores the defective silence for new unavailable reviews.
Multi-machine posture: machine-local, deliberately; this is the existing preview journal worker. No new store, ownership path or cross-machine effect is introduced.
Layer below: journal-agent.mjs invokeSubscription/escalate maps output-cap uncertain to unavailable; reply-check.ts preserves that result and the bounded review reservation. journal.ts intent projection durably clears a prior hold and existing send dispatch prevents repetition. All remain the same except the consumer's release decision.
Bug class: integration
Bug evidence: reproducer=tests/preview/review-unavailable-release.test.ts
Hook bypass: none
Convergence: none
Decision: unavailable-is-no-veto | preserve the refused declaration but release the operator reply without inventing a model verdict; retain credential/audience notices through the existing path | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-unavail-release-PROGRESS.md
Prompt review: no prompts, model selection, parsers or provider limits changed; the consumer of an unavailable verdict changed. Real answer/check/outcome rows from updates 715675322 and 715675327 are captured in the new fixture and replayed through the worker. Existing recorded summary, Jev, review and delivered/empty reply shapes were also replayed.
Prompt finding: 849db3a6296a | protocol-literal | existing fixed memory-inventory reply, unchanged
Prompt finding: bd01de21286a | protocol-literal | existing memory-grounding instruction, unchanged
Prompt finding: fb5fa7e706c8 | protocol-literal | existing memory-grounding instruction, unchanged
Deferral: tests/preview/reply-check.declarations.json:13 | not-a-deferral=describes the runtime declaration and review outcomes; this change promises no deferred work

Subject (8 paths): tests/preview/README.md, tests/preview/fail-direction-agreement.test.ts, tests/preview/fixtures/review-unavailable-2026-10-09.json, tests/preview/held-cascade-replay.test.ts, tests/preview/journal.ts, tests/preview/reply-check.declarations.json, tests/preview/reply-check.test.ts, tests/preview/review-unavailable-release.test.ts

## Closing block

simplestRobustRoute: remove the early silent hold and use the existing durable release/holding-notice path. Recover only unavailable holds with no prior reply or notice. No new retry, timer, queue, provider or state. Start guards retain the recorded review and credential checks; end-state is a reply intent carrying unavailable or a content-free notice; existing stop, send, call and reply limits apply. Offline replay proves the shipped worker path with captured live failures; the pipeline owns live deployment and independent review.
80/20: four new captured-case regressions failed before the fix with zero sends, then passed. Targeted replay and floor tests, typecheck and architecture check are recorded in PROGRESS. Register source pins are regenerated by the desk.
VERDICT: author submission; no independent pass is asserted
