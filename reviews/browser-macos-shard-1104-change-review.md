# Change review — list the connector test on macOS shard

Subject base: 4d6d67efc1fa11aef547a5066df212edf611c337
Review state: frozen
Reviewed content: sha256:538900062a746c59895689ad0c0f4da96b12232fd2c79c4d7e26247a53acab0a
Outcome: Add the worker connector test to the checked-in macOS-only list because it uses the macOS worker account and sudo.
Affected rules: 37, 74, 102
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: This changes only the test shard list, so the test still runs on the host that can execute it.
Side effects: Linux and Windows shards skip this macOS-only test; the macOS shard includes it.
Undo and recovery: Restore the list entry only if the test becomes portable; keep this head out of release until the exact full gate passes.
Multi-machine posture: Mama and Laptop cannot run the sudo worker-account test; Studio and M5 macOS hosts can.
Layer below: The full gate failed its macOS-only list check on 4d6d67ef; the focused list and connector tests pass with this entry.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no prompt change.

Decision: MACOS-SHARD-1104-1 | Keep the native worker-account check on the macOS shard and record the platform distinction. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/SEAM-LEDGER.md

## Closing block

simplestRobustRoute: Add one checked-in list entry.
80/20: Focused macOS list and connector tests passed; the exact-head full suite still must pass.
VERDICT: author submission; this record asserts no independent verdict.
