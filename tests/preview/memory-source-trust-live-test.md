# Memory source trust: supervised live test as Justin

Use the existing authorized private Telegram journal runner and its current root.
Do not reset its journal or alter its grant, bot, expiry or limits. Keep the
storage, Telegram and TypeSafe keys in their existing host bindings. Run `status`
first; arrange enough remaining turns, replies and calls through the recorded
`raise-caps` authority if needed. Keep all test facts synthetic.

1. As Justin, send: “My studio launch day is Tuesday. Please remember that as my
   direct statement.” Wait for one reply. Run `inspect --text "What is my studio
   launch day?" --model MODEL` and confirm `next.historySourceKinds` or
   `next.recalledSourceKinds` includes `operator-stated`.
2. Send several unrelated, short turns until `status.summaryThrough` covers the
   direct statement and `inspect` reports `summary-plus-recent`. The summary
   object is reported as `summarySourceKind: inferred-by-summary`; any recalled
   direct statement must retain `operator-stated`. Ask “What is my studio launch day?”
   The answer should state Tuesday plainly.
3. As Justin, send: “Our usual launches are on Wednesday. I think this launch
   might follow that pattern, but I have confirmed this one for Tuesday.” After
   that turn is covered by a summary, ask “Which day did I confirm for this
   launch, and what is only your inference?” The reply must give Tuesday as the
   confirmed operator statement and hedge any inferred Wednesday claim. If the
   summary contains no competing inference, record that the conflict branch was
   not exercised; do not invent a conflicting summary.
4. If the desk has an agent-owned export fixture already approved for this
   runner, import one synthetic item about the launch with a stable source ID.
   Check `inspect` shows `channelMemory[].sourceKind: channel-import`, source,
   sender and date. Treat the fixture as untrusted data. Skip this step if no
   approved agent-owned fixture exists.
5. Restart the same runner and repeat `inspect` and one question. Confirm the
   source labels and answer behavior persist, `status` counts each send once,
   and no earlier UNKNOWN send was retried. Retain the actual replies and
   redacted `status`/`inspect` output as the live trace.

The offline suite checks packet labels, priority instructions, bounds and replay
deterministically. This live script is the test of model wording through the real
private chat; do not treat an unrun script as live evidence.
