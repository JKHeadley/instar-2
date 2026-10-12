# Change review — Rule 87 bounded progress replies

Subject base: c1e290e1f264470bdd081778ce16ef7e693118f0
Review state: open
Reviewed content: none
Outcome: Cover the inherited PR 160 merge (d5d1ed51), then add exactly Justin's approved bounded-progress sentence after Rule 87's acknowledgement sentence, publish revision 15 preserving prior history, refresh the existing constitutional excerpt digest, and regenerate the register from committed source.
Affected rules: 45, 47, 52, 54, 69, 74, 77, 82, 84, 87, 90, 91, 98, 101, 109, 111, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain unchanged; no send or approval boundary changes.
Operator questions: Justin's code-owner Approve on the final head is required before merge. Exact sentence approved in topic 102965 at 21:53 PDT on 2026-10-11 ("yes"). This builder does not merge.
Suggested tier: critical
Declared tier: critical
Tier rationale: changes constitutional wording and the model's quoted context, despite adding no runtime send mechanism.
Side effects: every sourcePacket consumer receives the appended sentence in the existing Rule 87 excerpt; prompt size increases slightly. MIND_RULES remains the exact held-by-the-mind group. The existing source digest check refuses stale or missing text.
Undo and recovery: publish a new governed version reverting the sentence and refresh the excerpt digest and generated register together; preserve earlier history. No runtime state migration or deployment.
Multi-machine posture: identical repository wording and generated sources on every machine; no local state, ownership or replication changes.
Layer below: complete purpose and rule book; PR 160's version and approval record; PR 154/158 amendment lineage; sourcePacket and prepareJournalEnvelope; bootstrapDeclarations, publication anchor and register replay checks.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: append the verbatim approved sentence to the quoted constitutional source; no test phrase becomes a meaning filter and no accept/escalate/refuse parser changes.
Decision: rule87-source | Reuse the existing pinned Rule 87 excerpt; MIND_RULES remains the held-by-the-mind group. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/r87b-pr-1011-PROGRESS.md
Decision: publication-pins | Refresh existing shape-only publication hashes and regenerate from committed source; these pins confer no runtime authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/r87b-pr-1011-PROGRESS.md
Decision: review-base-coverage | Cover the inherited PR 160 merge from its first parent without rewriting history; branch still begins at d5d1ed51. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/r87b-pr-1011-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: one exact sentence, one immutable changelog revision, one existing source digest and existing register generation. Start guard is Justin's recorded exact-text approval; end guards are sync/drift and generated-source checks; safety and resource floors remain unchanged. No new mechanism or autonomous capability is claimed.
80/20: Targeted constitutional sync, provider-context delivery, generated publication and real captured-shape replay evidence will be recorded in the builder report; independent landing review and final-head code-owner approval remain pending.
VERDICT: author submission; independent review pending
