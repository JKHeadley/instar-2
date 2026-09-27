# Packet pressure and needed-memory retention — Justin's live check

Use the already approved private journal preview and its existing credentials,
audience, limits and expiry after the desk installs this commit. Do not reset or
edit its encrypted journal, cap, activation, profile or running process. This
script grants no trial or cap raise.

1. From the checkout, run the model-free fixture:

   ```sh
   npx vitest run tests/preview/journal-packet-pressure-value.test.ts --configLoader=runner --testTimeout=120000
   ```

   Record the printed final-packet bytes and kept/dropped source numbers at the
   3,000, 3,500 and 4,000-byte limits. At 3,500, sources 100 and 200 should
   survive and sources 300, 400 and 500 should be omitted from `recalled`.

2. In the existing authorized private chat as Justin, ask about an earlier fact
   that was quoted in a recent accepted reply and a separate fact linked to an
   unanswered question already recorded in this journal. Use facts genuinely
   present in this trial; do not send secrets or invent a memory to make the
   check pass. If there is no such pair, record this live check as untested.

3. Run `status --root ROOT` and `inspect --root ROOT --update UPDATE_ID` through
   `journal-agent.mjs` with the existing storage-key binding. Compare the exact
   sent reply with its grounding index and the stored packet omissions. Check
   that the answer was sent once, that the expected source IDs are present in
   `recalled`, `people`, `commitments` or `channelItems` as applicable, and that
   omitted IDs are reported in `status.packet.dropped`. Record the prepared
   prompt bytes and its bound. A source merely offered in grounding is not
   proof that the model used or answered it correctly; read the reply itself.

4. Record the live result, including any source the next question needed that
   was absent. A packet that did not reach the byte bound cannot prove the
   pressure behavior; the offline fixture is the cap-specific evidence.
