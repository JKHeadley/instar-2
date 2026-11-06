# Change review — train-180 live merge repair

Subject base: fc6c4ed31c34b15a70e6e01ab843be9bea071770
Review state: open
Reviewed content: none
Outcome: Merge live add5d75879174874e15bf1552ae37c82e00c6358 into train-180 preserving both histories, newer bounded model evidence and captured-notice controls alongside async child tests.
Affected rules: 4, 14, 26, 34, 36, 37, 49, 56, 70, 74, 86, 90, 91, 95, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement; no floor or agent ability is narrowed by conflict resolution.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Integration of existing reviewed histories, with conflict resolution confined to tests and evidence declarations; no new runtime mechanism.
Side effects: Incoming dashboard and resource-owner changes remain intact. Test readers retain captured activation controls and accept the incoming credential notice form; async child handling avoids blocking the test worker. Keep candidate provider timestamps backed by its newer evidence. Derived publication can change source pins; retain incoming native conformance from 9ba065757, whose recorded Studio contract passed 10/10 for the exact merged composition sha256:20556b44f00de49c7b3d806d410796d941f478001607eaf8bbae037ea747006e. This is inherited certification, not a new WSL contract run.
Undo and recovery: Revert the merge with its first parent and replay the register using existing generators; retain both parents and all failure evidence. No live installation is changed here.
Multi-machine posture: Source and reviews travel through Git. WSL runs portable checks; native macOS conformance and full-suite qualification belong to Studio. Studio files are read-only and the report is handed off from local state.
Layer below: Read main purpose and rule book, both parents of all three semantic conflicts, source provider evidence, captured-notice regression controls, async-child runner and inherited reviews; inspected existing register and owner-hash consumers. 1.x comparison below.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-agent.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Prompt review: No new model-facing parser, prompt, acceptance or refusal change. Inherited model behavior remains unchanged by this repair. Recorded activation notice shapes from train-173 gate 9cf2e24c are preserved in both tests, including rejecting substituted renewal actions and unrelated additions; no new live journal claim.
Decision: train180-merge-both | Merge the named live head without replacing either history; keep async child improvements and both captured-notice tests. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-180-repair-065904-PROGRESS.md
Decision: train180-newer-evidence | Keep candidate provider verification and subsidy timestamps, which are newer than incoming evidence; do not fabricate fresh observations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-180-repair-065904-PROGRESS.md
Decision: train180-derived-publication | Recompute owner pins and replay the committed register through existing tools; retain the incoming native certificate already proven for the identical composition, without renewing it on WSL. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-180-repair-065904-PROGRESS.md

1.x comparison: Inherit train-180-repair-0101 captured-shape and train-180-repair-130006 actual-byte hashing comparisons. Independently fetched JKHeadley/instar main d1de939e575e9489970af8e287274a07d0ff7207 and searched src/, docs/specs/ and history. Inspected src/core/CapabilityMapper.ts hashContent, src/monitoring/MissingLoginSessionDetector.ts, docs/specs/scrape-fixture-realness.md, docs/specs/CAPABILITY-MAP-SPEC.md; history ff8344b4b and 2aaac4288. Reuse captured-byte regression and hash derivation discipline; those sources do not implement 2.0 governed merge/register publication, so retain its existing mechanisms. Fresh authenticated ONEX-LESSONS sections 4 and 6 (download succeeded on bounded retry attempt 5) reinforce captured bytes and evidence matching actual workflow.

Validation: Build and initial typecheck passed. Both captured activation notice controls and two refusal-state controls passed. The remaining 20 launcher cases refused before assertions with the WSL harness-identity/P-08 prerequisite absent; targeted.log retains all failures for Studio qualification. No full suite was run. Owner rehash refreshed one preview pin; chain repin changed zero. Register replay uses 7ef26d69b438cf94a1299ee1fc02554717e92baa, generation sha256:fb196b4362566659aebb29f480f497d25454f88a227070c27940d54bc3e5bc76.

Deferral: generated/register.json:1 | not-a-deferral=Generated existing governing wording, not new deferred work.

simplestRobustRoute: This is the simplest robust route: merge existing histories, resolve only semantic conflicts, retain real captured controls and derive pins through existing tools. Entry is the assigned base and live commit, exit is a pushed repair with scoped checks and honest Studio handoff; no new machinery or unattended-live success is claimed.
80/20: Run the two conflicted test files and cheap integrity checks, preserving host-dependent failure evidence for the Studio gate rather than running a broad WSL suite.
VERDICT: author submission; no independent convergence claimed
