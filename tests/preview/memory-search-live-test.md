# Desk live test: ask what the preview remembers

Run as verified operator Justin in the existing approved private Telegram preview
chat. Keep the current runner root, grant, audience, expiry, limits and Jev binding.
Use synthetic facts. Before starting, run `status` and confirm room for five turns,
five replies and at least seven model attempts; use the existing authorized
`raise-caps` procedure if necessary. Wait for each reply before sending the next
message. Record Telegram replies and the redacted `status` and `inspect` output.

1. Send: “Sam's trial badge color is blue.” Then: “Sam's trial meeting place is Cedar Hall.”
2. Send: “Actually Sam's trial badge color is green, not blue.” Wait for the reply and
   confirm `status.withheld` records a correction from the first source turn.
3. Send: “Forget that Sam's trial meeting place is Cedar Hall.” Wait for the reply and
   confirm `status.withheld` records forgetting from the second source turn.
4. Run `inspect` with `--text "What do you remember about Sam's trial details?"`
   and the runner's exact `--model`. Check `next.memorySearch`: it cites the
   corrected item with the original source turn/date and correction turn/date;
   `forgotten` is at least one; no forgotten meeting place appears in its items.
5. Send the same question as Justin. The PREVIEW answer should cite each fact it
   uses by source turn and date, mark the badge color as corrected, and report the
   forgotten count without naming the meeting place. It may say the bounded list
   is incomplete if `truncated` is true. Check `status.lastReplyCheck.verdict=pass`
   with path `jev` or `subscription`; a held check is incomplete proof. Confirm
   one send intent/receipt and one Telegram reply for this turn, with no duplicate.

Use the existing read-only commands after each step:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root "$PREVIEW_ROOT"
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs inspect --root "$PREVIEW_ROOT" --text "What do you remember about Sam's trial details?" --model "$PREVIEW_MODEL"
```

This script requires the desk's live credentials and Justin's actual messages.
Offline tests use stubbed providers and a fake send port; they do not establish a
live Telegram result.
