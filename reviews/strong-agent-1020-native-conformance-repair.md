# Change review — Refresh native self-host conformance evidence

Subject base: e4bc35e42b0aa131cfc784ff0d55dac74bf81218
Review state: open
Reviewed content: none
Outcome: Repair the review's sole must-fix: the supported preview-self-host-native / claude-code-subscription / darwin / self-hosting declaration now certifies the current composition, sha256:599d9216a8f108e41d208e5d98de670c8eff5eada89e23fcfb051c20b6e042f7, after its declared native contract passed on the declared runtime. Replay the register to include this evidence and the original unit's changed provider source pins. Capability remains supported.
Affected rules: 26/105/115 (fresh evidence for exact composition and runtime); 30/84/103 (preserve both providers' capability guidance); 37/70 (reproduce and verify the stale-evidence repair); 49/74/111 (scope, side effects, recovery and foundation recorded); 101 (no hook bypass); 112/113 (preserved history and explicit machine posture); 116 (existing contract and generators, no new machinery).
Affected floors: secrets — custody and disclosure unchanged; spend cap — existing admission and metering unchanged; stop — existing latch preserved and exercised by the contract; no duplicate sends — dispatch and uniqueness unchanged; durable intake — existing journal and admission unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: An evidence-only refresh with one declaration value and deterministic generated output; no executable behavior, authority, protocol, schema, prompt, or test assertion changes.
Side effects: The native adapter can again report supported conformance for its actual bytes. Generated capability and register views now reference the new certificate and current provider source versions. No capability is disabled and no checker is weakened.
Undo and recovery: Revert the certificate commit and replay the register for the desired source revision. Restoring the old certificate alone makes the current composition fail R105 again; certify any replacement composition through the same contract. No stored-state migration is needed.
Multi-machine posture: Evidence is specific to the declared native macOS runtime. No ownership, replication, durability demand, peer dependency, or shared state changes. Other harness/platform tuples keep their existing declarations.
Layer below: Inspected scripts/composition-digest.mjs (complete static import closure, runtime and executable digest), scripts/check-architecture.mjs (R105 comparison), tests/preview/self-host-harness.mjs (runtime admission of certificate), and tests/preview/native-harness-contract.test.ts. On Darwin, the exact named native contract passed before re-declaration (1 selected test); all 10 tests in its file passed afterward, including real confined package tests/install/probe, owner admission, stop, refusal/timeout, journal restart and fake-delay deadline checks. Runtime exactly matches node-24.14.1@sha256:91d3afb67a7dc211f642f2328f822505ff1c1ad381e98ffdd21b003970deeeda. Independent recomputation through the existing digest functions found a complete 268-file closure and the review's expected digest. Architecture failed only R105 before and passed after. Typecheck and build passed. The delegated owner rehash and repin chain reported zero changed pins; register replay repaired the stale provider source wiring.
Bug class: none
Bug evidence: none — evidence refresh for the existing contract; no behavioral bug or new reproducer.
Hook bypass: none
Convergence: none
Prompt review: No model-facing change in this repair. The original unit's recorded prompt comparisons and real-shape replay remain intact. The native contract uses recorded provider-frame shapes with shipped native owners, confinement and real installed code; it is not a new live-model or public-dispatch claim.
Deferral: generated/register.json:1 | not-a-deferral=deterministically replayed register output containing existing descriptions, not a new commitment

Subject (8 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/harness.declarations.json

## Closing block

simplestRobustRoute: Run the existing native conformance contract on its declared runtime, recompute and refresh only its certificate, then replay existing register output. This is that route. Start guard: exact runtime and complete closure; end guard: native contract and architecture accept the same composition; limit guards: unchanged secrets, spend, stop, uniqueness and durability checkpoints. No added mechanism or autonomous-completion claim.
80/20: One narrowly scoped evidence repair addresses the sole must-fix; no broadened behavioral review or full-suite run. Targeted native tests provide both successful installation and refusal/stop evidence; the Studio pipeline owns full-suite and post-test contract checks.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
