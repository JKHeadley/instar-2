# Live test: desk probe turns stay out of memory

Justin runs this in the existing approved private preview chat after the desk
lands the build and resumes its existing journal runner. Keep the recorded bot,
chat, grant, expiry, model and limits. Check `status` first for room for four
turns, four model calls and four replies. Use the existing `raise-caps`
procedure if the approved trial needs more room. Do not use a real secret as a
test fact.

1. As Justin, send: “Build check 0000abcd: my test marker is Heron. What is my
   test marker?” Wait for the single PREVIEW reply. It should name Heron: a
   probe is still answered from its own message. Run `status`; the turn is
   counted and has exactly one reply.
2. Send an ordinary message that shares a probe word: “My cousin Heron is
   visiting next week.” Wait for one reply.
3. Run the read-only check below with `--text "What do you remember about
   Heron?"`. In `next`, the ordinary message from step 2 should appear, and
   no part of `next` should contain “test marker” or “Build check 0000abcd”.
   Repeat with `--text "What did I tell you today?"`; the period recap should
   list step 2 but not step 1.
4. Send: “What do you remember about Heron?” Wait for one reply. It should talk
   about the cousin, not a test marker. Use Telegram **Reply** on the step 1
   PREVIEW reply and ask: “What did this message answer?” The reply reference
   should still resolve to the probe exchange, because the probe stays in the
   journal for audit.
5. Run `status` and confirm one reply per accepted turn, no duplicate Telegram
   sends, no unexpected holds, no new preference or dated item from step 1,
   and call and reply counts within the trial caps. Save redacted inspect and
   status output and the observed Telegram results as evidence.

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs inspect --root "$PREVIEW_ROOT" --text "What do you remember about Heron?" --model "$PREVIEW_MODEL"
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root "$PREVIEW_ROOT"
```

This is a supervised operator-channel check. A held turn is an incomplete
result to record, not a pass. A real model may still mention a probe it can see
in a summary written before this build; note that separately.
