# People timeline: live check as Justin

Run this only in the approved private preview after this branch lands. Record the
actual Telegram replies and the read-only `status` and `inspect` output. Use the
existing runner and journal; this script does not authorize a second runner.

1. As Justin, check `status --root ROOT` for at least six turns, six replies and
   enough model calls for a rolling summary. Use the already recorded cap-raise
   authority if needed. Send these two separate private messages:

   - `Maya Chen told me the blue folder is for the autumn exhibit.`
   - `Yesterday I heard from Maya Chen that the exhibit opens in October, not November.`

2. Wait for both replies. Send the harmless filler from the existing people-memory
   live script until `status.summaryThrough` covers both messages and
   `summaryPending` is zero. Use `inspect --root ROOT --text "What have I heard
   about Maya Chen?" --model MODEL`. Its `next.historyMode` must be
   `summary-plus-recent`; `next.people` must show both dated source messages in
   order, each with its Telegram `sourceId` and `from: the operator (verified
   sender)`. The first message is Justin's report of Maya's words, not an
   authenticated message from Maya. Ask the same question in Telegram and check
   that distinction in the reply. If the model returned a plain summary with no
   person notes, record that as incomplete rather than inferring a pass.

3. For the imported side, have the desk use the already documented
   `import-fixture` procedure while the sole runner is paused. Use a verified
   agent-owned export with one harmless item whose source metadata says Maya
   sent it and one item sent by someone else that mentions Maya in its body.
   Resume the runner. As Justin, ask `What did Maya say, and what was said about
   her?` Check `inspect --text` and the persisted prompt: the `people` entries
   include each import's source ID, date, source, account and unverified export
   sender label. The reply must distinguish Maya's asserted message from the
   other sender's report. `status.channelItems` must include both imports. If
   no owned export is available, record this step as untested.

4. As Justin, send a direct correction of the harmless blue-folder fact, then
   ask about Maya again. Check `status.withheld`, `inspect.next.people`, and the
   reply: the old clause must be absent and the correction present. Send a
   direct forget request for the corrected fact and ask once more. Neither old
   nor corrected clause may reappear in `people`, `channelMemory`, or the reply.
   The original journal source remains counted. Record any pending memory
   decision or cap hold as incomplete.

5. Ask about an unrelated, unmentioned person. `inspect.next.people` should be
   empty; the reply must not invent a timeline. Record the exact observed
   outputs, including any ambiguity or omitted entry caused by the prompt cap.
