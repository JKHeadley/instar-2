# Dated items: Justin's supervised private-chat spot-check

After the desk lands this revision, use the authorized private preview as Justin.
Keep its existing root, grant, audience, expiry and bounds. Check `status` for at
least twelve turns, calls and replies of room before sending. This script does not
authorize a cap raise or a change to the running journal. Save the actual replies
and the read-only `status` and `inspect` output as the trace. The 200-item,
60-day simulation is the offline `journal-dated-soak.test.ts`; do not inject its
synthetic identities or dates into the live journal.

1. Note the local day and IANA zone from `status.self`. Send: `My package pickup is
   today.` Then ask: `What is on today?` The reply should name the pickup and its
   absolute local date. Inspect that question's saved packet: `datedScope` should
   be that one day, `dated` should contain the pickup, and `moreDated` should be zero.
2. Send: `My permit review is tomorrow.` Ask: `What is on tomorrow?` Check the
   following local calendar date in the reply and packet. The pickup should not
   appear in the scoped `dated` list.
3. Send: `My weekly planning call is every Monday.` Ask: `What is on next week?`
   Check `datedScope` is the following Monday through Sunday, and the call appears
   on that Monday with `repeat: weekly`. Check the reply names the date and does
   not claim to have scheduled a reminder.
4. Send: `Actually, the permit review is on Friday of next week.` Because that
   phrase is unsupported, record any unresolved date rather than treating it as
   a saved absolute day. Then send a correction with the exact `YYYY-MM-DD` date
   of that Friday. Check the old tomorrow clause is withheld and the new date
   appears only in the appropriate scoped question. Send: `Cancel my package
   pickup; forget that date.` Check it is absent from the next today packet while
   the original turn remains in the journal.
5. For travel, use a separately authorized runner restart with `--time-zone`
   set to the destination IANA zone; do not edit a journal or wall clock. Repeat
   a `tomorrow` and `next week` question, and check each packet's `datedScope`
   uses the destination zone while previously recorded items keep their original
   zones. Record any disagreement as a miss.

Read-only commands (using the desk's existing model ID and root):

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root /ABSOLUTE/ROOT --time-zone YOUR_ZONE
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs inspect --root /ABSOLUTE/ROOT --time-zone YOUR_ZONE --text "What is on next week?" --model DESK_EXACT_MODEL
```

The saved `inspect.last` packet is the evidence for a sent question. `inspect.next`
is a read-only proposed packet. A held answer, a positive `moreDated`, or an
incorrect reply is incomplete or failed evidence, even if the packet selection
was otherwise correct. The preview must send no unsolicited reminder.
