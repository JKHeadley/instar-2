# Change review — retrieve original support and disclose a search miss

Subject base: 4227fad1cabd8c289f016184cba740a6930dd36e
Review state: open
Reviewed content: none
Outcome: A remembered detail supported only by summary or saved memory requests the existing bounded original-source lookup; an unsuccessful recall answer tells the person what was searched and that the search may have missed it.
Affected rules: 1, 4, 10, 11, 12, 34, 36, 37, 41, 49, 58, 70, 74, 75, 101, 113, 116
Affected floors: Existing secret redaction, spend cap and per-turn call reservation, stop admission, durable intake, ownership and duplicate-send fences remain in force. No additional call allowance or state.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Small default-on changes to instructions delivered to the answer model affect user-facing memory behavior.
Side effects: Recall from saved facts may take the existing second answer call to fetch an original. Recall already supported by history or recalled needs no lookup. The call cap, one-lookup limit and honest unavailable path remain authoritative. Complete meaning-index coverage does not imply perfect search.
Undo and recovery: Revert the two instruction edits. No migration, retained-state rewrite or resend is needed.
Multi-machine posture: Identical instruction changes on every machine; the existing journal and recall owners retain their source access and coordination responsibilities. No machine-local store is introduced.
Layer below: Read both governing documents, glossary and Part 21 retrieval design. Inspected 1.x SemanticMemory.searchHybrid, which needs a vector provider/store not installed here. Reused 2.0 meaningTermsIndex, composeRecall and the existing model-owned lookup. Read the named proof-room journal strictly read-only using journal-agent inspect and its read-only journal reader; no sends, restarts or serving logins.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/s-recall-meaning.test.ts; live=tests/preview/fixtures/s-recall-meaning-2026-10-25.json
Evidence boundary: The fixture proves the original failure and the recorded model's interpretation. The reconstructed lookup request proves the retrieval mechanics, not fresh model compliance. Captured outputs from earlier lookup and summary/reviewer cases are replayed with their provenance. Desk live group S must establish repaired end-to-end acceptance.
Decision: s-recall-original-lookup | All 24 generated term lists scored zero for the paraphrase; expanding the candidate pool cannot repair that. Ask the existing answer model to reformulate for original support even when memory or summary supplies a possible answer. No new engine or helper call. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-recall-meaning-1026-s-PROGRESS.md
Decision: s-recall-search-limit | Update 6236620's private reason states the search limit but its delivered answer does not. Require that explanation in the reply in the model's own words. No phrase detector or reply substitution. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-recall-meaning-1026-s-PROGRESS.md
Prompt review: Instructions describe general evidence and search limits; no cabin, horse, source id or expected test answer occurs in them. The always-present capability sentence shrinks. Lookup instructions are present only while the existing lookup is available. Historical fixture text is data, not instructions.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged obligation evidence instruction, not a test-derived semantic decision.
Prompt finding: 85544c20941f | protocol-literal | Unchanged holding-notice protocol, not a keyword classifier.
Prompt finding: e8708c7fea24 | protocol-literal | Existing citation duty remains; its assertion verifies delivery of that duty.
Prompt finding: 849db3a6296a | protocol-literal | Existing inventory-empty rendering is unchanged by the recall instruction repair.
Prompt finding: 4b98dc2a1b9f | protocol-literal | Historical capability inventory assertion; no new capability or test phrase is added.
Prompt finding: 95e349aaf4ac | protocol-literal | Existing effect-doorway standing description; no authority boundary changes.
Publication: Register regenerated from source commit 7167b6698b473800afb00f4838786beca38be373 using the existing replay builder. This refreshes derived source pins only and grants no runtime authority.
Verification: Historical packet comparisons in topic-awareness and recall-latency preserve their recorded bytes while asserting the revised evidence instruction. The older captured not-found answer stays paired with its original question. An additional explicitly constructed S11c control moves the recorded uncertainty sentence from private reasoning into the reply and proves delivery preserves it. Neither is represented as fresh model compliance.
Hook bypass: none
Convergence: none

## Closing block

simplestRobustRoute: This is the simplest robust route: clarify the two existing instructions. The recorded model already understood the paraphrase and the search limit, but skipped retrieval because the packet contained saved memory and left the limit in private reasoning. The current lookup already reserves, records, bounds and prioritizes its results. Start, end-state and limit guards remain unchanged. No unattended repaired-live claim is made.
80/20: Repair the two demonstrated instruction gaps; prove the recorded miss, source lookup and unrelated/empty-result neighbors. Submit bounded replay evidence and retain the desk's independent live gate.
VERDICT: author submission; no independent verdict claimed
