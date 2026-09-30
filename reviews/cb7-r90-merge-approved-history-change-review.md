# Change review — cb7-r90: merge approved-history (origin/main d5fecd42) into cint-L4; repin, re-declare conformance, regenerate

Subject base: 91cefaa085713d50518f1bdcf64263331510fadf
Review state: open
Reviewed content: none
Outcome: Integrates PR 138 (Rule 90 approved-history: the verified register spine adapter src/facts/register-spine.ts, the walkVersions alias/mutation fixes and their tests) into the live preview build cint-L4. Source and test files take the merge result unchanged (they equal origin/main). The pinned/generated files were resolved by regeneration, not by hand: the inventory pins for src/facts/index.ts, src/facts/version-chain.ts and tests/facts/fixtures.ts are set to the bytes now in the tree (identical to origin/main's reviewed pins), the desk chain refreshes the inventory digest in scripts/check-assembly-contracts.mjs, and the register is replayed at each source commit. Main's slice TypeScript transpile cache (#137) changed the self-host composition closure, so the harness conformance digest in src/assembly/harness.declarations.json was re-declared after re-running tests/preview/native-harness-contract.test.ts (8/8). CB7-R90 itself is NOT closed by this change: no production caller composes the spine and no production path produces a Part One verified explicit-yes Authorization (see the cb7-r90 PROGRESS record).
Affected rules: 7, 26, 31, 37, 90, 105, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a merge of already-reviewed main (Astra round-4 YES, clean Studio gate) plus mechanical pin/digest regeneration; no new behaviour is authored here
Side effects: the preview build now carries the register-spine adapter (unused in production) and the stricter walkVersions checks
Undo and recovery: revert the merge commit and the follow-on repin/regeneration commits; no durable format or record changes
Multi-machine posture: unchanged
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md; origin/main d5fecd42 (PR 138)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (21 paths): docs/build-part-three.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/part-four.json, scripts/check-assembly-contracts.mjs, src/assembly/harness.declarations.json, src/facts/README.md, src/facts/index.ts, src/facts/register-spine.ts, src/facts/version-chain.ts, tests/assembly/production-grounding-inventory.json, tests/facts/fixtures.ts, tests/facts/register-spine.test.ts, tests/facts/version-chain.test.ts, tests/integration/register.test.ts, tests/register/part-two-spine.ts

## Closing block

simplestRobustRoute: a plain merge with regenerated pins; no code authored (Rule 116).
80/20: tsc, lint, register:check pass; the merged spine/chain tests and the harness contract pass; the full gate runs in the pipeline.
VERDICT: author submission; the independent verdict is recorded as a pass
