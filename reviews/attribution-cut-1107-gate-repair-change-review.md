# Change review — attribution-cut-1107 READY-gate repair: R105 re-declaration, owning Rule 36 merge, register replay

Subject base: a4b830585ac985ef43716fb495bc3ee19b65bbae
Review state: open
Reviewed content: none
Outcome: The desk's READY gate refused a4b83058 on npm run lint (R105) and npm run register:check. Both now exit 0. (1) R105: the native macOS self-host contract (tests/preview/native-harness-contract.test.ts) passed its full contract case on this Studio for this composition (node-24.14.1), and the declared conformance is the adapter's own computed artifact, sha256:c0d14a27daaaa6a0529ff65727af649aeb1f5f1dd84b09014e116729da258bb8; the file then passes 10 of 10 and the architecture check exits 0. (2) register:check stopped at "P3-NF-24: deadline passed for deferred:slack-intake-v1:36", which the untouched base 3ad4ec04 gives too. Under one cause, one repair, its owning repair is the unit rule36-captures-1107 (origin/fix/rule36-captures-1107, c69f89ec3, on the same base), merged here unchanged rather than repaired again: it closes both Rule 36 deferred holds on genuine redacted captures and records the bounded preview graduation ceiling. (3) The register is replayed at the merge with the desk's own mechanical chain (desk-rehash-owner-manifests.mjs and desk-repin-chain.sh, both no-ops here, then build-register --replay); only generated/ changed.
Affected rules: 105 and 115 (conformance re-declared from a passing contract run, not a digest copy); 36 (genuine captured bytes, carried from the owning unit); 24 and P3-NF-24 (an overdue loop is closed by its owner's repair, not by moving the deadline in this unit); 74 (this record); 101 (plain git commit and merge, no bypass flag, no stash). The merged unit's own record, reviews/rule36-captures-1107-change-review.md, carries its rules and decisions.
Affected floors: secrets — unchanged here; the merged capture has the app verification token replaced and ids masked, per its own record; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Takes the suggested tier; the subject includes the harness declaration and the merged parser declarations.
Side effects: The native conformance declaration names this composition; the Rule 36 holds for Telegram and Slack become held on genuine captures; the generated register is replayed at f12abf26.
Undo and recovery: Revert the replay, merge and re-declaration commits on top of a4b830585.
Multi-machine posture: Unchanged; tree content only.
Layer below: Read the failing gate output, src/rulegraph/graph.ts checkDeadlines (P3-NF-24 and graduation ceilings), scripts/build-register.mjs (parent register load), the desk's merge-live-chain.sh step 4 (conformance, rehash, repin, replay), the rule36-captures-1107 PROGRESS and record, and train-211's replay of the same commits (2a6be4ef2). 1.x: none fits; this is 2.0 register and conformance machinery with no 1.x counterpart.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: gate-r105-redeclare | Re-declare the native conformance from a passing contract run on the Studio, because the desk's gate refused the head on it and named fixing it at source. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-cut-1107-PROGRESS.md
Decision: gate-merge-owner | Merge the owning Rule 36 repair (rule36-captures-1107) instead of writing a second repair or moving the deadline, per one cause, one repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-cut-1107-PROGRESS.md
Deferral: docs/defects/rule-36-genuine-parser-captures.md:3 | commitment=docs/defects/rule-36-genuine-parser-captures.md
Deferral: docs/defects/rule-36-genuine-parser-captures.md:14 | not-a-deferral=carried from the merged owning unit: records the completed Telegram closure and that the hand-written fixture stays recorded synthetic; it defers nothing
Deferral: docs/defects/rule-36-genuine-parser-captures.md:16 | not-a-deferral=carried from the merged owning unit: records the completed Slack closure and that the hand-written fixture stays recorded synthetic; it defers nothing
Deferral: generated/coverage.md:14 | not-a-deferral=generated register output replayed by the desk chain, not authored prose
Deferral: generated/register.json:1 | not-a-deferral=generated register output replayed by the desk chain, not authored prose

Subject (25 paths): docs/defects/preview-dark-feature-deadlines-2026-11-01.md, docs/defects/rule-36-genuine-parser-captures.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/part-twelve.json, reviews/attribution-cut-1107-gate-repair-change-review.md, scripts/register-owner-references.mjs, src/assembly/harness.declarations.json, src/conversation/slack.parser.json, src/conversation/telegram.parser.json, src/rungraph/rungraph.declarations.json, tests/conversation/fixture.ts, tests/conversation/slack-envelope-capture.test.ts, tests/conversation/slack-preparation.test.ts, tests/conversation/telegram-update-capture.test.ts, tests/fixtures/captures/README.md, tests/fixtures/captures/slack-envelope.json, tests/fixtures/captures/telegram-update.json, tests/preview/journal.declarations.json, tests/register/owner-references.test.ts

Verification: native-harness-contract.test.ts 10/10 after re-declaration; check-architecture exit 0; npm run lint exit 0; npm run register:check exit 0.

## Closing block

simplestRobustRoute: Re-run the contract and declare what it computed; merge the existing owning repair; replay with the desk's own chain. Nothing new is built.
80/20: Both refused gate commands exit 0 on the pushed head; the attribution change itself is unchanged.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
