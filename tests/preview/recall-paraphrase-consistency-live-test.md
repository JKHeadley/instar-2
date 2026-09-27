# Recall paraphrase consistency — live test for Justin

Use the authorized private Telegram preview only after the desk installs this
branch through its normal gate. The builder does not run this script or change
the live runner. Ask the desk for the existing bot, root, and read-only `status`
and `inspect` commands. Check remaining finite turn, call, and reply room before
starting; the full script needs 32 turns and replies, plus filler turns and
summary and review calls. Use these synthetic values, not a credential or
personal secret.

## Save and establish the first answer

1. Send `The observatory access color is cobalt.`
2. Send `Mira Patel prefers the north entrance.`
3. Ask each of the ten questions below once. Save each actual reply and its
   `inspect` packet. Before summary coverage, the original fact should be in
   `history`.

| Fact | Five phrasings to send separately |
|---|---|
| Observatory | `What is the observatory access color?` · `Which hue did I set for the observatory?` · `At the observatory, what shade opens the door?` · `Which tint did the observatory use?` · `What was the observatory's assigned hue?` |
| Mira | `Which entrance does Mira Patel prefer?` · `What doorway is Mira Patel's choice?` · `Where does Mira Patel like to enter?` · `Which entry does Mira Patel favor?` · `Remind me of Mira Patel's preferred entrance.` |

## Cross summary and restart boundaries

4. Send unrelated ordinary messages until `status.summaryThrough` covers both
   saved-fact update IDs. Check the available cap room as you go. Repeat the ten
   questions and save replies and packets. The source fact should be in
   `recalled` or another cited original-source packet field; a summary sentence
   alone is not evidence that the original source was selected.
5. Have the desk pause and restart the same authorized runner with the same
   root and reviewed configuration. Confirm a new launch appears in `status`.
   Repeat the ten questions and save replies and packets again.

For each phase, count a question as inconsistent if its reply gives a value
other than `cobalt` or `north` as appropriate, omits the answer despite available
source evidence, or cites a different original source for that fact. Report the
count over ten, plus any `UNKNOWN`, held turn, absent source, or packet omission
separately. The expected result is **0/10 in each phase** and the same original
fact update ID in every corresponding packet. If the runner cannot reach summary
coverage or a cap stops it, record the phase as incomplete rather than passing.
Do not infer absence from a bounded packet or repeat an UNKNOWN send.
