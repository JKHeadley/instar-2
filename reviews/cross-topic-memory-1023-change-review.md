# Change review — retain compact cross-topic memory

Subject base: b61926b0d8867d2b4e8ca01beb34b4ca0dc64f03
Review state: open
Reviewed content: none
Outcome: A bounded answer packet tries one whole attributed sibling excerpt before omitting sibling memory entirely. The latest open promise takes precedence; otherwise the newest statement is retained.
Affected rules: 7, 28, 34, 36, 47, 60, 74, 83, 96, 101, 102, 111, 113, 116, 117.
Affected floors: secrets — existing audience admission, redaction and withholding run before rendering; spend cap — unchanged packet and call caps, no added model call; stop — unchanged dispatch checks; no duplicate sends — no send or receipt writer changes; durable intake — existing journal bytes preserved.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes evidence offered to an answer model across topics; existing authority and delivery paths remain unchanged.
Side effects: One more bounded packet variant can fit at the final reachability rung. Full packets retain their original bytes. Compact packets disclose omitted items, retain source/topic/time/current state and never treat the excerpt as permission. At still smaller envelopes the existing final omission remains, preserving reachability. Selection is an exact priority over already admitted data, not a semantic relevance verdict or absence claim.
Undo and recovery: Revert this rendering change and replay tests. No migration, journal schema change or data rewrite; the existing history remains available.
Multi-machine posture: Read-only rendering of the existing owner journal; its replication and topic ownership remain authoritative. This does not establish knowledge of a disconnected peer or introduce a machine-local store.
Layer below: Inspected currentActionFacts/currentSiblingWords audience and receipt checks, memory redaction/withholding, commitmentOpen/closed projection, prepareJournalEnvelope's combined system-plus-prompt cap, and the final preparedWithFloor reachability rung. Compared Instar 1.x WorkingMemoryAssembler.renderEntities tiered rendering and session-start working-memory injection at d5b30b1d7c059da68483caf15d7584aec0d7a325.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-sibling-replay.test.ts; original recorded inputs 715676486 and 715676488 lose all sibling context under byte pressure. Tests on the base fail the new retained-context assertions at 27000/28000 bytes; the new variant retains attributed evidence within the same caps.
Hook bypass: none; core.hooksPath unset, inspected common hooks directory contains sample hooks only.
Convergence: none
Decision: ctm-compact-rung | Port the 1.x tiered bounded-rendering pattern into the existing final packet ladder; retain one current open promise or newest statement before omission, with omission count, preserving every source byte in the journal. No new memory service, retrieval algorithm or model call. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cross-topic-memory-1023-PROGRESS.md
Decision: ctm-exact-base | The requested frozen remote branch is absent. Fetch and branch from its exact specified b61926b0d8867d2b4e8ca01beb34b4ca0dc64f03 commit, also the remote train-136 head, rather than substitute newer main. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cross-topic-memory-1023-PROGRESS.md
Prompt review: Reuse immutable twosession-1015.json.gz rows and original model/review outputs. Additional recorded writer, uncertain summary, undecided/unsure Jev, reply-review, delivered and empty output shapes come from retrospective-duty-followup-train-1-2026-10-08.json. Replay proves actual prepared-context retention, not a new model's semantic answer or real Telegram delivery. Unverified audiences receive no sibling words. Exact-head live proof remains a desk acceptance check, never inferred from stubs.
Prompt finding: 849db3a6296a | protocol-literal | existing saved-memory response in journal.ts, unchanged by this change.
Prompt finding: e8708c7fea24 | protocol-literal | existing memory source-label guidance in journal.ts, unchanged by this change.

## ELI16

When the answer has little room left, it used to lose the whole view of what the agent said in another topic. It now tries to keep one useful piece first: an open promise, or the latest statement. It keeps where and when it came from and says that other items were left out. This does not increase the allowance or allow a private fact to reach a new audience. If even that piece cannot fit, the agent can still answer using the existing smaller packet.

## Closing block

simplestRobustRoute: This is the simplest robust route: one compact rendering variant inside the existing bounded packet ladder. The named failure is all-or-nothing sibling context loss even when one attributed excerpt fits. A new store, watcher or summarizer would add synchronization and cost without addressing that loss. Start guard: existing verified-audience and receipt projection. End-state guard: the prepared model envelope includes the exact projected excerpt or retains the existing explicit omission outcome. Limit guards: unchanged system-plus-prompt bound, call allowance, stop and send admission. No unattended live-completion claim.
80/20: Keep the change within the existing rendering ladder, prove retained and omitted neighbors with real recorded shapes, and retain the existing audience/freshness session tests. Independent acceptance belongs to the desk.
VERDICT: author submission; this record asserts no independent verdict — the desk records its own
