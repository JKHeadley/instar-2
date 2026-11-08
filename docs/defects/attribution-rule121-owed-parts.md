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

## Graduation (Rules 72 and 73)

The write check ships switched off: it runs only when the runner is launched with `--attribution record` or `--attribution enforce`. Until it graduates it is reported dark, never as a guard. Its graduation commitment uses the preview's existing deadline mechanism: the `preview.attribution-check` declaration in `tests/preview/capabilities.declarations.json` (status `dark`, gate `PREVIEW-ATTRIBUTION-CHECK`) and its entry in `tests/preview/promotion-record.ts`, which must name the same deadline. The register's deadline walker and `capabilityFindings` report it overdue once the deadline passes.

- **Owner:** Echo.
- **Graduation deadline:** 2026-11-21 00:00 UTC.
- **Development-agent stage (the real-route proof of part 5):** one real Telegram run under `--attribution enforce` on the live route in which a falsely credited note is refused before the file changes, the agent is told the honest form, and a correctly sourced note in the same run is written. Evidence: the run's journal `attribution-check` rows and the note files.
- **Record period (part 5):** at least 7 consecutive days under `--attribution record` on the live build, with at least 20 checked note writes; `unchecked` (any cause) at most 10% of them; and zero `refuse` rows, on review of every one, for a note whose source resolves and whose words match. Measured from the status command's `attributionChecks` counts (verdicts and unchecked causes), which read the journal's own rows.
- **Transition:** meeting both raises the check to the recurring review; nothing switches on by itself. The reviewed outcome is either a code change making `enforce` the default launch (fleet stage, default-on) or a recorded user-preference decision keeping it off, appended to the promotion record.
- **If the deadline passes unmet:** Echo graduates, retires, or brings the miss to the operator. A further extension is not Echo's alone.

**Close when:** parts 1 to 3 have landed and parts 4 and 5 have their own records or have landed.
