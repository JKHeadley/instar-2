# Change review — w4-native repair round 6: self-host conformance re-declared for the freshly compiled composition

Subject base: d0efb70b303a8cd1c12657cf040379b5822ad359
Review state: open
Reviewed content: none
Outcome: Review round 6 (Astra, VERDICT NO), plan row #414, one must-fix, fixed at its source. The round-5 declaration named conformance digest `sha256:9e26a87b…0644`, computed over stale local compiled output; after a fresh `tsc -p tsconfig.build.json` the self-host composition (whose closure includes compiled files such as `dist/assembly/process-inventory.js`) hashes to `sha256:485039a1…3ef3`, and `check-architecture.mjs` failed R105 ("conformance is not for the current composition bytes"). Fix: compiled this head first, re-declared the digest in src/assembly/harness.declarations.json, re-ran the native harness contract (tests/preview/native-harness-contract.test.ts, 9/9, including "native composition honours the harness contract through doorway claude-code-subscription") against that composition, then rebuilt again and confirmed `check-architecture.mjs` passes. No product code changed; register replayed.
Affected rules: 105 (conformance re-declared only after re-running its contract on the exact composition bytes), 115 (exact-composition evidence for the self-hosting tuple), 74 (this record), 101 (plain commits), 116 (smallest fix: one digest line, no new checker); Purpose revision 12: no ability reduced.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes the conformance evidence a self-hosting harness tuple is admitted on.
Side effects: register replayed at 52c0c590.
Undo and recovery: revert these commits and this record.
Multi-machine posture: machine-local, deliberately: the declaration is per build composition.
Layer below: scripts/check-architecture.mjs R105 composition-digest closure over tests/preview/self-host.mjs, scripts/slice-ts-loader.mjs, deploy/macos/fixed-worker/worker.sb and the compiled dist closure; createSelfHostHarness describe(). Verified: fresh tsc build, native-harness-contract 9/9, check-architecture passed after a second fresh build, lint passes, register check passes.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: declare-after-fresh-build | the digest is computed from a freshly compiled tree, because a stale dist produced the round-5 mismatch | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-native-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (8 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/harness.declarations.json

## Closing block

simplestRobustRoute: the required outcome is a conformance declaration that matches the composition this head builds; re-declaring the digest after a fresh build and re-running the existing contract delivers it with no new mechanism.
80/20: 0 must-fix.
VERDICT: author submission; the independent verdict is recorded as a pass
