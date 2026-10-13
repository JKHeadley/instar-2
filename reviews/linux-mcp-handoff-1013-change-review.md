# Change review — Linux MCP descriptor handoff

Subject base: 876eddb9f3215b68faf6844b508e298c7b714531
Review state: open
Reviewed content: none
Outcome: The installed harness reads MCP configuration once through /dev/fd/4 on Linux without ENXIO or credential disclosure.
Affected rules: 1, 13, 26, 34, 37, 49, 60, 70, 74, 101, 102, 111, 113, 116.
Affected floors: secrets — descriptor bytes only, no configuration in argv, environment or disk files; spend cap — provider admission unchanged; stop — pipe writer stays in the owned harness process group; no duplicate sends — no effect retry changed; durable intake — header and prompt forwarding unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Linux-only physical descriptor compatibility repair; no prompt, model output parser, policy, grant or provider protocol change.
Side effects: Linux MCP handoff uses one bounded cat writer to bridge Node's socket-pair descriptor into a real anonymous pipe. Bash execs the pinned harness in place and ignores environment startup code; shell-added variables are removed unless explicitly supplied. The helper has no login descriptor. macOS and commands without MCP configuration keep their original spawn path. Existing process bounds and launcher teardown hold the helper.
Undo and recovery: Revert this commit. No durable schema or stored secret changes; the runner's existing launcher installation copies the updated script to existing harness users.
Multi-machine posture: Machine-local Linux descriptor mechanics deliberately; macOS handoff is unchanged. No cross-machine ownership, delivery, credential custody or authority changes.
Layer below: Read the full constitution and inspected the real Node socket handoff, Linux /dev/fd reopening failure, the CLI's existing path argument, the launcher's header validation, direct login descriptor, prompt remainder, process-group ownership and teardown. The actual installed-copy launcher now passes the original harness-user handoff case and new no-login/login variants with second-read EOF and malformed neighbors.
Bug class: integration
Bug evidence: reproducer=tests/preview/harness-mcp-pipe.test.ts
Hook bypass: none; no hook override or bypass flag used.
Convergence: none
Prompt review: No model-facing behavior or model-output parsing change. Synthetic secret-shaped fixtures exercise real OS pipes and the actual copied launcher; no live credentials or real logins used.
Decision: linux-mcp-anonymous-pipe | Bridge only Linux MCP descriptor 4 through a real anonymous pipe, preserving the existing argument, one-use delivery, direct descriptor-3 login and stdin remainder; keep macOS unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/linux-limit-launcher-1013-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: the existing one-use descriptor is retained, with a tiny local stream bridge because Linux cannot reopen Node's socket as a file path. A disk file or inline argument would weaken secret custody. Start guards remain installed executable validation and the bounded handoff header; end guards remain EOF and owned teardown; resource limits and stop remain inherited. Real launcher tests prove successful byte delivery and refused malformed neighbors. This is author evidence for the desk's independent landing review.
80/20: Repair the descriptor cause separately from the resource-limit cause. The original handoff regression passes; the untouched different-device fixture failure is reported as host-dependent, not hidden or weakened.
VERDICT: author submission; no independent verdict asserted
