# Journal audit live test (Justin, desk)

Use the already authorized private preview runner and its existing root. This
script grants no new send, model, mailbox or cap authority. The desk runs each
command with its existing storage-key host binding. Keep the JSON report local:
it contains source IDs, account metadata and the private chat identifier, but
no message bodies. Record each exit code and report with the actual Telegram
reply and `status` output. A hold or exhausted cap is an incomplete live test,
not a pass.

1. Run `journal-agent.mjs status --root ROOT` and the command below. Record the
   initial `modelCall`, `update`, item kinds and findings. It must exit 0 if a
   saved model packet exists and is consistent. A legacy call with no packet
   must exit nonzero with `recorded-prompt-absent`.
2. As Justin in the bound private Telegram chat, send a distinctive ordinary
   fact about a person, for example `Sam keeps the blue sketchbook in the
   studio.` Wait for the one PREVIEW reply. Ask a related question in the same
   chat, then run the audit. Its latest answer packet must list the first turn
   as `history-turn` or `recalled-turn`, with that source turn ID. The report
   must contain neither the sketchbook sentence nor the answer body.
3. Let the existing rolling summary cover that first turn under the approved
   attempt limit. Ask about Sam again and run the audit. Expect a `summary`
   chain to the covered turn, plus an attributed `people-note` if the summary
   recorded one. Check the report's `source-turn` ID against `inspect` and the
   journal's accepted update. If the summarizer produced no person note, record
   that fact as incomplete people-note evidence; do not invent one.
4. As Justin, correct that fact with a new exact clause, for example `Actually,
   Sam keeps the green sketchbook in the studio.` Wait for the reply and any
   pending summary. Ask what is now known, then run the audit. Expect a
   `corrected` chain naming both original and correcting turn, exit 0, and no
   old clause in the persisted answer packet shown by `inspect`. The audit
   report itself must contain neither clause. If the memory request remains
   pending, record the hold and do not claim a correction pass.
5. As Justin, ask to forget the corrected sketchbook fact. After the runner
   records the forget and another question receives a reply, run the audit.
   Expect a `forgotten` chain, exit 0, and no forgotten clause in the packet.
   Check `status.withheld` for the same source and operator update. The old
   journal intake must remain present; no source item is deleted.
6. With the sole runner paused by its documented signal and the existing
   operator-approved agent-owned export, import one channel item by the README
   fixture route, then resume. Ask a question related to that item and run the
   audit. Expect `channel-import` with a stable source-key digest for the export
   item, and no
   body text. A missing quote in a bounded packet is not evidence that the
   import was lost: confirm `status.channelItems` and record an incomplete
   selection result.

The desk should compare each report to the persisted `inspect` view and record
PASS only when the IDs, sender attribution, correction/forget chain, zero
findings, and no-body output all agree. This branch's offline tests do not
claim that Justin has run this live script.
