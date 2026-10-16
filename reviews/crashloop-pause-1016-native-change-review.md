# Change review — renew crash-loop branch native conformance

Subject base: 7b6e76d558a01152d34422e692af19321f21f12d
Review state: open
Reviewed content: none
Outcome: The native Darwin self-host certificate now binds the current composition after its actual declared contract passed, so the branch can pass architecture and register gates.
Affected rules: 26, 34, 37, 49, 70, 74, 90, 101, 102, 105, 111, 112, 113, 115, 116.
Affected floors: secrets — confined custody unchanged; spend cap — contract preserves charged attempts without retry; stop — contract verifies provider and launch refusal; no duplicate sends — journal restart contract retains one delivered reply; durable intake — existing journal and admission paths unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: exact native conformance evidence and generated register publication, with no executable behavior or authority change.
Side effects: the supported preview-self-host-native / claude-code-subscription / darwin / self-hosting tuple now certifies the measured 267-file composition and the unchanged Node 24.14.1 executable. No ability or supported tuple was removed or narrowed. The declaration itself is excluded from the composition it certifies by the existing digest implementation.
Undo and recovery: restore a declaration only with its matching composition and regenerate publication. A different composition requires its own successful native contract; restoring a stale certificate alone cannot repair the gate.
Multi-machine posture: shared declaration certifies only this exact Darwin composition and runtime; no broader host or doorway claim.
Layer below: inspected compositionClosure/compositionDigest/currentRuntime and selfHostCompositionEvidence, the declared native contract and the architecture parity consumer. Verified complete closure and identical digest before and after the successful behavioral contract. Confined installation, owner admission and accounting, stop, refusal, timeout, journal restart and readiness/deadline cases ran through shipped code with captured provider frames.
Bug class: none
Bug evidence: evidence renewal; measured closure and before/after contract results are retained in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/crashloop-pause-1016-native-before.json, crashloop-pause-1016-native-certificate.json, crashloop-pause-1016-native-contract-before.json and crashloop-pause-1016-native-contract-after.json in that same directory.
Hook bypass: none; core.hooksPath unset, inspected common hooks directory contains sample files only; ordinary commits.
Convergence: none
Decision: crashloop-native-renewal | Run the declared native contract on Darwin, renew only for its unchanged measured composition after behavioral success, and regenerate the existing publication. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/crashloop-pause-1016-repair-PROGRESS.md

Register publication: mechanically replayed from committed native declaration 09ba3a225bd68a6d1e42cded06b44f55f29ad47e. Desk rehash and grounding-chain helpers each refreshed zero pins.

simplestRobustRoute: this is the simplest robust route: existing native contract, existing closure/digest functions, exact evidence renewal and register replay. Complete closure and exact runtime guard entry; successful behavioral assertions before renewal and all ten assertions afterward guard the end state. Existing stop, caps, confinement and admission checkpoints retain their floors. No new mechanism or live-provider claim.
80/20: before renewal, 9/10 native cases passed with only the stale certificate assertion failing; after renewal, 10/10 passed. Typecheck, build and architecture passed. The full suite remains with the pipeline; final lint, register and change-review checks validate publication.
VERDICT: author submission; no independent convergence or live acceptance asserted
