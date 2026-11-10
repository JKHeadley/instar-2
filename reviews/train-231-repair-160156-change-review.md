# Change review — train-231-repair-160156

Subject base: c62fad8ba4b62126f8d6e4716130572b108f2ed8
Review state: open
Reviewed content: none
Outcome: Merge live 2f7a76adc (train-228: Linux transport, Rule 39 and main 7912b0d0) into train-231, resolving the refused register-source/bootstrap-anchor.json conflict. Restore the approved Rule 72 deadline sentence that train-231's main merge 27464913f dropped. Keep train-231's own text and both changelog histories, and replay the register publication from the merged bytes.
Affected rules: 37, 72, 90, 91, 101, 102, 105, 116, 119
Affected floors: secrets — unchanged, no secret handled or printed; spend cap — unchanged, no runtime code authored; stop — unchanged; no duplicate sends — unchanged, nothing sends; durable intake — unchanged, no intake code authored
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merged constitutional text and its generated register binding require exact source and history verification.
Side effects: docs/01-the-rules.md now carries live's Rule 72 check sentence ("A deadline that has passed fails only builds that change the feature it belongs to, and puts an item in front of the operator; every other build keeps moving."), approved by Justin, topic 102965, message 140776. Both changelogs already record that sentence. train-231's merge 27464913f had taken main's older row, so the document and its changelog disagreed. docs/01-the-rules.changelog.json takes live's bytes, which differ from train-231's only in ’/— escapes versus literal characters; the parsed entries are identical. The only runtime-adjacent file is scripts/production-boot-io.mjs, and it arrives unchanged from live. This repair authors no model prompt, parser, accept/escalate/refuse logic or capability, and narrows none.
Undo and recovery: Before landing, revert the merge commit and the replay commit and regenerate from the retained source. No live state or installation is modified.
Multi-machine posture: Source and publication travel through git, and validation runs on each machine by design. The native darwin conformance certificate can only be renewed on the Studio, so this repair leaves R105-REPIN-NEEDED for the desk.
Layer below: The 1.x comparison is inherited from the train-176 repair through train-228-repair-092911 (reviews/train-176-pipeline-repair-change-review.md, reviews/train-228-repair-092911-change-review.md). That comparison covers JKHeadley/instar src/core/CapabilityMapper.ts loadBuiltinManifestFrom, src/core/GitStateManager.ts and docs/specs/manifest-gitignore-end-conflict-loop.eli16.md. Its source-derived publication approach is reused here. 1.x has no constitution-anchor merge to carry over. ONEX-LESSONS.md was not available on this machine and was not read. Inspected for this repair: the build-register.mjs anchor checks (hash(anchor) == approvedConversion, anchor.documents == corpus(docs)), the history of docs/01-the-rules.md on both parents (c7603b400 is an ancestor of both, and 27464913f dropped its sentence), and tests/preview/self-host-harness.mjs selfHostCompositionEvidence.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/conversion.json:1 | not-a-deferral=Generated constitutional text retains existing obligations; no new deferred repair work.
Deferral: generated/register.json:1 | not-a-deferral=Generated constitutional text retains existing obligations; no new deferred repair work.

Subject (16 paths): docs/01-the-rules.changelog.json, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, scripts/production-boot-io.mjs, src/assembly/harness.declarations.json, tests/preview/preview.test.ts, tests/preview/telegram-transport-resources.test.ts

Decision: train-231-repair-160156-rule72 | Take live's docs/01-the-rules.md: the approved Rule 72 sentence (c7603b400, an ancestor of both parents) was dropped by train-231's main merge 27464913f while both changelogs kept its entry, and train-231 changes no other text in that file. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-231-repair-160156-build-report.md
Decision: train-231-repair-160156-anchor | Take live's bootstrap anchor and its approvedConversion literal. The merged docs/ corpus now matches live's, so live's anchor is exactly the one derived from the merged bytes. Replay at 6506af11f accepted it with no hand-typed pin, and the desk repin was not needed (register wiring clean). | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-231-repair-160156-build-report.md
Decision: train-231-repair-160156-r105 | Take live's native conformance pin in src/assembly/harness.declarations.json. Neither side's certificate matches the merged composition, and this M5 Pro (node 26.0.0 / 24.15.0, no _instarharness user) cannot run the darwin contract. The certificate is left stale as R105-REPIN-NEEDED for the Studio, and no declaration was changed to hide it. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-231-repair-160156-build-report.md

Publication evidence: Replayed 6506af11f45e767119a392f43aed43cf7ac582a8 with 307 entries, 122 rules and 34 terms; generation sha256:224d851271cb75cbfbf56e4e3c19b9d3233d99f49bd84487cd48cddfa49dc393. `register:check` returns true. check-register-wiring reports no issues. check-architecture's only finding is R105, the native self-host certificate (runtime and composition). TypeScript passes.

## Closing block

simplestRobustRoute: This repair is an ordinary merge that takes live's side for the four pin and wording conflicts, which come from one cause, followed by the register's own replay. It adds no new machinery.
80/20: I ran TypeScript, lint, register:check, the change-review check and the two test files that read the touched declarations, all in the foreground with one worker. The full suite and the R105 re-pin are left to the Studio pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
