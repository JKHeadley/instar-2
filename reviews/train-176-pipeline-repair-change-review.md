# Change review — train-176-pipeline-repair

Subject base: 3244bf867e52ceae57a327723b90c190ea14fd78
Review state: open
Reviewed content: none
Outcome: Merge current main c20b68d1d9b5744a72c243c4dc8a4b69114179d6 into train-176, retaining helper failure handling and approved Rule 121 with both histories; regenerate publication from merged source.
Affected rules: 26, 37, 49, 69, 74, 90, 91, 101, 102, 111, 112, 113, 116, 119, 121
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing runtime enforcement; this repair changes only publication and merges approved constitutional text.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merged constitutional text and its generated register binding require exact source and history verification.
Side effects: The replay register includes Rule 121 and the candidate shape. No runtime source, model prompt, output parser, accept/escalate/refuse logic or capability is authored or narrowed by this repair.
Undo and recovery: Revert this repair before landing if rejected and regenerate from the retained source; no live state or installation is modified.
Multi-machine posture: Source and publication travel through git; validation is machine-local deliberately. Runtime ownership and replication are unchanged.
Layer below: Searched actual JKHeadley/instar main ab256f684cda141db19abe8bba5300b980e1025b src/ and docs/specs/, read src/core/CapabilityMapper.ts loadBuiltinManifestFrom, src/core/GitStateManager.ts, docs/specs/manifest-gitignore-end-conflict-loop.eli16.md and git history ab26b7ca3/dbb7b3b80/5129779c3/a29957130. Reuse the source-derived publication approach; untracking the 1.x manifest does not fit the versioned 2.0 register. No matching constitution-anchor implementation found in those searches. Read ONEX-LESSONS section 6 maintenance/testing. Original helper comparison at f5fe54444544f83a477dec909f990c848866ed3b remains in reviews/train-176-change-review.md. Inspected canonical hashing, bootstrap anchor, replay builder and both parent histories.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/conversion.json:1 | not-a-deferral=Generated constitutional text retains existing obligations; no new deferred repair work.
Deferral: generated/register.json:1 | not-a-deferral=Generated constitutional text retains existing obligations; no new deferred repair work.

Subject (14 paths): docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, tests/e2e/register.test.ts

Decision: train-176-repair-merge | Preserve both parents and all changelog versions; derive the combined conversion hash with the existing tool, then replay publication. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-repair-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: an ordinary merge, the existing train-11-rederive-anchor and desk rehash/repin tools, and register replay. No new runtime machinery. Start guard: clean candidate and fetched main; end guard: exact merged publication and cheap checks; limit guard: foreground one-worker targeted tests, no full suite or live mutation. No autonomous live completion claim.
80/20: Run TypeScript, the changed register lifecycle test and four mandatory constitution context tests; leave the full-suite run to the Studio pipeline as explicitly directed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
