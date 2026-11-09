# Change review — train-228-repair-092911

Subject base: b28c4bc116bbe45ea0447713cd5f22a63dac7f27
Review state: open
Reviewed content: none
Outcome: Merge current main 4e99924ea03080e1c62e4c8fc845c7f6b794129a (Rule 39, Improvement Requires Evidence and Visibility) into train-228, keeping train-228's Rule 72 wording and both changelog histories; derive the combined replay anchor from the merged bytes and regenerate publication.
Affected rules: 37, 39, 49, 69, 72, 74, 90, 91, 101, 102, 111, 112, 113, 116, 119
Affected floors: secrets — unchanged, no secret handled or printed; spend cap — unchanged, no runtime code touched; stop — unchanged; no duplicate sends — unchanged, nothing sends; durable intake — unchanged, no intake code touched
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merged constitutional text and its generated register binding require exact source and history verification.
Side effects: The replay register carries both the main Rule 39 wording and the train-228 Rule 72 wording. The train-228 changelog entry moves from revision 22 to revision 23 because main landed its own revision 22 first; its date, cause, wording and reference are unchanged. No runtime source, model prompt, output parser, accept/escalate/refuse logic or capability is authored or narrowed.
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

Decision: train-228-repair-092911-changelog | Keep main's landed Rule 39 entry as revision 22 byte-for-byte and renumber train-228's unlanded Rule 72 entry to revision 23, because main's revision is already published and newest-first order must stay monotonic. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-228-repair-092911-build-report.md
Decision: train-228-repair-092911-anchor | Derive the anchor from merged bytes with the register's own canonical hash: Rule 39 declaration hash from main, Rule 72 from train-228 (each side changed only its own rule), rules-document hash and approvedConversion recomputed; no pin typed by hand. Replay accepted the result. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-228-repair-092911-build-report.md

Publication evidence: Replayed merge 44978fe32c40325c70036dab2274c3a66d965fc5 with 307 entries, 122 rules and 34 terms; generation sha256:a52b5985fd24131b3b82e38cf992e52373e923e714a77fae20ed65bafb376f24; `--check` true. Desk rehash and repin tools changed no owner-reference or grounding-inventory pins. Build, TypeScript, lint and register:check passed on node 24.14.1.

## Closing block

simplestRobustRoute: This is the simplest robust route: an ordinary merge, a changelog splice that keeps both histories, the register's own hash functions for the anchor, register replay, and the existing desk rehash/repin tools. No new runtime machinery.
80/20: Run TypeScript, lint, register checks and the READY-gate pinned-text and constitution-context test files in the foreground with one worker; leave the full suite to the Studio pipeline as directed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
