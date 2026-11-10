# Change review — Rule 72 Studio gate finish

Subject base: bf894399df5d0b7b056bf8fe92e51606336a43ec
Review state: open
Correction: This finish preserved a flawed remote-tip scope algorithm. The PR199 independent review reproduced an earlier feature commit hidden by an unmerged remote tip; rule72-to-main-fix-1109-change-review.md replaces that algorithm with the target merge-base. Historical timings below do not establish correct scope.
Outcome: Complete PR 199's macOS evidence: renew the native composition certificate through the existing digest tool and replay dependent publication. Keep the native journal contract inside its recorded activation window using the existing advancing-clock fixture pattern, port the accepted four-build register test budget, and replace the new per-remote ancestry subprocess loop with Git’s equivalent bulk ref query.
Affected rules: 26, 34, 37, 49, 70, 72, 74, 90, 91, 95, 101, 102, 105, 111, 112, 113, 115, 116, 119.
Affected floors: Secrets custody, spend cap, stop, no duplicate sends and durable intake retain their existing checks. Production activation expiry is unchanged.
Operator questions: none; no rule wording changes in this finish. Final head approval remains with Justin; no merge or deployment.
Suggested tier: critical
Declared tier: critical
Tier rationale: Native certificate evidence changes, while the bulk query preserves the old successful-read selection, including its subsequently discovered scope bug.
Side effects: The native declaration certifies the measured macOS composition. Register publication follows that source. Only the journal test child's clock is injected; elapsed time still advances. Change scope keeps the same remote reachability predicate, now evaluated by one Git command; the bulk query fails closed on read errors, whereas the old inner ancestry catch could mistake an error for a negative result. All native and register assertions remain intact; the register fixture receives its already-measured execution budget from the live line.
Undo and recovery: Revert the fixture repair if necessary; restore a certificate only with its matching composition and regenerate publication. A stale certificate cannot certify new bytes.
Multi-machine posture: The certificate is deliberately specific to Darwin and its exact Node runtime. The deterministic Rule 72 implementation retains its existing git-derived behavior across machines.
Layer below: scripts/composition-digest.mjs compositionClosure/compositionDigest/currentRuntime; scripts/check-architecture.mjs parityMatrix; tests/preview/native-harness-contract.test.ts; the established proofs-launcher advancing-clock fixture; desk digest writer and register replay; Git for-each-ref --no-contains versus merge-base --is-ancestor.
Bug class: unit
Bug evidence: reproducer=tests/preview/native-harness-contract.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks, inspected on the Studio.
Convergence: none
Deferral: tests/rulegraph/graph.test.ts:70 | not-a-deferral=Fixture assertions for the existing deferred-part deadline; no implementation work is deferred.
Deferral: tests/rulegraph/graph.test.ts:65 | not-a-deferral=Fixture assertions for the existing deferred-part deadline; no implementation work is deferred.
Deferral: tests/rulegraph/graph.test.ts:63 | not-a-deferral=Fixture assertions for the existing deferred-part deadline; no implementation work is deferred.
Deferral: tests/rulegraph/graph.test.ts:61 | not-a-deferral=Fixture assertions for the existing deferred-part deadline; no implementation work is deferred.
Decision: R72-NATIVE-CLOCK | Replay the recorded journal activation within its valid window using the proofs-launcher clock pattern; preserve production expiry and every assertion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule72-to-main-finish-1109-PROGRESS.md
Decision: R72-NATIVE-TOOL | This branch has the nine-case contract, so use the existing digest writer between recorded contract runs rather than the newer ten-case renewal wrapper; require all nine cases to pass. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule72-to-main-finish-1109-PROGRESS.md
Decision: R72-COUNTERPART | Add the required PR-body declaration for this 2.0-only build-scope port; retain the cross-book difference for independent Rule 119 review. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule72-to-main-finish-1109-PROGRESS.md

Decision: R72-REGISTER-BUDGET | Reuse only the four-build CLI test budget repair and measured-cause comment from 5092714bc24301a0a7914ac42753257223b82e3f, retained in live 2f7a76ad. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule72-to-main-finish-1109-PROGRESS.md

Decision: R72-REF-QUERY | Replace the branch-owned per-ref ancestry process loop with the equivalent single Git query; preserve scope and fail-closed behavior and prove both with real Git fixtures. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule72-to-main-finish-1109-PROGRESS.md

## Inherited 1.x comparison

Rechecked actual JKHeadley/instar main f433576c5d0874c9ba64928858252ffaa45e23f2: src/core/FeatureMaturationPlanGate.mjs, src/monitoring/DarkFlagMaturationRegistry.ts, docs/specs/feature-maturation-discipline.md, and history 7df9eeea63 / 17c81eaae6 (the original brief also inspected 8871005a1). Deadline visibility and reviewed promotion are reused through the approved 2.0 port c7603b400 / 338eb8674. These 1.x components do not implement 2.0 build ownership or composition-bound native certification. A src/ and docs/specs/ search for native conformance/composition certificates found no applicable implementation. ONEX-LESSONS sections 3 and 6 require complete delivery and production-wiring evidence with bounded concurrency. The 1.x Maturation Path explicitly blocks graduation, not work; this version-specific build mechanism needs no new shared obligation or paired amendment. The original record names the wording difference; semantic adequacy remains independent review work.

A fresh remote-main check at 17:25 PST found 55e3010b0245a2a1b94e2ced738a7f19ab051bd5. Fetched and searched that revision; the three named source/spec paths and standards article are byte-identical to f433576c5. History and fit are unchanged. For the scope-query repair, 1.x src/core/SafeGitExecutor.ts and docs/specs/safe-git-read-surface-hardening.md recognize --no-contains as a read query, but do not implement the 2.0 scope algorithm.

## Evidence and scope

The original handoff is preserved. Studio proofs-launcher: 7/7 passed, including every WSL failure. Native baseline: 7/9 passed; the journal child refused an expired recorded activation and the other failure was the stale certificate. With the advancing fixture clock: 8/9 passed, only the certificate mismatch. The existing digest writer derived the certificate from 246 composition files. After the derived pin, all 9/9 native cases passed (46.00s); current-clock replay produced 273 entries, 122 rules and 10 attention items. Final local gate results are retained in the Studio progress report and its adjacent evidence directory. No model prompt, output parser or model decision changes; captured doorway frames remain the original fixtures.

The 20-file Studio run passed 207 tests with 41 existing skips; its sole failure was the four-build register CLI case exceeding 30 seconds. Reuse the exact 120-second fixture budget and three-line cause comment already accepted in 5092714bc24301a0a7914ac42753257223b82e3f and live 2f7a76ad. Direct single register checks here took 26.9 and 37.1 seconds; production deadlines and every positive/negative assertion remain unchanged. The failed batch and subsequent 120-second timeout remain in the evidence directory. Measurement identified the branch-owned cause: 1,147 per-ref ancestry processes consumed 21.204 seconds per build. Git’s bulk query returned the identical 1,147 refs in 0.252 seconds. Three real-Git fixtures prove base/pushed/descendant behavior, explicit boundaries plus dirty paths, and unreadable-boundary refusal. After the bulk-query repair, the unchanged CLI positive/reproduction/corruption assertions passed in 16.605 seconds (17.74-second run). Typecheck and the three new scope tests passed. No load generator was run.

The rule document remains byte-identical to 2f7a76ad, blob aca97ca45b6c39aba4d5e9da46c19ac24241c6b2. No governing wording, published numbering, pipeline or train branch changes.

simplestRobustRoute: Reuse the existing native contract, fixture-clock pattern, digest writer and register replay. The historical bulk predicate removed per-ref subprocess cost but did not fix the boundary; the repair now uses the target merge-base. No new authority or subsystem.
80/20: One small fixture repair plus mechanical certification/publication; targeted serial tests and required fast checks, with the pipeline owning the full suite.
VERDICT: author submission; no independent approval asserted
