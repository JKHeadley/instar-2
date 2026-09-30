# Change review — cint-L4 repair: a reply review that held its answer is 'held' step coverage, not 'failed'

Subject base: 91cefaa085713d50518f1bdcf64263331510fadf
Review state: open
Reviewed content: none
Outcome: Live-proof group E (2026-09-29, build 6a510352) finding E13b: stepCoverage.operator-reply answer/interpret/send read state "failed" (validated 28, failed 1, unavailable 3, missing 24 of 56). A read-only probe of the live journal showed the one failure is update 969389575: Jev unsure then the full review returned a credential violation, and the fixed holding notice was sent in place of the answer, so the flagged answer never left. Decision at the source: Rule 38 asks that each step of a critical pipeline be watched and validated, and Rule 9 that an artifact prove the looking happened; both hold for a held answer, so the boundary is covered. Rule 42 says a refusal stays a refusal through every layer, so it must not become 'validated'. The operation state is now 'held' (counted in a new held field); a row reads 'held' only when no operation is failed, missing or unavailable. A violation whose flagged text went out is still 'failed', so the boundary is proven from both sides. The E13b criterion in the desk's live-proof E.sh was also stale: the written criterion (cint-23 test 13) is for the exercised ID, with the aggregate as a baseline never expected to reach zero, so it now reads the change from the e-start baseline. Finding E17a: the status is right and the criterion stale; U1 (bf912a74) re-dated preview.step-check to 2026-10-15 in the durable promotion record with reason and owner, and stages now read from that record, so fleet is 'missing', not 'unavailable'; E17a now checks the recorded re-date, not overdue, and fleet missing. Both desk criteria were evaluated against the recorded results (PASS) and a mutated snapshot (FAIL).
Affected rules: 9, 38, 42, 72, 73, 116
Affected floors: secrets — unchanged, the reported state carries no body; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged, only a status projection changes; durable intake — unchanged, the journal is only read
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes the Rule 38 step-coverage state reported in status for the operator-reply pipeline
Side effects: a status consumer that treated any non-'validated' row as uncovered now also sees 'held'; the only consumers are status/tests and the desk live-proof scripts, updated alongside. Rows with any failed, missing or unavailable operation read as before.
Undo and recovery: revert these commits and regenerate the register; no durable format or journal record changed
Multi-machine posture: machine-local single runner per journal, unchanged
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md; tests/preview/journal.ts holding path (HOLDING_REPLY / CREDENTIAL_SHAPE_NOTICE sent in place of a held answer, replyBody); src/verification/policy.ts supervisionCoverage, unchanged
Bug class: integration
Bug evidence: reproducer=tests/preview/proofs.test.ts
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/part-nine.json, tests/preview/proofs.test.ts, tests/preview/proofs.ts

## Closing block

simplestRobustRoute: one extra state in the existing coverage projection, derived from the existing sent text; no new store, no journal change, no new checker (Rule 116). The simpler alternative, only fixing the criterion, would leave status reporting correctly held replies as failed coverage.
80/20: new neighbor test covers held (holding notice, credential notice, action-header form), released-flagged (failed) and unreviewed (missing); tsc, touched test files, lint, register:check pass; the full gate reruns on the Mama PC.
VERDICT: author submission; the independent verdict is recorded as a pass
