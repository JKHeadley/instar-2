# Justin's supervised follow-up question test

Use the already approved private-chat journal trial, its existing root, bot, model,
activation, credentials and finite caps. This script authorizes no new audience,
send route, cap raise or unprompted message. Do not use the frozen live runner's
journal for offline tests.

1. As Justin in the bound private chat, send one synthetic message: “My fictional
   friend Priya's birthday is October 4. Who did I mention?” Wait for one PREVIEW
   reply. Record its Telegram update ID and the reply message ID.
2. Before sending another message, inspect a read-only next packet from the same
   root, using the trial's exact model ID:

   ```sh
   node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs inspect \
     --root /ABSOLUTE/APPROVED_JOURNAL_ROOT --model DESK_EXACT_CLAUDE_MODEL_ID \
     --text 'and her birthday?'
   ```

   Confirm `next.lastNamedPerson.name` is `Priya`, and its `message` is the first
   message, with `from` equal to `the operator (verified sender)`. If the cue is
   absent, record that as a failed trial; the probe itself neither calls a model
   nor sends a message.
3. As Justin, send “and her birthday?” in the same chat. Confirm exactly one new
   PREVIEW reply refers to Priya and October 4, or truthfully asks for
   clarification. Run `inspect --root /ABSOLUTE/APPROVED_JOURNAL_ROOT` and confirm
   `last.lastNamedPerson.name` is `Priya`: this is the actual saved model prompt,
   rather than the earlier probe. Run `status --root /ABSOLUTE/APPROVED_JOURNAL_ROOT`
   and record call, reply, hold and reply-check counts.
4. Wait through one poll interval, run `status` again and verify no second reply
   or send intent appeared for either update. Send an unrelated message with no
   person name, such as “Thanks.” After its one reply, probe the next packet with
   `--text 'and her birthday?'`; confirm `next.lastNamedPerson` is `null`. No
   message should arrive except in response to Justin's three sends.

Record the two saved prompts, Telegram reply IDs, status counts and any hold or
UNKNOWN outcome in the desk result. API acceptance is evidence of a send, not
proof that Justin read it. If the first model reply omits the structured name,
the cue remains absent; preserve that result rather than editing the journal.
