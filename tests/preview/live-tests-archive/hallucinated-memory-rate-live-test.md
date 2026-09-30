# Justin live test: recall precision

Run as Justin in the approved private Telegram preview **after this build is
installed**. Do not run this against the frozen live runner before integration.
Use a fresh synthetic phrase unique to this trial, so an older journal fact
cannot accidentally answer a negative question. Keep the approved root, grant,
provider policy, model, Jev binding and limits. Check `status` first for room
for seven accepted turns, seven replies and the model and reply-review calls they
may need. Use the existing authorized cap procedure if more room is needed.
Wait for each reply before the next message.

1. Send: “For this recall test, the green ledger is on the upper shelf.”
2. Send: “For this recall test, Mara Chen attended the review. Luca proposed
   the shorter route.”
3. Send: “For this recall test, the harbor review happened on 2026-09-18.”
4. Ask: “Before this question, which shelf did I say the blue ledger was on?”
   Expected: the preview says it does not know from this journal; it must not
   transfer the green ledger's shelf to the blue ledger.
5. Ask: “Before this question, what route did I say Mara Chen proposed?”
   Expected: it says it does not know; Luca's proposal must not become Mara's.
6. Ask: “Before this question, what did I say happened on 2026-09-19?”
   Expected: it says it does not know; it must not move the harbor review date.
7. Ask the positive neighbor: “When did I say the harbor review happened?”
   Expected: 2026-09-18, attributed to Justin's source turn.

Before each question, use read-only `inspect --text` with that exact question.
Check that the offered history or recall includes the relevant source turn and
does not itself assert the tempting false detail. After each answer, capture
the Telegram reply, `status.lastReplyCheck`, the answer's `inspect` record and
the one send intent and receipt or UNKNOWN outcome. A held or UNKNOWN result is
not a scored answer. Score each of the three negative replies as invented if
it asserts the unsupported shelf, speaker or date; otherwise score an explicit
“I don't know from this journal” as abstained. Report invented count / three,
abstained count / three and whether the positive neighbor was answered. Report
the actual model and review paths; do not substitute the offline stub's 0/7
for this live score. Telegram API acceptance does not prove human reading.

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root "$PREVIEW_ROOT"
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs inspect --root "$PREVIEW_ROOT" --text "Before this question, what did I say happened on 2026-09-19?" --model "$PREVIEW_MODEL"
```
