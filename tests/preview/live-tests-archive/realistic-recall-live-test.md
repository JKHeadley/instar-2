# Realistic recall — live test as Justin

Use the existing authorized private preview chat only after the desk lands this
build and resumes its single runner. The builder does not run this script. Save
`journal-agent.mjs status --root ROOT` first; confirm stop and expiry allow work
and at least 12 turns, 20 calls and 12 replies remain. Use the desk's existing
recorded cap-raise path if needed. Do not send a secret or a real access code.

1. Send `Mira school pickup is at the west gate.` Wait for its reply. Send short
   ordinary planning messages until `status.summaryThrough` covers that turn.
2. Send `Which gate is Mira school pickup at?` and record the reply. Then send
   `One second, the kettle is whistling.` and wait for its reply. Send `Where do
   I get her after class?` Record the reply and persisted `inspect --root ROOT`
   packet for that question. The packet should contain the original west-gate
   operator message in `recalled` or `history`, with its source ID. The reply
   should identify the west gate without inventing another location.
3. Send `The grocery pickup window is 17:40.` Then send `Actually, the grocery
   pickup window is 18:10.` Wait for the correction decision. Ask `When is the
   grocery pickup window?` The reply and its persisted packet should use 18:10
   and exclude 17:40. Check `status.withheld` for the old source.
4. Send `The parcel return label is in the kitchen drawer.` Then send `Forget
   The parcel return label is in the kitchen drawer.` Wait for the decision.
   Ask `Where is the parcel return label?` The reply must not reveal the drawer;
   its persisted packet must exclude the forgotten clause.
5. Save final `status`, the actual replies, the three persisted question packets
   and their byte counts. A missing source, stale clause, held correction,
   exhausted cap, or unknown call is a failed or incomplete observation. This
   real-model Telegram result is separate from the offline packet score.
