# Change review — train-230-repair-161815

Subject base: de6cd6a4d0115915c20ab86a087efdf7c878d0da
Review state: open
Reviewed content: none
Outcome: Merge the newly live build 2f7a76adc (train-228: Linux transport resources, preview backoff timing, Rule 39 and Rule 72 publication) into train-230, keeping train-230's recovery work and both changelog histories; take the live build's replay anchor and conversion pin, which match the merged constitution bytes, restore Rule 72's approved wording that train-230's earlier main merge had dropped, and replay the register publication.
Affected rules: 37, 39, 72, 90, 101, 102, 105, 116
Affected floors: secrets — unchanged, no secret handled or printed; spend cap — unchanged, merged runtime code only comes from the already-reviewed live build; stop — unchanged; no duplicate sends — unchanged, nothing new sends; durable intake — unchanged, no intake code authored
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The merge changes constitutional text (restores Rule 72 wording) and its generated register binding, which need exact source and history verification.
Side effects: The branch now carries the live build's reviewed Linux transport resource helpers (scripts/production-boot-io.mjs, src/assembly/harness.declarations.json, tests/preview/preview.test.ts, tests/preview/telegram-transport-resources.test.ts) and its review records. docs/01-the-rules.md and docs/01-the-rules.changelog.json are now byte-identical to the live build: Rule 39 (main) and Rule 72 (approved by Justin, topic 102965, message 140776) both present; the changelog keeps every earlier entry (revisions 22 and 23 unchanged; the JSON now uses the live build's string escaping) and gains revision 24, which records the restored Rule 72 sentence with no new wording. No train-230 recovery change is reverted. No capability is removed or narrowed.
Undo and recovery: Revert the merge and replay commits before landing if rejected and regenerate from retained source; no live state or installation is modified.
Multi-machine posture: Source and publication travel through git; validation is machine-local deliberately. Runtime ownership and replication are unchanged.
Layer below: 1.x comparison inherited from the train-228 merge repair (reviews/train-228-repair-092911-change-review.md), which inherits the train-176 repair: JKHeadley/instar src/core/CapabilityMapper.ts loadBuiltinManifestFrom, src/core/GitStateManager.ts and docs/specs/manifest-gitignore-end-conflict-loop.eli16.md at f3f94826ae7c0ae6203c2651698c02b95b89ccfa. The source-derived publication approach is reused; 1.x has no constitution-anchor merge to carry over. Inspected here: build-register.mjs anchor checks (hash(anchor) == approvedConversion, anchor.documents == corpus(docs)), canonical hashing from dist/index.js, both merge bases (7912b0d07 and 0bde1fda5) and the history of docs/01-the-rules.md on both parents.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/conversion.json:1 | not-a-deferral=Generated constitutional text retains existing obligations; no new deferred repair work.
Deferral: generated/register.json:1 | not-a-deferral=Generated constitutional text retains existing obligations; no new deferred repair work.

Subject (17 paths): docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, scripts/production-boot-io.mjs, src/assembly/harness.declarations.json, tests/preview/preview.test.ts, tests/preview/telegram-transport-resources.test.ts

Decision: train-230-repair-161815-rule72 | Take the live build's docs/01-the-rules.md: train-230's merge a79f17e4c of main 7912b0d0 had replaced the file with main's bytes and dropped Rule 72's approved "a passed deadline fails only builds that change its feature" sentence (present on merge base 0bde1fda5 and in changelog revision 22 on both sides); git's recursive merge kept that loss, so it is restored explicitly. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-230-repair-161815-build-report.md
Decision: train-230-repair-161815-anchor | Resolve the bootstrap-anchor and approvedConversion conflict with the live build's values, after checking them against the merged tree with the register's own canonical hash (0 of 5 document hashes stale; hash(anchor) equals approvedConversion); no pin typed by hand, and replay accepted the result. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-230-repair-161815-build-report.md
Decision: train-230-repair-161815-changelog | Append revision 24 to docs/01-the-rules.changelog.json recording the restored Rule 72 sentence (cause: the existing approval, message 140776), because Rule 90 requires a new version for any governed body change relative to this branch's head; earlier entries stay byte-equal in content and no wording is new. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-230-repair-161815-build-report.md

Publication evidence: Replayed 479cb6279c0971b51ec8b4cbe8aaefccf7653b4c (generation sha256:e42c5417b52508347a7e1bfc2e62ce01e3b4c390e4fdc16da60302b673ddc30c) and, after the changelog entry, c4d3c65ce6be50a958258068f9c4f5cf55dd963e with 307 entries, 122 rules and 34 terms; generation sha256:19e71b2752b633a8d02bdc2df6ad5370a7dff41286b44bc508ebee1ee2fe43b6. The bootstrap anchor does not cover the changelog, so its pins are unchanged. The desk rehash and repin tools changed no owner-reference or grounding-inventory pins. Checks ran on node 24.14.1, the runtime the native self-host certificate names.

Report restoration: The Studio lacked the cited build-report.md, although lanes/train-230-repair-161815-PROGRESS.md already contained the complete report and all three decisions above. Publish that existing report byte-for-byte at the cited absolute path; SHA-256 7fb545aeaabc21ccc015d6d3df4a1be530b775bfd09b8b9bd0feca4d8cbababa. Its M5 results remain historical evidence, not fresh Studio results. Current repair checks and provenance are in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-230-repair-PROGRESS.md. This paperwork repair changes no runtime, constitution, test or validator bytes; recovery removes the copied report and reverts this annotation if the source is disproved.

Report repair 1.x comparison: Searched actual JKHeadley/instar origin/main f433576c5d0874c9ba64928858252ffaa45e23f2 src/, docs/specs/ and git history; inspected src/core/StageTransitionValidator.ts (missing report refuses), src/core/WorkingSetManifest.ts (journal and interactive artifact candidates), docs/specs/CONVERGING-AUDIT-DEFAULT.md, docs/specs/intelligent-working-set-lazy-sync.md and path history ab26b7ca36 / dbb7b3b80c; read ONEX-LESSONS.md sections 5 and 6. Reuse the evidence-backed gate and artifact-availability discipline. These runtime transfer mechanisms do not own this 2.0 desk-report path, so no code transplant is warranted. The existing report and Rule 102 validator are the simplest robust route.

## Closing block

simplestRobustRoute: This is the simplest robust route: an ordinary merge, the live build's already-valid anchor and pin verified with the register's own hash, restoring the dropped approved sentence from the live build, register replay, and the existing desk tools. No new machinery.
80/20: Run TypeScript, lint, register checks and the merged preview test files in the foreground with one worker; leave the full suite to the Studio pipeline as directed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
