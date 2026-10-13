# Change review — portable MCP descriptor handoff

Subject base: 8200f79c9be241182ad4a73e949833061bf29cdc
Review state: open
Reviewed content: none
Outcome: Supply a real anonymous pipe for MCP configuration on macOS as well as Linux, so opening the configuration path again yields EOF instead of a socket permission error.
Affected rules: Purpose least revelation and constraints 2/3; Rules 1, 26, 37, 44, 49, 70, 74, 101, 102, 111, 112, 113, 116.
Affected floors: secrets remain one-use descriptor bytes, absent from argv, environment and disk; spend cap, stop, no duplicate sends and durable intake retain their existing paths.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Reuse an existing bounded transport bridge across platforms; no new policy, model-facing instruction or authority.
Side effects: macOS MCP launches now use the same Bash exec and bounded cat writer as Linux. Bash environment additions are removed unless explicitly supplied. Login descriptor 3 stays with the harness and is closed in the writer. No-MCP launches remain direct. The existing process ownership and teardown paths still apply. Native macOS behavior requires the Studio gate.
Undo and recovery: Revert this repair and refresh the installed launcher using existing installation readiness; preserve all prior evidence and never replay uncertain effects.
Multi-machine posture: Deliberately machine-local descriptor transport, identical mechanism on macOS and Linux; no shared state, ownership or replication changes.
Layer below: Read the purpose and rules in full, the supplied Studio failure, launcher readHeader/spawn/teardown, the descriptor consumer test and installLauncher content-digest refresh. Node socket descriptors are not the promised anonymous pipe; the existing Linux bridge supplies that pipe without credentials on disk.
Bug class: integration
Bug evidence: reproducer=tests/preview/harness-mcp-pipe.test.ts
Hook bypass: none; core.hooksPath unset and the common hooks directory contains only sample hooks.
Convergence: none
Prompt review: No prompts, model parsing, accept/escalate/refuse judgment or delivered reply content change. This is descriptor transport; recorded model-output replay is not applicable.
Decision: train-22-repair-pipe | Use the existing anonymous-pipe bridge whenever MCP is present, removing only the Linux condition; socket reopen behavior must not choose the secret transport. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-22-repair-164217-PROGRESS.md
Decision: train-22-repair-evidence | Exercise native and Darwin platform selection with real descriptors, assert FIFO type, exact first read and empty second read, preserve secret and malformed-header assertions; native macOS remains a Studio check. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-22-repair-164217-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: reuse the existing pipe bridge, removing one platform condition instead of adding a second transport or credential file. Start guards remain executable custody and bounded header validation; the end-state checks are exact bytes followed by EOF; existing stop and process ownership remain limit guards. The repair claims tested transport behavior, not unattended live acceptance.
80/20: Target the failing file and its direct launcher consumer, then typecheck and the required cheap checks; no full suite or base worktree.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
