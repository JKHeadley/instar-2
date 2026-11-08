# Rule 121 attribution: the parts the first cut does not ship

**Status:** OPEN. The first part (unit attribution-cut-1107) checks a credited statement when the agent writes it to a note. The parts below are owed and are not built in this tree.

**Owner:** Echo (agent), as owner of the preview trial's reply review and tool admission. Each part lands as its own unit with its own change-review record.

**What the first part holds:** under `--attribution record|enforce`, every note write (Write, Edit or NotebookEdit on a `.md`, `.markdown` or `.txt` file, and the added prose lines of an `apply_patch`) is checked once per exact text before the file changes. Code proves what code can: the `[source: …]` marker parses, it resolves to a logged message in the journal, the date matches, and the quoted words are in that message. One recorded model judgment (`attribution-judge-2.0-v2`) decides whether the text credits a person and whether the line claims more than the words. Under enforce a refused note is not written and the agent is told how to write it honestly. Without the option nothing changes.

**Owed parts, each from origin/train-202 member attribution-rule121-1106 (979a1282), whose reviewed code is the starting point:**

1. **The send check.** Rule 121 checks a credit "again when it is cited or enforced". The reply path (`attributionOfReply` in `tests/preview/journal.ts`, the revision round objection `ATTRIBUTION_OBJECTION` in `tests/preview/reply-check.ts`, claim-scoped excision after the last revision, and the recap exemption for the turn's own authenticated conversation) is not wired. It depends on the pre-send review order unit (df616f840), which is not in live train-209. Acceptance: a refused reply under enforce is revised or excised on the real route, both sides tested, with the 1.x replay's send sets (H-recap-true, I-send-false) passing.
2. **Long notes.** A note over 16,384 characters is recorded `unchecked` with no model call (`text longer than one check`); markers inside that bound still get their exact checks and a failed one still refuses. Owed: 1.x `AttributionJudge.chunkForJudge`, with whole-text exact facts and cuts kept outside a credit, as reviewed in rounds 1 and 2 of attribution-rule121-1106. Acceptance: that unit's long-note tests (tail case, cut inside a quote, 8-chunk limit) pass.
3. **The trail reads.** The `attribution-trace` launcher command (`attributionTrace`, every recorded wording of a claim oldest first) and the record-period counts (`attributionSummary`, the measured unchecked rate). The rows they read are already recorded by the first part. Acceptance: the command reads a real journal read-only.
4. **Writes the hook does not see.** Notes written by shell commands, tool turns with no checkpoint, and the rolling summary (residue `attr-write-gaps` of attribution-rule121-1106).
5. **Live proof.** A real Telegram run with a refusal on the real route, the write check on the real route, a record period and the measured timeout rate (residue `attr-live-proof-owed`); real Slack sending once 2.0 Slack replies go live (residue `attr-slack-send-owed`).

**Close when:** parts 1 to 3 have landed and parts 4 and 5 have their own records or have landed.
