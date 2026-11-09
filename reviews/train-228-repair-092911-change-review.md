# Change review — train-228-repair-092911

Subject base: b28c4bc116bbe45ea0447713cd5f22a63dac7f27
Review state: open
Reviewed content: none
Outcome: Merge current main 4e99924ea03080e1c62e4c8fc845c7f6b794129a (Rule 39, Improvement Requires Evidence and Visibility) and then main 7912b0d079c41675c069de2752a74aaddbb753ac (its review record bound to a subject base) into train-228, keeping train-228's Rule 72 wording and both changelog histories; derive the combined replay anchor from the merged bytes and regenerate publication.
Affected rules: 37, 39, 49, 69, 72, 74, 90, 91, 101, 102, 111, 112, 113, 116, 119
Affected floors: secrets — unchanged, no secret handled or printed; spend cap — unchanged, no runtime code touched; stop — unchanged; no duplicate sends — unchanged, nothing sends; durable intake — unchanged, no intake code touched
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merged constitutional text and its generated register binding require exact source and history verification.
Side effects: The replay register carries both the main Rule 39 wording and the train-228 Rule 72 wording. train-228's revision 22 (Rule 72) stays byte-identical; main's Rule 39 entry is appended above it as revision 23 with its date, cause, wording and reference unchanged, so main's published numbering for that entry differs (22 on main, 23 here). No runtime source, model prompt, output parser, accept/escalate/refuse logic or capability is authored or narrowed.
Undo and recovery: Revert the two repair commits before landing if rejected and regenerate from retained source; no live state or installation is modified.
Multi-machine posture: Source and publication travel through git; validation is machine-local deliberately. Runtime ownership and replication are unchanged.
Layer below: 1.x comparison inherited from the train-176 repair (reviews/train-176-pipeline-repair-change-review.md): JKHeadley/instar src/core/CapabilityMapper.ts loadBuiltinManifestFrom, src/core/GitStateManager.ts and docs/specs/manifest-gitignore-end-conflict-loop.eli16.md; rechecked in the local 1.x clone at f3f94826ae7c0ae6203c2651698c02b95b89ccfa (git history dbb7b3b80/5129779c3/a29957130 on GitStateManager.ts). The source-derived publication approach is reused; 1.x has no constitution-anchor merge to carry over. ONEX-LESSONS.md is absent from that clone and was not read. Inspected build-register.mjs anchor checks (hash(anchor) == approvedConversion, anchor.documents == corpus(docs)), canonical hashing in dist/index.js, the bootstrap anchor and both parents' histories.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/conversion.json:1 | not-a-deferral=Generated constitutional text retains existing obligations; no new deferred repair work.
Deferral: generated/register.json:1 | not-a-deferral=Generated constitutional text retains existing obligations; no new deferred repair work.

Subject (13 paths): docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs

Decision: train-228-repair-092911-changelog | Keep train-228's revision 22 (Rule 72) byte-identical and append main's Rule 39 entry above it as revision 23, because Rule 90 (check-change-review) refuses rewriting an earlier version of this branch's history; a first attempt that renumbered train-228's entry instead was refused by that check and replaced in ef534b571. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-228-repair-092911-build-report.md
Decision: train-228-repair-092911-main-record | Merge main 7912b0d0 rather than repair main's Rule 39 review record here: main 4e99924e itself failed the change-review check (missing Subject base) and 7912b0d0 is its owning repair (one cause, one repair). A local trial binding that record to aa8cbc934 pulled all train-228 commits into its subject and was discarded unpushed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-228-repair-092911-build-report.md
Decision: train-228-repair-092911-anchor | Derive the anchor from merged bytes with the register's own canonical hash: Rule 39 declaration hash from main, Rule 72 from train-228 (each side changed only its own rule), rules-document hash and approvedConversion recomputed; no pin typed by hand. Replay accepted the result. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-228-repair-092911-build-report.md

Publication evidence: Replayed ef534b571cbd9c73acd594c98f1893ba9076e7a9 with 307 entries, 122 rules and 34 terms; generation sha256:37e9e6be89be6621e6b036790961775424faa068de5fb0d7a6346a557c0163ac; `--check` true on the final head (the later main merge changes only a review record). Desk rehash and repin tools changed no owner-reference or grounding-inventory pins. Build, TypeScript, lint and register:check passed on node 24.14.1.

## Report recovery — 2026-11-09

The Studio received the original report as `train-228-repair-092911-PROGRESS.md`, while the three decisions above cite `train-228-repair-092911-build-report.md`. Restore the original bytes at that cited lanes path (SHA-256 `81bbd6356c04c557f67a330e4a9aac1ed91e4b7d3daba9b122709a7c5a07f695`); retain the source and its historical verification limits. This paperwork repair changes no product code, constitutional wording, checks or pins. Its scope is ordinary; the critical classification above still describes the original merge.

1.x comparison for this recovery: inspected JKHeadley/instar main `eaf43103f7580efc029c761297bd7b33cf86adf4`, `src/core/DecisionJournal.ts`, `docs/specs/decision-journal-principle-required.eli16.md`, `docs/specs/full-decision-visibility-enactment.eli16.md`, and history `ab26b7ca36c1375d855f08c9a6a66e84e2b656e2`. The journal preserves readable decision reasons and evidence; it does not repair 2.0 absolute report locators. ONEX-LESSONS.md sections 5 and 6 reinforce artifact-location and actual-reader verification. Reuse the existing `scripts/change-review.mjs` Rule 102 consumer and the genuine report; no runtime transplant or new mechanism is needed.

Decision: train-228-report-recovery | Restore the original report at its declared Studio path, preserving its bytes and decision IDs, rather than changing the citations or weakening the checker. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-228-repair-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: an ordinary merge, a changelog splice that keeps both histories, the register's own hash functions for the anchor, register replay, and the existing desk rehash/repin tools. No new runtime machinery.
80/20: Run TypeScript, lint, register checks and the READY-gate pinned-text and constitution-context test files in the foreground with one worker; leave the full suite to the Studio pipeline as directed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
