# Justin's supervised check after the offline pre-switch canary

Use the desk's currently approved private-chat preview runner. This procedure
does not authorize a build switch, change caps, renew an activation, or edit its
journal. Run `node tests/preview/offline-canary.mjs` from the candidate checkout
first and keep its final PASS line with the candidate commit. Stop on FAIL.

1. As Justin in the bound private chat, send `What did I ask you to remember
   about this project?` Wait for one PREVIEW answer. Record its Telegram message
   ID and the runner's `status` output: the turn, call, reply and check counts,
   `lastReplyCheck`, `unknownSends`, and `summaryThrough`.
2. Send `status`. Check that the reply names accepted turns, held work, the
   subscription attempt allowance, Jev checks and replies. Record the message
   ID and the next `status` output. This command itself consumes a turn and a
   reply; it does not need an answer-generation call.
3. Ask for a short recap of what you discussed this week. Record the PREVIEW
   reply and `status` after the runner's summary work has settled. If a rolling
   summary was attempted, inspect `summaryThrough`, `summaryChecks`,
   `lastSummaryCheck` and `lastSummaryFaithfulness`; a failed review leaves the
   previous frontier visible.
4. Compare the chat replies with the recorded exact send intents and API
   results. Each answered turn has at most one physical send. An UNKNOWN send
   stays UNKNOWN and is not repeated. Preserve the status and inspect output
   under the desk's existing trial evidence location.

The offline canary supplies deterministic model and Telegram substitutes. This
script is the separate operator-channel check; Justin sends the messages.
