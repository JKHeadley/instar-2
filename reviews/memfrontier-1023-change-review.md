# Change review — Summary memory projection at reservation

Subject base: 42767914df8d0561fd1a5280cc0e7341cc546913
Review state: open
Reviewed content: none
Outcome: Older summaries use the memory projection known at reservation, including later retirement, while offering only sources at or before their history frontier.
Affected rules: Rules 7/26/33/34/36/49/70/74/93/96/101/102/107/111/113/116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement. No added model call, store, service or retry.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Changes memory offered to the summary model and the provenance audit for that packet.
Side effects: Summary preference and saved-fact selection excludes future sources without reconstructing retired preferences as active. The audit consumes the existing reservation memoryCount and checks later retirement against historical text. Ordinary answer selection retains current memory. Memory requests and preferences are audited with their source identity so preference retirement stays source-scoped. Audit preference activation mirrors the existing latest-statement deduplication, so an earlier duplicate does not reappear when the latest source is beyond the summary cutoff.
Undo and recovery: Revert this change; existing journal records and reservation counts remain readable. Compaction and reopen preserve all memory records. No migration or resend is introduced.
Multi-machine posture: Derived packets on any machine use the received journal's current memory and recorded reservation frontier. Existing journal custody and replication are unchanged; no machine-local state added.
Layer below: Checked memoryPreferenceState, projectMemoryClause, replyFor, summary-reserve/lastPrompt memoryCount, independent auditPacket source checks and compact/reopen projection. The history cutoff determines source eligibility; the reservation determines which retirements were already known.
Bug class: integration
Bug evidence: reproducer=tests/preview/summary-frontier-forget.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none
Decision: memfrontier-reservation | Use current memory at summary reservation and bound offered sources by history frontier; do not reconstruct a superseded preference as current. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/memfrontier-1023-PROGRESS.md

1.x first: Searched JKHeadley/instar origin/main src/ and docs/specs/ for summary/projection consistency and inspected CoherenceMonitor.ts and STATE-COHERENCE-REGISTRY.md. ONEX-LESSONS memory/coherence section calls for declared store agreement and retained source history. These provide the coherence precedent, not a compatible summary-packet implementation. Reuse the 2.0 projection and reservation count instead. The future-source predicate and captured frontier test are reused from owning repair 15571a41; its historical preference projection is replaced because that is the reviewed retirement defect.

Prompt review: No prompt wording or intent classifier changes. Exact source cutoffs and recorded retirement govern packet evidence. Test text remains evidence only.
Prompt finding: 4106b49fff07 | protocol-literal | Existing action-claim guidance says an unattempted avenue is not an attempted one; no guidance bytes change.
Prompt finding: 849db3a6296a | protocol-literal | Existing exact empty-memory inventory response; no semantic classifier or prompt wording changes.
Prompt finding: e8708c7fea24 | quoted-evidence | Existing sourceLabel attribution guidance asserted by its negative-control test; no fixture phrase is introduced into guidance.
Evidence: The supplied forgetting reproducer failed before the repair with history-text-source, reply-text-source, memory-request-source and preference-source. Regression covers forgetting, correction and later exact restatement (the latter also reproduced a preference-source disagreement before repair), forged versions of all four fields, no-retirement future-source boundaries, and compact/reopen. Recorded-shape suites replay the proof-room journal and writer/reviewer outputs; exact results and host limitations are in PROGRESS.
Register evidence: Refreshed generated register artifacts from source commit d7addfdcdd16b08a967aa082cd9a60483dba098c using the shipped builder. Desk owner-manifest and inventory refresh tools found no changed hashes; no declaration or conformance certificate was altered.

Evidence limit: Offline journal and recorded model-shape replay; no live operator traffic or deployment is claimed. Desk gate owns live-host certification and independent convergence.
ELI16: An older summary must respect a preference you have since withdrawn. It can summarize the earlier conversation without treating that withdrawn preference as current or importing facts from later messages.
simplestRobustRoute: This is the simplest route: retain the existing current memory projection, restrict offered source ids by the summary cutoff, and audit the same reservation state using its existing count. No new machinery. Start guard: authenticated durable source and recorded memory decision. End state: coherent source-linked packet, retired clauses withheld and future sources absent. Limits: unchanged model budgets, stop, secrets custody and delivery uniqueness. No new autonomous-completion claim.
80/20: Targeted red/green evidence and negative neighbors, recorded-shape replay, typecheck and machine checks; independent landing review remains with the desk.
VERDICT: author submission; no independent convergence claim
