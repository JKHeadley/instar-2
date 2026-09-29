# Change review — U12: the Jev response reader holds Rule 36 on a genuine TypeSafe capture

Subject base: 91cefaa085713d50518f1bdcf64263331510fadf
Review state: open
Reviewed content: none
Outcome: The Jev response reader (preview.reply-check.parseJevResponse) was tested only on hand-written bytes and carried a deferred Rule 36 hold. One genuine TypeSafe System One response (jev-1.13.0, HTTP 200, 513 bytes, captured 2026-09-29 from a reply-check request built by jevRequestBody on agent-authored text) is committed unchanged at tests/fixtures/captures/jev-response.json; nothing personal is in it, so nothing is redacted. The preview owner's capture row now records it as captured, a new committed test reads it through parseJevResponse and interpretJev, and the parser's Rule 36 hold is held on that fixture. The synthetic Jev file is removed because nothing reads it. The Telegram and Slack readers keep their owned deferred loops: a genuine Telegram update needs a message from a person's account, which is the desk's probe step recorded in the defect record.
Affected rules: 36, 8, 71, 89, 116
Affected floors: secrets — unchanged, the capture carries no credential and the key never left host custody; spend cap — one metered Jev call spent at capture time, none at test time; stop — unchanged; no duplicate sends — unchanged, nothing is sent; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes a parser's Rule 36 hold class in the register and the preview owner's capture contract
Side effects: the register loses the loop deferred:preview.reply-check.parseJevResponse:36; the preview owner may now keep captures under tests/fixtures/captures
Undo and recovery: revert these commits and regenerate the register; no runtime state or durable format changed
Multi-machine posture: the capture, test and record travel with the repository; the reader runs machine-local, unchanged
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md; scripts/register-shipped.mjs R36 (hold evidence must be a committed test importing the parser and reading its captured bytes); scripts/register-owner-references.mjs preview capture contract
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed
Deferral: docs/defects/rule-36-genuine-parser-captures.md:3 | commitment=docs/defects/rule-36-genuine-parser-captures.md
Deferral: generated/coverage.md:14 | not-a-deferral=generated register count of existing owned deferred loops, not a commitment by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (15 paths): docs/defects/rule-36-genuine-parser-captures.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, scripts/register-owner-references.mjs, tests/fixtures/captures/README.md, tests/fixtures/captures/jev-response.json, tests/preview/fixtures/jev-response-synthetic.json, tests/preview/jev-response-capture.test.ts, tests/preview/reply-check.declarations.json

## Closing block

simplestRobustRoute: one genuine capture replaces the synthetic row, one test file reads it through the existing parser, and the capture contract's path pattern admits the row's directory; no new service, parser or script (Rule 116).
80/20: the new test passes on the genuine bytes on both sides of the decision line (pass as captured, violation when one score crosses its line, refusal on a wrong model, a missing question or an oversized body); tsc, lint and register:check pass; shipped, owner-references and reply-check tests pass; the full gate reruns in the pipeline.
VERDICT: author submission; the independent verdict is recorded as a pass
