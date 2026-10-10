# Change review — credential wording in the answer context

Subject base: 26ba472680a770a9f35a7050809a1d6d323b60c7
Review state: open
Reviewed content: none
Outcome: live update 969390298 repeated internal credential names from earlier answer text. Answer preparation now renders those mentions using credentialDisplayLabel, including legacy history, summaries, memory candidates, supplied self-state/briefing text, and historical prompt prose. The existing approval rendering retains request 87432af9acef18cc, its applied state, expiry and shared-account disclosure. Custody and journal records are not renamed.
Affected rules: 2/7/90/100 (original records, custody keys and expiry preserved), 34/36/70 (real recorded context and verdict replay), 49/74/111 (scope, side effects and foundation reviewed), 80/84 (plain wording and accurate self-awareness), 101 (no hook bypass), 113 (stateless projection across machines), 116 (existing text projection and label helper)
Affected floors: secrets — existing custody and reply checks retained; spend cap — no added model calls; stop — unchanged; no duplicate sends — unchanged; durable intake — original journal bytes retained
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: the existing answer packet carries the presentation change; authority and send decisions are unchanged.
Side effects: legacy credential wording is rendered in context prose. Full-token literal matching leaves neighboring identifiers and account identities alone; replacements do not cascade. Historical packet reference fields retain their identities. Each preparation reads the registry once; a registry read failure keeps the legacy wording projection and does not block answering.
Undo and recovery: revert this change; no stored record, schema or expiry migration is required.
Multi-machine posture: stateless presentation on every runner; no new machine-local store, transport, ownership or replication behavior.
Layer below: credentialDisplayLabel/publicCredentialRegister, custody registration and record identity, journal memory projection, historical prompt provenance, operator request rendering, and launcher run/inspect composition.
Bug class: integration
Bug evidence: reproducer=tests/preview/credential-answer.test.ts
Hook bypass: none
Convergence: none
Decision: w4-credname-answer-projection | reuse the prose projection and exact legacy activation aliases because historical replies retain older activation references after the registry advances; retain every stored identity and add no output gate | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credname-answer2-PROGRESS.md
Prompt review: no decision prompt or response parser changes. The context uses plain labels for internal credential mentions. Real live history from updates 969390281-969390285 and the delivered answer at 969390298 reproduces the leak without the projection and passes with it. The current live journal was also probed read-only with this tree. Summary over-cap/cascade and credential-boundary replays now install the same formatter while retaining their recorded uncertain, undecided, PASS and VIOLATION outcomes. The empty-string control is synthetic; no real empty bubble is claimed. Pipeline live delivery remains the desk's gate.
Prompt finding: 849db3a6296a | protocol-literal | existing memory-list reply literal, unchanged
Prompt finding: bd01de21286a | protocol-literal | existing source-label guidance, unchanged
Prompt finding: fb5fa7e706c8 | protocol-literal | existing remembered-fact guidance, unchanged

Subject (8 paths): tests/preview/credential-answer.test.ts, tests/preview/credential-display.ts, tests/preview/credential-label-boundary.test.ts, tests/preview/fixtures/credential-answer-live-2026-10-09.json, tests/preview/journal-agent.mjs, tests/preview/journal.ts, tests/preview/summary-cascade-stall.test.ts, tests/preview/summary-overcap-cascade.test.ts

## Closing block

simplestRobustRoute: this is the existing credential label function applied at existing text projections, with exact compatibility aliases for shipped historical activation references; no new model, gate, store or renamed identity.
80/20: the reproduced leak is removed from the answer context, original records remain intact, and related recorded-shape and launcher checks pass. Register source pins remain the desk-owned regeneration step.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
