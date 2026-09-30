# Memory export: Justin's supervised live check

Use the existing approved private preview chat and root after the desk lands this
change. Keep the runner's grant, audience, expiry and limits unchanged. This
script does not authorize a new trial or any mailbox access.

1. As Justin, send a harmless person note and preference: “Maya prefers short
   summaries. Please answer me briefly.” Wait for the existing runner's reply
   and memory decision. If the installed runner has no preference projection,
   record `Preferences (0)` as its actual state.
2. Send a harmless dated item, such as “Review the outline tomorrow.” Wait for
   its reply. If the installed runner has no dated projection, record
   `Dated items (0)` as its actual state.
3. Send “My test marker is CEDAR-4412,” then “Actually my test marker is
   MAPLE-7730, not CEDAR-4412.” Wait until the existing correction path has
   decided the request. Send “Forget my test marker.” Wait for its decision.
   Do not use a real password, credential, access code or private fact.
4. Run `export-memory --root ROOT` with the existing storage-key host binding.
   Save the report only in operator-controlled trial custody. Check that it
   includes source references for the person note and any active dated or
   preference entries, a forgotten marker with source and request updates, and
   **neither test-marker value** anywhere. Check the byte count is at most 16384.
5. Repeat the export and compare bytes. Run `status` and verify the cursor,
   calls, replies, turns and channel-item count did not change because of the
   exports. Restart the runner normally, export once more, and check the same
   markers and sources. Record the actual reports and status outputs as the live
   trace. An unresolved memory decision is an incomplete result, not a pass.

No live runner, journal, Telegram, model or mailbox operation is performed by
the offline builder tests for this command.
