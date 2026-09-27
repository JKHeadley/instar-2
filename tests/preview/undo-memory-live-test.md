# Undo memory: supervised private preview test for Justin

Use the existing approved private Telegram journal runner and its existing root.
Keep its grant, bot, audience, expiry and limits. This script does not start,
stop or edit the runner. Check `status` for at least twelve model calls, ten
replies and ten turns of room; use the recorded `raise-caps` authority if needed.
Record the actual replies and pull views. A held turn or absent memory decision
is incomplete evidence.

1. Send `Shorter please.` Confirm `inspect --text "How will you answer?"`
   shows that active preference. Within ten minutes, send `Undo that.` Confirm
   one reply, one new `status.undos` entry, and no active preference in the next
   inspect view. Send `Undo that again.` Confirm a truthful refusal and no second
   undo entry. The original preference turn remains in `status.turns`.
2. Send `My project codename is silver kite.` Confirm the fact is in the next
   packet. Send `Forget my project codename.` Confirm the clause is withheld.
   Within ten minutes, send `Undo that.` Confirm the exact original clause is
   available again and the undo count rises by one. The forget action and undo
   remain in the journal; no duplicate Telegram reply appears.
3. Send `Actually, my project codename is blue kite.` Confirm the old fact is
   withheld and the replacement is active. Within ten minutes, send `Undo that.`
   Confirm the original clause is again available and the replacement is
   withheld. Ask `What is my project codename?` and check the answer against the
   inspect packet.
4. Send `My dentist visit is tomorrow.` Confirm `status.dated` records the
   clause and interpreted day. Within ten minutes, send `Undo that.` Confirm
   the item disappears from `status.dated`, the next packet's dated list, and
   the next answer. The original operator turn remains in the journal.
5. For the time boundary, record a new preference, wait more than ten minutes
   after its journaled decision, then send `Undo that.` Confirm the old
   preference remains active, no new undo entry appears and the runner gives a
   truthful refusal. Stay inside the trial's expiry and caps; otherwise record
   the visible hold as incomplete evidence. A message from another sender is
   refused by the existing private-chat intake and is never a safe live test on
   this bound operator chat; the offline test covers that side.

Use `node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs
status --root /ABSOLUTE/ROOT --time-zone YOUR_ZONE` for the pull view. Use the
same launcher with `inspect --root /ABSOLUTE/ROOT --time-zone YOUR_ZONE --text
"What do you remember?" --model DESK_EXACT_MODEL` for a read-only next packet.
Keep the existing storage-key host binding; never put its value in a command.
