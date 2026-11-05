# Change review — Refresh correction repair register pins

Subject base: 89f222804b04ee6d36c717ea5afb1825e9dd0303
Review state: open
Reviewed content: none
Outcome: Regenerate the register from repair commit 89f222804b04ee6d36c717ea5afb1825e9dd0303 using build-register --replay; source pins now bind the repaired implementations.
Affected rules: 5, 49, 69, 74, 90, 101, 113, 116
Affected floors: secrets — no credential or lesson text added; spend cap — no runtime change; stop — no runtime change; no duplicate sends — no runtime change; durable intake — generated views only.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Mechanical source-pin regeneration only; register schema, population and authority remain unchanged.
Side effects: Generated register and document hashes change together with their source commit. The browser-bridge-on-resource-1104 and browser-mcp-worker-read-1104 frozen reviews are explicitly reopened under Rule 109 because their shared subject pins changed; no old independent verdict is claimed for this repair.
Undo and recovery: Regenerate against the reverted implementation; never edit pins by hand.
Multi-machine posture: Deterministic generated artifacts shared through git; no machine-local runtime state.
Layer below: Delegated desk owner-manifest rehash and repin scripts, build-register replay and register wiring checker.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/register.json:1 | not-a-deferral=generated register entry wording, not postponed repair work

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json


Train-170 integration: This review round is explicitly reopened because the combined register publication changes its generated subject. Product source remains byte-identical to reviewed 88aabf739; reviews/train-170-change-review.md covers the new composition.
Prompt review: Preserve the reviewed correction prompts and recorded-shape evidence; composition adds no prompt.
Prompt finding: 4106b49fff07 | protocol-literal | Existing guidance or exact status wording tested as delivered; no new lexical meaning gate — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Existing guidance or exact status wording tested as delivered; no new lexical meaning gate — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Existing guidance or exact status wording tested as delivered; no new lexical meaning gate — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Existing guidance or exact status wording tested as delivered; no new lexical meaning gate — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: generated/conversion.json:1 | not-a-deferral=retained generated rule wording or recorded provider fixture text; no train work is postponed
Deferral: tests/preview/correction-review.test.ts:112 | not-a-deferral=retained generated rule wording or recorded provider fixture text; no train work is postponed
Deferral: tests/preview/fixtures/correction-retrospective-2026-11-04.json:89 | not-a-deferral=retained generated rule wording or recorded provider fixture text; no train work is postponed
Deferral: tests/preview/fixtures/correction-retrospective-2026-11-04.json:93 | not-a-deferral=retained generated rule wording or recorded provider fixture text; no train work is postponed
Deferral: tests/preview/fixtures/correction-retrospective-2026-11-04.json:97 | not-a-deferral=retained generated rule wording or recorded provider fixture text; no train work is postponed
Deferral: tests/preview/fixtures/correction-retrospective-2026-11-04.json:101 | not-a-deferral=retained generated rule wording or recorded provider fixture text; no train work is postponed
Deferral: tests/preview/fixtures/correction-retrospective-2026-11-04.json:105 | not-a-deferral=retained generated rule wording or recorded provider fixture text; no train work is postponed
Deferral: tests/preview/fixtures/correction-retrospective-2026-11-04.json:109 | not-a-deferral=retained generated rule wording or recorded provider fixture text; no train work is postponed

## Closing block

simplestRobustRoute: Use the existing generator and replay check. This is the simplest route and adds no mechanism or runtime behavior.
80/20: The seven generated views bind one implementation commit, and earlier review rounds explicitly record their changed scope; lint and register:check verify the pins.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
