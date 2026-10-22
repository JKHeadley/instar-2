# Change review — native Darwin conformance for cold replay

Subject base: 053aff717fc2274fc90f29a14959be3464fb6a52
Review state: open
Reviewed content: none
Outcome: Renew the native Darwin composition certificate through the desk's real contract workflow, so the cold-replay change passes lint and register verification.
Affected rules: 26, 34, 37, 42, 49, 70, 74, 101, 102, 107, 111, 112, 113, 115, 116; architecture R105.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake keep their existing enforcement; the native contract exercises owner admission, charging, stop, confinement and restart behavior in isolated fixtures.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Renewing a supported native harness certificate requires evidence on the exact declared runtime and composition, even though executable behavior is unchanged.
Side effects: The declaration and replay publication bind the measured composition. No supported status is downgraded and no checker is weakened.
Undo and recovery: Revert together with the matching composition and regenerate publication. An older certificate cannot certify changed bytes. The desk renewal tool restores the original declaration if the after-contract fails.
Multi-machine posture: Shared declaration certifies only the exact Darwin runtime exercised on the Studio; it adds no claim for another platform or doorway.
Layer below: Read compositionClosure/compositionDigest/currentRuntime, the ten native contract cases, pipeline/merge-live-conformance.mjs --renew and the desk renewal publication workflow. Only captured doorway frames are substituted; actual owner ports and confined tool launches run in disposable roots.
Bug class: none
Bug evidence: Evidence maintenance; before/after contract reports and command output retained in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1022-evidence/native-renewal.
Hook bypass: none
Convergence: none
Decision: cold-native-renewal | On the desk's explicit repair request, execute its guarded renewal workflow on the Studio, then replay publication; never replace the digest without the required native contract result. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1022-PROGRESS.md

Evidence: The guarded renewal completed successfully on Darwin with node 24.14.1: before 9/10 with only the stale certificate assertion failed; after 10/10 passed. It re-declared only the conformance digest to sha256:a4f06f147aa860b0ae2c92cb748057a9cd6bd7cb2260ba3a83199b26864fdf31, covering 272 composition files. JSON reports are retained at the Bug evidence path.

Publication: Seven replay register outputs regenerated from source a4be9fa76132258fc50f4eb8742b9b5eb9d52dff, generation sha256:2bcd923daa35404ffc5aa17c52a1f65b126365a7e03d98d19ba311ee32123fe9. The owner-manifest rehash tool found zero stale pins. Architecture checks pass without exceptions.

simplestRobustRoute: Reuse the desk's existing native contract and repository digest functions, followed by register replay. The before run may fail only the stale-certificate assertion; all ten cases must pass after renewal. No new mechanism or certificate bypass.
80/20: Targeted ten-case native proof before and after, then architecture, lint, register and required pinned tests on the pushed head; the pipeline owns the full suite.
VERDICT: author submission; independent desk acceptance pending
