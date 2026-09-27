# Justin's live correction-chain test

Use the approved private preview chat as verified operator Justin, after this change is
landed by the desk. Keep its existing bot, grant, root, expiry, storage-key binding,
model and provider policy. This script makes no new grant. Check `status` before
starting: the remaining trial limits must cover at least 20 turns, 20 replies and
the answer, summary and reply-check calls the runner will need. Use the existing
authorized cap-raise path if needed; an exhausted cap is an incomplete test, not
a reason to alter provider settings. Record each Telegram update ID and redacted
status output. Wait for each reply before the next message.

1. Send: “The observatory access word is waypoint0.” Then send ten direct
   corrections in order: “Actually, the observatory access word is waypoint1,
   not waypoint0.” through “Actually, the observatory access word is waypoint10,
   not waypoint9.” These are synthetic trial values. After every correction,
   check `status.withheld`: it must grow by one and link the earlier source update
   to this operator update. A pending correction or held summary is a visible
   incomplete result; record it and stop the chain.
2. Restart the runner through its normal supervised stop and launch after
   corrections 2, 4, 6, 8 and 10. After each restart, check that the prior
   `status.withheld` rows and summary frontier remain. Send ordinary unrelated
   garden messages as needed until `status.summaryThrough` covers the early
   corrections. Check `status.holds` and `lastSummaryFaithfulness`; a rejected
   summary must keep the old frontier and its source turns.
3. Use the read-only `inspect --text` command with “What is the observatory
   access word?” and the runner's exact `--model`. Its `next` view must carry
   only waypoint10 as the active value. Then ask the same question in the
   private chat. The answer must use waypoint10 alone. Verify one exact send
   intent, at most one acceptance receipt and one Telegram reply for the question.
4. Pause the runner and wait for its exclusive writer to exit. Check the ten
   `status.withheld` rows in order. Make a private isolated clone of the encrypted
   journal and run the existing compaction probe; the live journal is untouched:

   ```sh
   umask 077
   CLONE_ROOT="$(mktemp -d /private/tmp/instar-correction-chain.XXXXXX)"
   cp "$PREVIEW_ROOT/journal.encrypted" "$CLONE_ROOT/journal.encrypted"
   touch "$CLONE_ROOT/.journal-compaction-clone"
   node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-compaction-probe.mjs "$CLONE_ROOT"
   node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root "$CLONE_ROOT"
   ```

   Require `result: "verified"`, the same ten audit rows and unchanged cursor,
   turns, calls, replies and holds. Resume the original runner on its original
   root and ask the question once more. It must still answer with waypoint10
   alone, with one reply and no duplicate send. Preserve the live root and
   handle the isolated clone under the desk's normal trial-data procedure.

Read-only checks use the existing host storage-key binding, never a pasted key:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root "$PREVIEW_ROOT"
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs inspect --root "$PREVIEW_ROOT" --text "What is the observatory access word?" --model "$PREVIEW_MODEL"
```

The offline regression proves ten exact journal corrections with shorter old
quotes, five replays, rolling summaries and encrypted compaction. The live
model may choose different quoted clauses; record the actual audit chain and
do not claim a branch ran unless its trace shows it.
