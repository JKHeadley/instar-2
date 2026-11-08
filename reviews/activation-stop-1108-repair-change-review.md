# Change review — activation-stop-1108 repair: renewed native conformance

Subject base: 3769865eab526f324f6bef2482c40e1634429d39
Review state: open
Reviewed content: none
Outcome: repairs the unit review's one must-fix. The unit's edits to src/assembly/production-provider.ts, src/assembly/production-codex-provider.ts and tests/preview/stall-coverage.ts sit in the certified closure of preview-self-host-native x claude-code-subscription x darwin, so the declared conformance digest (sha256:3139c2ad...) no longer matched the composition and check-architecture reported R105. tests/preview/native-harness-contract.test.ts was run on the Studio (Darwin arm64, node 24.14.1): every contract case passed, including "native composition honours the harness contract through doorway claude-code-subscription", and its declaration check measured sha256:278259cbff277c1c1e6826eca36bb8835fc08bc3fe17545d438aaac2c7c7b240. The declaration now names that digest; the contract passes 10/10 and check-architecture exits 0. The owner reference pins and the generated register are re-derived mechanically by the desk scripts.
Affected rules: 26, 105, 115, 113, 37, 101, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. Only a certificate value, mechanical pins and generated register output change.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: one certificate value renewed from a passing contract run, plus mechanical pin and register regeneration. No runtime code, prompt, store, send path or authority changes. src/assembly is in the subject only for the declaration value.
Side effects: none at runtime. The certificate now matches the composition the native contract was run on.
Undo and recovery: revert the repair commits; the R105 finding returns.
Multi-machine posture: machine-local. The certificate is Darwin- and runtime-exact (node-24.14.1), with no new cross-machine authority.
Layer below: tests/preview/self-host-harness.mjs selfHostCompositionEvidence and tests/preview/native-harness-contract.test.ts produce and check the certificate; scripts/check-architecture.mjs R105 compares it to the composition bytes. All unchanged.
Bug class: unit
Bug evidence: reproducer=tests/preview/native-harness-contract.test.ts
Hook bypass: none
Convergence: none
Decision: activation-renew-from-contract | renew only the conformance value, after the named native contract case passed on the final composition, and confirm with the full 10/10 contract; supported claim, runtime, entries and evidence reference are unchanged, so no hash-only substitution | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/activation-stop-1108-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=generated register output replayed from committed source, not prose authored by this change
Prompt review: no prompt, model call, model-output parser or model decision changes.

1.x comparison: inherited from the unit record (reviews/activation-stop-1108-change-review.md; JKHeadley/instar 948d48d0a02accf7969f744db0d7e6b065f5caa0). 1.x has no native harness conformance certificate (a 2.0 Rule 105/115 construct), so the renewal has no 1.x counterpart.

Verification: Studio, Darwin arm64, node 24.14.1, single worker, nice 10, after npm run build. Before renewal: native-harness-contract 9 passed, 1 failed (only "reports the declared certification state", expected sha256:278259cb... received sha256:3139c2ad...); the named case "native composition honours the harness contract through doorway claude-code-subscription" passed. After renewal: 10/10 passed. node scripts/check-architecture.mjs exit 0; npm run lint exit 0; npm run register:check exit 0.

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/part-nine.json, register-source/owner-references/preview.json, src/assembly/harness.declarations.json

## Closing block

simplestRobustRoute: renew the existing certificate from the existing contract run; no new checker, gate or capability restriction.
80/20: the one must-fix is repaired with passing contract evidence. No remainder.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
