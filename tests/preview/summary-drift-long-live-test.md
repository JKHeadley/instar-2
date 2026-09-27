# Long-summary drift: supervised private-chat script for Justin

Use only the desk-approved private preview runner, bot, grant, root, expiry,
credentials and limits. Do not edit the live journal or change the subscription
provider policy. This is a supervised test; stop when any existing call, reply,
turn, byte, stop or expiry gate holds work. Record that limit as the result rather
than raising it for this script.

1. As Justin, send three harmless, distinct facts in the approved private chat:
   “Remember: my sample cedar box is labeled violet-7319.” “Remember: my sample
   fern belongs by the north window.” “Remember: my sample atlas stays on shelf
   four.” Record their exact message text and update IDs. Wait for each reply.
2. Send short, unrelated filler turns one at a time, waiting for each reply and
   checking `status.summaryThrough`. Count only distinct committed summary
   frontiers after the first planted fact. Continue until 65 successive summary
   commits have occurred, or until an existing gate stops the run. Do not count
   a failed or pending summary as a commit. Record `lastSummaryFaithfulness`
   and any hold after each frontier.
3. Ask for all three sample facts in one message. Record the exact reply and the
   `inspect --text` packet. Check each original clause separately against the
   latest packet's summary `memoryItems` or exact summary text, and record an
   exact-survival count from 0 to 3. Note separately whether the answer itself
   was correct; packet survival does not prove answer quality.
4. Restart only under the desk's existing approved procedure. Repeat the
   question and inspect the packet again. Verify the source IDs, exact quotes,
   summary frontier and faithfulness record survived replay. Confirm one exact
   send intent and at most one Telegram receipt per question; do not resend an
   UNKNOWN outcome.
5. As Justin, correct one sample fact and request forgetting another. After
   their memory decisions and a later committed summary, inspect the next
   packet: the old corrected clause and forgotten clause must be absent; the
   exact new clause must retain its operator source. If a decision stays
   pending, record the hold and do not count that branch as passed.

The offline 65-transition fixture is deterministic and reports 0/3 exact
survival before source references and 3/3 after. This live script records the
actual model and runner result without assuming that the approved budget can
produce 65 commits in one trial.
