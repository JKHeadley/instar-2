# Change review — Refresh native self-host conformance evidence

Subject base: e44d3ce1985cc2e47620541d55ab03ae0bba8f8b
Review state: open
Reviewed content: none
Outcome: Cover the original reviewed prompt correction, e4bc35e4, whose required in-tree review record was missing, and repair the review's sole must-fix: the supported preview-self-host-native / claude-code-subscription / darwin / self-hosting declaration now certifies the current composition, sha256:599d9216a8f108e41d208e5d98de670c8eff5eada89e23fcfb051c20b6e042f7, after its declared native contract passed on the declared runtime. Replay the register to include this evidence and the original unit's changed provider source pins. Capability remains supported.
Affected rules: 26/105/115 (fresh evidence for exact composition and runtime); 30/84/103 (preserve both providers' capability guidance); 37/70 (reproduce and verify the stale-evidence repair); 49/74/111 (scope, side effects, recovery and foundation recorded); 101 (no hook bypass); 112/113 (preserved history and explicit machine posture); 116 (existing contract and generators, no new machinery).
Affected floors: secrets — custody and disclosure unchanged; spend cap — existing admission and metering unchanged; stop — existing latch preserved and exercised by the contract; no duplicate sends — dispatch and uniqueness unchanged; durable intake — existing journal and admission unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: The original unit removes only obsolete prompt prose from both providers and updates historical comparisons without changing captures or checkpoint behavior. This repair adds only fresh conformance evidence and deterministic generated output; it makes no further model-facing change.
Side effects: The original unit stops telling either provider that outward sends are outside a one-machine closed set; existing standing grants and effect-doorway checks still decide admission. The native adapter can again report supported conformance for its actual bytes. Generated capability and register views now reference the new certificate and current provider source versions. No capability is disabled and no checker is weakened.
Undo and recovery: The original prompt commit can be reverted separately, restoring its obsolete restriction. For this repair, revert the certificate commit and replay the register for the desired source revision. Restoring the old certificate alone makes the current composition fail R105 again; certify any replacement composition through the same contract. No stored-state migration is needed.
Multi-machine posture: Evidence is specific to the declared native macOS runtime. No ownership, replication, durability demand, peer dependency, or shared state changes. Other harness/platform tuples keep their existing declarations.
Layer below: Inspected scripts/composition-digest.mjs (complete static import closure, runtime and executable digest), scripts/check-architecture.mjs (R105 comparison), tests/preview/self-host-harness.mjs (runtime admission of certificate), and tests/preview/native-harness-contract.test.ts. On Darwin, the exact named native contract passed before re-declaration (1 selected test); all 10 tests in its file passed afterward, including real confined package tests/install/probe, owner admission, stop, refusal/timeout, journal restart and fake-delay deadline checks. Runtime exactly matches node-24.14.1@sha256:91d3afb67a7dc211f642f2328f822505ff1c1ad381e98ffdd21b003970deeeda. Independent recomputation through the existing digest functions found a complete 268-file closure and the review's expected digest. Architecture failed only R105 before and passed after. Typecheck and build passed. The delegated owner rehash and repin chain reported zero changed pins; register replay repaired the stale provider source wiring.
Bug class: none
Bug evidence: none — evidence refresh for the existing contract; no behavioral bug or new reproducer.
Hook bypass: none
Convergence: none
Prompt review: No additional model-facing change in this repair. Inspected the original seven-file diff: only the obsolete 70-character closed-set sentence is removed from both tool-turn prompts; standing-grant, effect-doorway, refusal and resource guidance remains. Five tests update exact historical-prompt comparisons or measured lengths and retain captures. The supplied independent review reports 40/40 changed-file tests and 30/30 Codex/tools-policy tests passed, and inspected the 2026-10-11 input and four old/new recorded outputs in strong-agent-1020-evidence/replay/: old outputs cite the closed-set restriction, new outputs do not, all four refuse the unavailable public-post request. That is evidence of wording correction, not successful authorized dispatch. Those are prior reviewer results, not new runs by this repair. The native contract uses recorded provider-frame shapes with shipped native owners, confinement and real installed code; it is not a new live-model or public-dispatch claim.
Prompt finding: 0abb3dc96311 | quoted-evidence | The act-first capture retains the existing reminder-admission review instruction; no new phrase-based admission decision.
Prompt finding: 0d4664ea9de7 | quoted-evidence | The self-description test compares standing-trust guidance byte-for-byte after removing only the obsolete closed-set sentence.
Prompt finding: 14d7eeccc218 | quoted-evidence | The self-description fixture preserves public-read and grant guidance as historical prompt evidence.
Prompt finding: 42faf877ba82 | quoted-evidence | The act-first capture preserves the existing Codex identity framing, not a decision trigger.
Prompt finding: 450c79237a95 | quoted-evidence | The unchanged memory-disagreement instruction is compared with an existing journal-people fixture; this unit does not alter it.
Prompt finding: 45e37ea2e9e9 | quoted-evidence | The fixture comparison retains the surrounding public-read and grant guidance rather than replacing admission checks.
Prompt finding: 4b98dc2a1b9f | quoted-evidence | The capability fixture records the delivered full-tool-set briefing; it is evidence of awareness.
Prompt finding: 5b486d8bd247 | quoted-evidence | The captured reply-review format instruction is retained as recorded prompt evidence.
Prompt finding: 5fa1a20c4031 | quoted-evidence | The existing quoted-literal review instruction is preserved in the historical capture; no review policy changes.
Prompt finding: 7c45ffbe90ad | quoted-evidence | The act-first capture retains the existing recorded-loop guidance verbatim; no scheduler or admission changes.
Prompt finding: 95e349aaf4ac | quoted-evidence | The fixture checks delivered doorway and standing-grant guidance against its recorded briefing.
Prompt finding: 9781075d458e | quoted-evidence | The self-description comparison preserves the instruction to report real doorway refusals; no refusal criterion changes.
Prompt finding: aef7d91bef51 | quoted-evidence | The existing per-rule verdict format is part of captured reply-review evidence.
Prompt finding: b1bb3946362d | quoted-evidence | The act-first capture preserves the existing Claude identity framing, not a decision trigger.
Prompt finding: b288d6ef1604 | quoted-evidence | The captured review response bounds remain unchanged; no new resource limit is introduced.
Prompt finding: e769ca9dd959 | quoted-evidence | The existing pass/violation response vocabulary is preserved as captured review evidence.
Prompt finding: f6d7f3274c85 | quoted-evidence | The historical capture retains the existing recorded-limit instruction; no new limit is added.
Prompt finding: feadb66b8ad1 | quoted-evidence | The captured secret-protection instruction remains unchanged; the repair alters no secret handling.
Deferral: generated/register.json:1 | not-a-deferral=deterministically replayed register output containing existing descriptions, not a new commitment

Subject (15 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/harness.declarations.json, src/assembly/production-codex-provider.ts, src/assembly/production-provider.ts, tests/assembly/production-provider-tools.test.ts, tests/preview/act-first.test.ts, tests/preview/default-context-floor.test.ts, tests/preview/literal-copy.test.ts, tests/preview/selfdesc-abilities.test.ts

## Closing block

simplestRobustRoute: The original unit deletes the obsolete sentence at its source in both providers and updates only affected evidence. For this repair, run the existing native conformance contract on its declared runtime, recompute and refresh only its certificate, then replay existing register output. This is that route. Start guard: exact runtime and complete closure; end guard: native contract and architecture accept the same composition; limit guards: unchanged secrets, spend, stop, uniqueness and durability checkpoints. No added mechanism or autonomous-completion claim.
80/20: One narrowly scoped evidence repair addresses the sole must-fix; no broadened behavioral review or full-suite run. Targeted native tests provide both successful installation and refusal/stop evidence; the Studio pipeline owns full-suite and post-test contract checks.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
