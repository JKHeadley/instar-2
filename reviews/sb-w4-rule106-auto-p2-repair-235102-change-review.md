# Change review — keep historical compatibility modules outside sampled sources

Subject base: ae2b5848d6149f993101491a07d965069aeb8abb
Review state: open
Reviewed content: none
Outcome: Remove a test-to-proof race: renewal and restart compatibility tests placed temporary historical TypeScript modules inside src/ and tests/, which the grounding evidence sampler hashes concurrently. Materialize those modules in their existing temporary storage and resolve static import/export specifiers to the original dependencies. Keep implementation bytes outside those specifiers, original behavioral assertions, source pins and the checker unchanged.
Affected rules: 26 (verify actual source bytes), 34 and 70 (real historical modules and both digest neighbors), 37 (source repair without quarantine), 49 and 74 (scope, side effects and rollback), 101 (plain git, no bypass), 102 (decisions reported), 107 and 108 (separate observed digest mismatch from inferred originating scratch file), 112 (preserve history), 113 (machine-local test state), 116 (relocate scratch rather than relax the proof checker)
Affected floors: secrets — no credential or runtime change; spend cap — no provider calls added; stop — production stop behavior untouched; no duplicate sends — existing restart effect fences still tested; durable intake — historical journal replay remains tested unchanged
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Test fixture placement and a small test-only import relocator; no shipped runtime, prompt, policy, model output parsing or acceptance decision changes. Independent review of the source-placement repair remains with the desk.
Side effects: Historical modules import current dependencies by absolute path instead of sibling-relative path; regression verifies the same dependency object identity and unchanged ordinary text. The helper handles static import/export declarations used by these known modules. Temporary files now live outside the sampled checkout and are cleaned by the callers. Full gate JSON cannot be downloaded through the Studio file API because it exceeds its 1 MiB limit; no reconstructed or spoofed report substitutes for it.
Undo and recovery: Revert this commit normally. No product state or schema migration. Reverting reintroduces the temporary-source sampling race, so the known defect record remains relevant.
Multi-machine posture: Deliberately machine-local test scratch on the host running Vitest. Every host benefits from an unchanged source tree while sampling; no peer, ownership or production-state changes.
Layer below: productionGroundingSourceDigest and checkProductionGroundingAssemblyEvidence in scripts/check-assembly-contracts.mjs; per-worker production-grounding-evidence.mjs; actual Studio ae2b5848 gate log and assertion ledger; historical provider sources at 0a61aaf8 and 08220af9 and journal sources at 08220af9 and 7d824d64; TypeScript parser source ranges and Vitest module identity resolution.
Bug class: integration
Bug evidence: reproducer=tests/preview/historical-module.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model-facing changes. Existing historical source comes from exact git commits, not a synthetic provider answer. Summary/Jev/reply-review replay requirements do not apply to test-file placement; no such model path is claimed repaired.
Decision: rule106repair-scratch | Move all four sibling historical modules in the two affected test files to temporary directories; parse only static import/export specifiers to preserve their original dependency identity. Keep source sampling and assertion requirements intact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule106-auto-p2-repair-235102-PROGRESS.md
Decision: rule106repair-evidence | Use the saved gate log and real assertion ledger to diagnose the digest mismatch, and deterministic sampler overlap to prove the race. Report the 413 full-report access failure and host-bound review references honestly; do not fabricate full-gate evidence or mutate Studio configuration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule106-auto-p2-repair-235102-PROGRESS.md

Subject (5 paths): tests/preview/historical-module.ts, tests/preview/historical-module.test.ts, tests/preview/renew-activation.test.ts, tests/preview/restart-handoff-program.test.ts, docs/defects/grounding-digest-historical-scratch.md

## Closing block

simplestRobustRoute: This is the simplest robust route: put test-owned historical scratch outside the actual source tree using one shared static-specifier relocator. It prevents another worker sampling temporary source without excluding any real source, weakening pins, serializing the fleet, or adding retries. Start guard: the named branch and known historical commits. End guards: targeted compatibility/digest tests and unchanged V93/V94 evidence, typecheck, architecture/register checks, clean diff and pushed-commit evidence. Limits: one foreground worker, no full suite, no Studio writes, 90-minute ceiling. No new autonomous completion capability is claimed.
80/20: Repair the concrete scratch-file race and the same occurrence in the adjacent restart fixture. Keep all original assertions and the checker. Full gate confirmation belongs to the pipeline; the source repair is not represented as a recovered successful historical run.
VERDICT: author submission; no independent verdict asserted
