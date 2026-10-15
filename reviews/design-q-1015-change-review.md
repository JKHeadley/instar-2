# Change review — keep Mac agent directories outside TCC folders

Subject base: dcf3a5160cb92ede56f70f8b1048f27b2d6e5ef5
Review state: open
Reviewed content: none
Outcome: Setup and boot refuse Mac agent roots, workspaces and state under Documents, Desktop, Downloads or iCloud Drive (Library/Mobile Documents), including symlink targets. Linux behavior is unchanged. The separate cross-topic awareness question is answered in the desk report without changing its behavior.
Affected rules: Rules 1, 4, 26, 44, 49, 70, 74, 93, 101, 103, 105, 111, 113, 115, 116; purpose coherence, durable intake and evidence constraints.
Affected floors: Secrets — new public diagnostic contains only fixed folder labels; other startup diagnostics remain suppressed. Spend cap, stop, no duplicate sends and durable intake — existing enforcement is unchanged. Status and stop remain accessible on a misplaced journal root; install/run refuse before writes. No state is deleted or migrated.
Operator questions: none; Justin's global avoid-Documents direction and the desk's four-folder scope are explicit in design-q-1015-brief.txt (2026-10-15).
Suggested tier: significant
Declared tier: significant
Tier rationale: A deterministic physical startup restriction, with actual setup and boot command tests. No model prompt, output parser, meaning judgment, invocation policy or authority change.
Side effects: Existing misplaced Mac installations cannot restart until their owner moves their preserved state to an allowed location. New setup refuses before creating its root or onboarding state. Symlinks are resolved through the nearest existing ancestor; broken links and cycles remain errors. Comparisons fold case conservatively on Mac and preserve path-segment boundaries. Session home/configuration/inbox and independent volume mounts also receive the guard. Linux returns before filesystem access. Filesystem replacement after the check remains subject to the existing custody and symlink protections; this is not a new adversarial filesystem confinement guarantee.
Undo and recovery: Revert this change to restore earlier placement behavior. No schema, durable record or policy migration exists. Preserve an existing root's complete state when relocating it; never recreate authority or repeat uncertain effects. The desk owns live relocation. Its READY rejection explicitly requests native conformance recertification on this Studio worktree.
Multi-machine posture: Deliberately machine-local validation on each host's actual home and filesystem; no new store, replication, owner or transport. Linux peers retain their existing paths. Current stop, spend and uniqueness authorities are unchanged.
Layer below: Traced realpath/lstat/mkdir behavior for absent suffixes, symbolic links, cycles and segment boundaries. Checked onboarding's first write, production host import order, journal launcher startup/error suppression, physical storage/session directory creation and scratch/session mount boundaries. The actual production CLI tests refuse before a nonexistent host can load; temporary-root journal launches refuse before credentials or network. Shared node_modules was not changed.
Bug class: none
Bug evidence: New operator-directed installation constraint, reproduced against the actual setup, fixed production boot and journal boot commands, with real temporary filesystem paths; tests/preview/agent-paths.test.ts.
Hook bypass: none; core.hooksPath is unset and the inspected common hooks directory contains only .sample files.
Convergence: none
Prompt review: No prompt, parser or model decision changed. Invocation policies must remain tools sha256:5fed4bcfd823d950c1444a008a9c11d40824671dd8e68aa2f5908ed8534a2926 and conversation sha256:3598cc7514f4be6ffec52f1d321e1596cd2db420a67fd7958281f3862dd9ce8c.
Decision: design-q-path-boundary | One shared physical helper called before setup/boot/storage/session/workspace mutation; no ambient IO added under src/. Preserve status/stop access and fail without changing user input. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/design-q-1015-PROGRESS.md
Decision: design-q-awareness | Report the action-backed request coverage, missing tool-effect projection and in-flight snapshot gap with citations; do not implement Q1 changes, as instructed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/design-q-1015-PROGRESS.md

Decision: design-q-alternate-entries | Reuse the guard at standing-trust initial setup, earlier preview run, independent conversation-owner state and conversation-authority startup, which could otherwise write before the existing guarded storage port. Preserve revise/tighten/revoke and stop. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/design-q-1015-PROGRESS.md
Skip: tests/preview/agent-paths.test.ts:54 | scope=Permission-denial proof requires a non-root identity; root can traverse mode-000 directories.
Skip: tests/preview/agent-paths.test.ts:71 | scope=Actual macOS command wiring; platform-independent helper and Linux no-op are tested without this skip.
Skip: tests/preview/agent-paths.test.ts:78 | scope=Actual macOS misplaced-root emergency-stop command; no TCC guard exists on Linux.
Skip: tests/preview/agent-paths.test.ts:85 | scope=Actual macOS install and boot refusal; Linux no-op has its own positive test.
Skip: tests/preview/agent-paths.test.ts:104 | scope=Actual macOS physical storage/session/volume boundaries; Linux has no TCC restriction.

Evidence: Build and typecheck pass. The actual entry tests pass 25/25, including independent workspace/state paths, symlinked and missing directories, Linux and emergency stop on an existing misplaced root. Canonical policy measurements match both required digests. Final pushed-head targeted/pinned checks and the desk-requested native certificate/register repair are recorded in the absolute desk PROGRESS file.

Decision: design-q-native-renewal | After the desk rejected stale R105 evidence, execute its existing native contract before/after renewal on the declared Darwin runtime and regenerate the register from the committed source. Preserve all contract assertions, supported posture and evidence references. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/design-q-1015-PROGRESS.md

Evidence: Desk renewal helper --renew passed on the declared Darwin/node runtime: before 9/10 (only stale certificate), after 10/10. Complete 265-file composition sha256:32de2a508c367095d0ac3900149a233c914d44e589c33a5fcb9dbfe853ddba45. Evidence is in the absolute desk design-q-1015-native/{before,after}.{json,log}; no contract assertions or supported state changed.

simplestRobustRoute: This is the simplest robust route: one small real-path guard reused at the existing physical boundaries. Lexical checks alone miss aliases; a boot-only check misses first-install writes; a root-only check misses separately located session state and workspace mounts. These are the named failures each use prevents. No watcher, new store, policy digest, runtime model call or new core port. Start guard is the resolved allowed location; end evidence is actual isolated command refusal and accepted normal setup, with all five existing floors retained. No autonomous capability or live-user acceptance claim is made.
80/20: Targeted foreground filesystem and command tests, architecture/lint/register checks, pinned READY checks and author diff review. The native macOS conformance certificate is byte-bound to the changed physical composition; the desk explicitly requested this Studio renewal and source-pin regeneration after rejecting the earlier exception.
VERDICT: author submission; independent review pending
