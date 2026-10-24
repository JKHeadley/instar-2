# Change review — Make the default browser connector usable

Subject base: 4ab4ea8c1685330f6285c4f054585dcee3d4f7a2
Review state: open
Reviewed content: none
Outcome: the default MCP server finds the installation's node/npx directory even when the harness starts with a minimal PATH, and ordinary browser reads reach the existing read admission path.
Affected rules: 1, 26, 34, 44, 49, 62, 70, 74, 84, 100, 101, 102, 103, 113, 116
Affected floors: secrets — custody references and one-use launch handoff retained; spend cap and stop — the existing per-call checkpoint retained; no duplicate sends and durable intake — effect ownership and durable cause unchanged. Click, type, fill, upload and evaluate still meet effect admission.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: repair two measured integration defects through existing launch preparation, installer migration and admission classification; no new policy or engine.
Side effects: regenerate existing register source pins from the committed repair; no declarations or authority changed. Bare MCP commands gain the installation Node directory and runner PATH unless the server explicitly sets PATH. Absolute/path commands remain unchanged. The installer adds reads only to an absent or byte-equivalent default server definition; customised definitions and existing reads remain. Tab listing is input-sensitive in both admission consumers.
Undo and recovery: revert this unit's source changes and restore the updater's backed-up mcp.json if rolling back the read list. Existing credentials and operator server definitions remain untouched. A failed launch stays a failed launch.
Multi-machine posture: installation-local configuration and launch environment; each machine supplies its own Node directory on every launch. No machine path is persisted into root configuration or copied to a peer.
Layer below: read 1.x ensurePlaywrightMcp in cross-topic-onex-reference/src/commands/setup.ts (615–670), and inspected prepareMcpLaunch, prepareSessionConnectors, readRootMcp, installMcp, release migration registration, admitToolCall and admitToolCallEffect. Shared launch preparation covers tool turns and continuing sessions; both read decisions still respect installed effect policy.
Bug class: integration
Bug evidence: reproducer=tests/preview/mcp-setup.test.ts
Hook bypass: none
Convergence: none
Decision: mcp-connect-p2-path | repair the shared launch environment for bare commands, preserving explicit server PATH and avoiding persisted machine-specific executable paths | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/mcp-connect-1024-p2-PROGRESS.md
Decision: mcp-connect-p2-reads | reuse the existing read list for browser reads, distinguish tabs list from mutations at both admission consumers, and register a fresh migration id for already-migrated roots | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/mcp-connect-1024-p2-PROGRESS.md
Decision: mcp-connect-p2-proof | replay captured proof-room failure and recorded model/reply shapes locally; leave the new live proof-room conversation to the desk as explicitly assigned | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/mcp-connect-1024-p2-PROGRESS.md
Decision: mcp-connect-p2-register | regenerate source pins from the committed repair; owner and inventory rehashes changed zero declarations or pins | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/mcp-connect-1024-p2-PROGRESS.md
Prompt review: no prompt or model parser changes. Admission changes replay summary writer 715672480, uncertain summary 715672483, Jev undecided 715672482, Jev unsure 969389570, reply-review 969389923, reply 715672479 and empty candidate 715672550 from retrospective-duty-followup-train-1-2026-10-08.json through the new read set. Captured tools-m2 update 840343944 identifies the real launch failure. This is boundary evidence, not a successful live browser conversation or delivered empty bubble.
ELI16: The browser launcher was looking in the wrong folders for npx. It now gets the installation's tool folder. Opening a page and reading it are treated as reads; actions that change a page or account still go through the existing checks. Old installations get the same read list on update.
simplestRobustRoute: this is the simplest route: use existing launch environment preparation, existing read classification and the existing migration registry. Only the tabs action predicate is new because a whole-tool read entry would also admit closing/creating tabs without effect review. Start guards are validated configuration and owned launch; end-state evidence is actual child execution plus read/effect admission results; limits remain the existing stop, budget, secrets and durable effect owners. No autonomous-completion claim; the desk owns the unattended live proof.
80/20: two narrowly scoped repairs, portable red-then-green regressions and direct-consumer checks; no browser engine, policy registry or resolver added.
VERDICT: author submission for independent review; live proof reserved to the desk
