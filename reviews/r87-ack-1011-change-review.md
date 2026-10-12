# Change review — Rule 87 acknowledgement clarification

Subject base: 253f1c6ab52a0d164510abd7436c48052999120b
Review state: open
Reviewed content: none
Outcome: Cover the inherited PR 158 merge (c1e290e1), which synchronizes Rule 18 and the purpose digest but lacked merge-record coverage, then add exactly Justin's approved acknowledgement sentence to Rule 87, publish revision 14 preserving all prior changelog entries, deliver the amended rule through the existing pinned constitutional source packet, and regenerate the register from committed source.
Affected rules: 45, 47, 54, 69, 74, 77, 82, 84, 87, 90, 91, 98, 101, 109, 111, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain unchanged; no send or approval boundary changes.
Operator questions: Justin's code-owner Approve on the final head is required before merge. Exact sentence approved in topic 102965 at 16:28 PDT on 2026-10-11 ("Yes", replying to the 16:26 question). This builder does not merge.
Suggested tier: critical
Declared tier: critical
Tier rationale: changes constitutional wording and the model's quoted context, despite adding no runtime send mechanism.
Side effects: every sourcePacket consumer now receives the full Rule 87 row as one additional pinned excerpt, including its existing status/churn restriction. This slightly increases prompt bytes; direct consumer tests cover context bounds. MIND_RULES remains the exact held-by-the-mind group. A stale Rule 87 excerpt refuses launch through the existing digest check.
Undo and recovery: publish a new governed version reverting the sentence and update its pinned excerpt and generated register together; preserve all earlier versions. No runtime state migration or deployment.
Multi-machine posture: identical repository wording and generated sources on every machine; no local state, ownership or replication changes.
Layer below: complete purpose and rule book; PR 154's immutable changelog amendment pattern; PR 158's constitution-briefing sync guard; sourcePacket and prepareJournalEnvelope; bootstrapDeclarations, publication anchor and build-register replay checks.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: one verbatim approved Rule 87 excerpt is added to quoted constitutional sources; no test phrase becomes a meaning filter, and no accept/escalate/refuse judgment logic changes.
Decision: rule87-source | Rule 87 belongs to Needs building, so deliver it with the existing pinned sourcePacket excerpts without relabeling it as a held-by-the-mind rule. MIND_RULES stays unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/r87-pr-1011-PROGRESS.md
Decision: publication-pins | Refresh the existing shape-only publication anchor and derived hash from source, then regenerate; these publication pins confer no runtime authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/r87-pr-1011-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: one exact sentence, one immutable changelog revision, one existing source excerpt/pin, and existing register generation. Start guard is Justin's recorded exact-text approval; end guards are sync/drift and generated-source checks; safety and resource floors remain unchanged. No new mechanism or autonomous capability is claimed.
80/20: The new positive and negative sync tests fail before the change and pass after. The successive provider-I/O assertion checks Rule 87 delivery. Seven recorded output shapes reach the real worker model port with the amended rule, with unchanged output dispositions; 14 captured model packets and review contexts preserve history with the new excerpt. Detailed targeted results and historical overflow/whole-journal compatibility limits are recorded in the builder report. Independent landing review and final-head code-owner approval remain pending.
VERDICT: author submission; independent review pending
