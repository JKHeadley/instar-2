# Ambiguous recall: supervised private-chat script for Justin

Run this only after the desk lands this revision, reviews the changed conversation
prompt digest, provisions its matching activation, and resumes the existing
reply-only preview. Use the bound private operator chat. Do not start a second
runner or use the frozen live root from this builder worktree. Record the actual
messages, `status`, and `inspect` output; an offline fixture is not a live proof.

1. Check `status` for stop, expiry, UNKNOWN effects and enough capacity for about
   fifteen messages plus summary calls. If needed, use the desk's recorded
   `raise-caps` authority before the trial. Confirm the running activation has
   the reviewed conversation prompt digest. Send: `Sam Patel from accounting
   approved the Atlas budget.` Wait for the reply. Then send: `Sam Ruiz, my
   neighbour, lent me a ladder.` Wait for the reply.
2. Send harmless filler messages, waiting for each reply and for
   `summaryPending: 0`, until `inspect --text "What did Sam do?" --model MODEL`
   shows `historyMode: summary-plus-recent` and two `people` mentions, one for
   Sam Patel and one for Sam Ruiz. Stop if a cap or hold appears and record the
   incomplete result. Then ask: `What did Sam do?` The reply should ask one
   short question distinguishing the two Sams, without choosing an action for
   either. Ask: `What did Sam Ruiz do?` The reply should say he lent a ladder,
   without asking which Sam.
3. Send: `The Atlas launch is on October 8.` Wait for the reply. Send:
   `The Atlas launch is on November 12.` Wait for the reply. Confirm the next
   `inspect --text "When is the Atlas launch?" --model MODEL` packet contains
   both active statements in history or recall. Ask: `When is the Atlas launch?`
   The reply should ask one short question distinguishing October 8 from
   November 12, without choosing either. Ask: `What October date did I mention
   for Atlas?` The reply should answer October 8 directly.
4. Inspect the persisted prompts for both ambiguous questions and their send
   intents. Each actual response should have one Telegram send intent and at
   most one accepted send. Check that no unsolicited message was sent between
   questions. Record whether the model asked one question, guessed, or gave a
   different response. A guess is a failed live proof, not a passing fixture.

The statements above are temporary test facts in the trial journal. If this
root is kept, Justin can issue direct correction or forgetting requests after
the proof; those requests use the existing memory workflow and require their
own confirmed replies.
