# Rolling-summary faithfulness: live script for Justin

Use only the already approved private preview runner, bot, grant, root, expiry and
limits. Keep the existing storage, Telegram and TypeSafe host bindings; do not
put values in a command or this record. Do not edit the live journal. Start or
resume the runner under the desk's existing procedure.

1. In the private chat, send two distinct synthetic facts as Justin: “Remember:
   my sample workshop code is 7319” and “Remember: the sample workshop opens on
   Tuesday.” Wait for each preview reply.
2. Send harmless filler messages until `status.summaryThrough` covers both fact
   updates. After each turn, inspect `status.lastSummaryCheck`. Record its
   `path`, `verdict`, `score`, and any `status.holds` reason. A `jev` verdict
   proves the ambiguous route was used; an `exact` pass proves it was skipped.
3. Ask “What sample workshop code and opening day did I ask you to remember?”
   Record the exact reply and `inspect --text` packet coverage. Both facts must
   be available through the summary or recalled originals. Check that each
   update has one send intent and at most one receipt; no duplicate reply.
4. Restart the same runner under the existing procedure. Repeat the question
   and `status`. The summary frontier, check result and any hold reason must
   survive. If a summary was rejected, the prior frontier must remain and the
   originals must remain in the journal; record the reason and do not edit or
   replay the source turns.

The offline `summary-faithfulness.test.ts` forces lost, uncertain, unavailable,
exact-pass and Jev-pass outcomes. The live test cannot force the subscription
model to omit an item, so record observed behavior without claiming that the
live rejection branch ran unless it actually did.
