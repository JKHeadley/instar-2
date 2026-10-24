# Change review — scheduled-session MCP passthrough

Subject base: 17daf07876102b3cf68d8ecc4e9faa178784acbe
Review state: open
Reviewed content: none
Outcome: scheduled tool-using sessions receive the installation's reviewed root MCP configuration through the same preparation and admission path as continuing conversations.
Affected rules: 1, 26, 34, 49, 70, 74, 100, 101, 102, 103, 111, 113, 116
Affected floors: secrets remain in existing custody and per-launch socket handoff; spend caps and stop remain the session admission gate's; no duplicate sends and durable intake remain the effect owner's. No policy or grant is widened.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: launch plumbing changes which reviewed connectors scheduled work can see; no model prompt, parser or effect decision changes.
Side effects: scheduled workers can now launch the same explicitly configured servers as conversation workers. An absent root file prepares an empty set. Listed reads retain the existing read classification; other calls still reach the effect gate. No-tool model calls stay empty. Root server definitions must already be reviewed.
Undo and recovery: revert the journal-agent changes; no store migration or configuration rewrite. Existing claim close and shutdown retire connector sockets. Existing stop, identity, expiry and resource checks still guard launch and dispatch.
Multi-machine posture: configuration and connector processes remain installation-local; only the existing session owner launches them. No peer state or ownership rule changes.
Layer below: traced readRootMcp, prepareMcpLaunch, prepareSessionAdmission, prepareSessionConnectors, sessionConnectorArgs, subscriptionToolSettings and the admission hook. Per-call tool turns and continuing sessions already forward the list; only scheduled session composition dropped it.
Bug class: integration
Bug evidence: reproducer=tests/preview/mcp-passthrough.test.ts
Hook bypass: none
Convergence: none
Decision: mcp-scheduled-existing-seam | remove the conversation-only conditions around root MCP loading, preparation and driver connectors, and forward current read scope to the scheduled effect decision, keeping all existing policy and admission logic | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/mcp-passthrough-1024-PROGRESS.md
Prompt review: no prompt or output parser changed. The regression replays captured summary-writer 715672480, uncertain summary 715672483, Jev undecided 715672482, Jev unsure 969389570, reply-review 969389923, delivered reply 715672479 and empty candidate 715672550 as opaque tool input through the prepared read/effect boundary. Provenance is retained in fixtures/retrospective-duty-followup-train-1-2026-10-08.json; no live delivery is claimed for the empty candidate.
simplestRobustRoute: this is the simplest route: use the already installed connector preparation for scheduled sessions too. No engine, policy, queue or watcher is added. The start guards are existing activation and session admission, the end guard is claim close, and stop, expiry, call bounds and effect uniqueness remain in their owners. Live model proof requires the Studio proof room; this author record claims only the named command/test evidence.
80/20: repair the missing launch and read-scope connections and exercise both configured and absent roots, both session modes and unchanged no-tool policies.
VERDICT: author submission; no independent convergence claim
