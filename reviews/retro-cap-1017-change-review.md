# Change review — Retrospective answer scope

Subject base: d169b80bf8f7a7cb20675ea6396168c1313b29c0
Review state: open
Reviewed content: none
Outcome: Keep a normal retrospective pass within the existing output cap by asking for grades only for decisions/verdicts and omitting inapplicable optional fields. Two real-model replays of the recorded 12-case packet complete at 1356 and 1342 tokens, versus the original 2170-token truncated result.
Affected rules: 8, 9, 32, 36, 41, 42, 46, 49, 51, 55, 58, 60, 70, 74, 75, 101, 102, 111, 113, 116
Affected floors: secrets — read-only authenticated proof journals, no key in artifacts; spend cap — unchanged 2048 output tokens and call reservation; stop — unchanged; no duplicate sends — no send path changes; durable intake — unchanged journal and owed-case accounting
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Model-facing instructions affect autonomous retrospective output. Recorded journal comparison, actual model replays and positive/negative parser/accounting tests are included; deployment proof belongs to the desk.
Side effects: Generated register artifacts are mechanically refreshed against source commit d17ec6dc3d325f8ccbb67eeb68c0e8041a7f6a89 (shape-only replay, no runtime authority). The prompt and discipline digest change, making benchmark reruns due through existing behavior. Optional non-recurrence explanatory fields are no longer requested; the validator already ignores them. Existing duty follow-up and per-row refusals remain active.
Undo and recovery: Revert the prompt change and regenerate register pins. No state migration. Cases omitted or refused still remain owed, including across restart.
Multi-machine posture: Unchanged journal-backed retrospective on the existing owning worker. No new state, writer, replication rule or cross-machine dependency.
Layer below: Compared train-55 and train-60 runtime bytes; traced estimatedAnswerBytes, retrospectivePlan, validateRetrospective, owedCases, journal retrospect worker and subscription provider maxTokens. Train-60 runtime did not change; the terminal frame shows an unnecessary operator-message grade after CLI truncation.
Bug class: unit
Bug evidence: reproducer=tests/preview/retrospective-cap.test.ts; real evidence=tests/preview/fixtures/retrospective-cap-2026-10-17.json; exact recorded 12-case input and two model outputs replayed through readAnswer and validateRetrospective
Hook bypass: none; core.hooksPath unset, actual shared hooks directory inspected and contains sample hooks only.
Convergence: none
Decision: retro-cap-scope | Bound the answer by clarifying existing per-category duties and omitting ignored optional fields; keep shared cap and validators unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/retro-cap-1017-PROGRESS.md
Prompt review: Semantic category instruction, no fixture-specific phrase to trigger acceptance. Existing grades are required for decisions/verdicts; message/repair ids remain in inspected or omitted. Optional-field instructions follow existing validator behavior. Question digest in both real replays binds evidence to shipped wording. Real uncertainty/empty shapes replay through retrospective-promises.test.ts.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:30 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:34 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:38 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:42 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:46 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:50 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:54 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:58 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:62 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:66 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:319 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:323 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:327 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:331 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:335 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:339 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:343 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:347 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:351 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:355 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:359 | not-a-deferral=verbatim recorded owed-case reason; not deferred implementation work

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/retro-cap-1017-change-review.md, tests/preview/fixtures/retrospective-cap-2026-10-17.json, tests/preview/retrospective-cap.test.ts, tests/preview/retrospective.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: remove unnecessary output at its prompt source. The failing terminal result grades an operator message although the estimate prices only decision/verdict grades. Two sentences clarify scope and optional fields; no provider cap, parser acceptance, queue, retry or policy changes. Start guards (due work and call reserve), end-state accounting and stop/spend limits are unchanged. Real model replays complete unattended against the recorded packet; no claim of a deployed live-root pass is made.
80/20: Stop at the small prompt correction and measured replay once targeted checks pass. Semantic finding/grade refusals and uninspected duties remain honestly recorded and use existing follow-up; this change claims cap repair, not perfect model judgment.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
