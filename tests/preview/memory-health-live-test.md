# Memory-health live check — Justin

Run this only after the desk lands this revision and resumes the single authorized
private preview runner on its existing root. Use that runner's existing grant and
private operator chat. This script does not import fixtures, change caps, restart
the runner, or touch its journal directly.

1. From the installed worktree, record the read-only baseline:

   ```sh
   node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root /ABSOLUTE/EXISTING_ROOT
   ```

   Save `memoryHealth`, `self`, `summaryThrough`, `holds`, `withheld`, `unknownCalls`,
   `unknownSends`, `channelItems`, `calls`, `replies`, and `limits`. Confirm the
   same `Memory health:` line appears in `self` and `memoryHealth`. The line must
   contain only counts and the latest summary update ID; no remembered text.
   Its held-turn count must equal `holds.length`; withheld-item count must equal
   `withheld.length`. Its channel-import cursor count is zero for this fixture
   importer; `channelItems` is an item count, and `cursor` is Telegram's intake
   cursor, not a channel cursor. Check the UNKNOWN turn-call and send counts
   against `unknownCalls` and `unknownSends`; a pending summary reservation is
   separately labelled "in flight or UNKNOWN".

2. If the recorded caps leave room for at least one model attempt, one reply and
   one turn, ask in the bound private chat: `How is your memory? Give the named
   counts from your Memory health line, and say what any unknown outcome means.`
   Save the exact reply. It should name held turns, summaries and covered turns,
   original-turn and channel-item recall hits, withheld items, unresolved memory
   corrections, channel-import cursors, and UNKNOWN or in-flight outcomes. It
   must not turn an UNKNOWN send into a delivered claim or a missing channel
   cursor into an invented offset. The self-state in its prompt includes this
   inbound message but precedes its own model reservation and reply, so compare
   the reply with that timing in mind.

3. Run the same read-only `status` command again. Record `memoryHealth` and
   `self`. Counts should reflect this new turn and any durable outcome. A reply
   that Telegram accepted increases the ordinary reply count, while memory
   health remains a bounded, content-free line. If a summary completed in the
   interval, its covered-turn count may advance; verify it equals the number of
   accepted journal turns at or below the new `summaryThrough` in an authorized
   offline inspection. Do not infer coverage from the numeric update ID alone.

4. If an earlier fact is already covered by a summary and sufficient caps remain,
   use the documented `inspect --text "<question about that fact>" --model MODEL`
   probe to find a question with a nonzero `recalled` or `channelMemory` selection.
   Send that question once in the private chat, then check that the corresponding
   hit count in `status.memoryHealth` increased after its model reservation.
   A selected hit is evidence offered to the model, not proof that the answer
   used it correctly. Leave the live UNKNOWN paths unprovoked; the offline tests
   cover positive UNKNOWN counts and replay.

Record the commands, timestamps, actual reply, before/after status objects and
any mismatch for the desk. A missing cap slot or absent covered fact is an
incomplete live check, not a passing result.
