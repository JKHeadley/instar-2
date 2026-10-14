# Change review — train-31 pipeline repair

Subject base: d0ffe15239bc754497f2a0558fbe050a2bd4fa05
Review state: open
Reviewed content: none
Outcome: Deliver one-use MCP configuration through a reopenable descriptor on macOS and Linux, and test native certification against the shipped declaration.
Affected rules: 26, 30, 34, 37, 49, 70, 74, 101, 102, 105, 111, 112, 113, 116.
Affected floors: secrets — MCP and login bytes remain anonymous one-use descriptors, absent from argv and environment; spend cap — no model dispatch or accounting changes; stop — existing launcher tracking and teardown remain; no duplicate sends — no send path changes; durable intake — no journal changes.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes the macOS MCP descriptor transport through the existing launcher; retains the existing bounded pipe bridge and all admission checks.
Side effects: macOS MCP launches now use the existing Bash anonymous-pipe bridge used by Linux. The bridge execs the installed harness in place, removes shell-added environment entries unless explicitly supplied, and keeps its writer in the launch group. Launches without MCP retain the direct path. Canonicalizing the test temporary directory lets the test reach the existing exact installed-path admission on macOS. The native test accepts an explicitly unproven declaration only with a reason, no certificate and the composition evidence's unsupported state and absent certificate; a supported declaration still requires the exact certificate and runtime.
Undo and recovery: Revert this repair commit before deployment; no persisted schema or journal state changes. Reverting the descriptor change restores the reproduced EOF reopen failure. Preserve historical evidence and desk-owned certification declarations.
Multi-machine posture: Descriptor transport is machine-local on every host; Linux keeps its existing route, macOS uses the same route. No cross-machine ownership, replication, grants or send fences change.
Layer below: Read the launcher's installed-executable admission, handoff header validation, descriptor writes, shell bridge and teardown. Reproduced both macOS EOF reopening failures before changing the bridge. Read selfHostCompositionEvidence, the adapter's conformance selection, current unproven declaration and train-31's recorded parity decision; leave declarations untouched.
Bug class: integration
Bug evidence: reproducer=tests/preview/harness-mcp-pipe.test.ts
Hook bypass: none; core.hooksPath unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No model prompt, response parsing or accept/escalate/refuse model judgment changes. This repairs OS descriptor delivery and test expectations; no live model replay or native certification is claimed.
Decision: train-31-repair-pipe | Reuse the existing anonymous MCP pipe bridge on macOS too: Node socket EOF reopening fails there. Test MCP present/absent crossed with login present/absent, exact bytes, EOF, prompt continuation and non-disclosure. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-31-repair-100346-PROGRESS.md
Decision: train-31-repair-path | Resolve the test temporary directory to its canonical path so macOS /var aliases do not fail installed-executable admission before exercising the descriptor. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-31-repair-100346-PROGRESS.md
Decision: train-31-repair-parity | Follow train-31's existing unproven composition declaration in the native test, retaining exact checks for a supported declaration. Do not manufacture a certificate or change the declaration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-31-repair-100346-PROGRESS.md

simplestRobustRoute: Reuse the already shipped pipe bridge, remove its platform restriction, and correct two test assumptions. This is the simplest robust route; it adds no new mechanism. Installed-path admission and validated bounded handoff remain start guards, EOF and existing process cleanup end the handoff, and existing resource/stop limits remain. This is targeted offline process evidence, not an unattended live-agent acceptance claim.
80/20: Run the changed tests and the direct launcher consumer, typecheck and cheap gates; no full suite or transitive import closure.
VERDICT: author submission; independent review belongs to the desk
