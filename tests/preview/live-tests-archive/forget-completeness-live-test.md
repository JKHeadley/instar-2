# Forget completeness: Justin's private preview script

Run this only after the desk lands the build in the authorized private preview
trial. This is a procedure for Justin, not a claim that a live test ran. Use the
same bot, grant, model, storage-key host binding and single runner. Keep the
actual replies and local `status` and `inspect` output as the trace. Allow enough
of the existing caps for six turns, six replies, and several answer and summary
calls; if a cap is reached, record the hold and use only the already authorized
`raise-caps` route.

1. As Justin, send `My archive code is ORBIT-7319.` Ask `What is my archive
   code?` The private reply should say `ORBIT-7319`. Record `inspect --root ROOT
   --text "What is my archive code?" --model MODEL` and confirm the original
   clause is available before correction.
2. Send `Actually, my archive code is NOVA-4826.` Wait for the memory decision
   and reply. Check `status --root ROOT`: `withheld` should identify the first
   turn and this correction. If the decision is pending, record the hold and
   stop this trace; do not treat a pending decision as forgetting.
3. Ask `What is my archive code?` The answer should use `NOVA-4826`. Probe with
   `inspect --root ROOT --text "My archive code is CANDIDATE-0000." --model
   MODEL`; check the projected history, `memoryCandidates`, any contradiction
   hint and summary fields for absence of `ORBIT-7319` and presence of the
   corrected value. Wait for a covering summary, restart the same runner
   normally, and repeat the probe. Record any summary or reviewer hold.
4. For the import side, pause the sole runner and wait for its writer lease to
   exit. Use the existing `import-fixture` command from the structural runner
   README on a verified agent-owned JSONL export. Include one row whose text is
   `The archive key is EMBER-5941.`, with `EMBER-5941` also in its subject,
   conversation, sender label and stable ID, plus one unrelated row. Resume the
   same root. Ask about the archive key; confirm the imported row is available
   and marked as export data before forgetting.
5. As Justin, send `Please forget this fact: The archive key is EMBER-5941.`
   Wait for a recorded forget decision. Ask about the archive key and probe with
   `inspect --root ROOT --text "The archive key is CANDIDATE-0000." --model
   MODEL`. No displayed model packet field, imported metadata, memory candidate,
   contradiction hint or summary may contain `EMBER-5941`; the unrelated row
   remains available. Wait for a covering summary, restart and repeat the
   probe. Record `status.withheld`, `summaryThrough`, holds and the actual
   reply. A pending or UNKNOWN model outcome is incomplete evidence, not a pass.

The test uses only the operator's private preview chat and the existing
machine-local journal. It does not reset a cap, retry an UNKNOWN call or send,
touch the frozen live root, or treat Telegram API acceptance as human receipt.
