# Packet selection quality — live test as Justin

Run this after the desk lands the change, using Justin's bound account in the
approved private preview chat. The builder does not run this script or touch the
live runner. The desk records the current root, model, status and exact prompts.
Keep the existing grant, expiry, limits, Jev check and single runner. If caps
are too low, use only the existing authorized `raise-caps` procedure.

1. Check `status` for room for the trial and confirm no held turn or UNKNOWN
   send will be mistaken for this result. Choose synthetic facts that are not
   already in the journal. Send one turn each: `My trial passport is in the
   kitchen drawer.` and `My trial passport expires next spring.` Wait for each
   reply.
2. Send five unrelated dated trial notes, each with a distinct ISO date in the
   next fourteen days, such as `The trial bike check is on YYYY-MM-DD.` Wait for
   each reply. Do not include a real private code or location.
3. Continue the normal supervised trial until `status.summaryThrough` covers
   those seven turns. Do not exceed a cap to force summarization. If it does
   not happen within the available limits, record **incomplete**; selection
   against a summary has not been tested.
4. Run read-only `inspect --root ROOT --text "Where is my trial passport?"
   --model MODEL`. Check `next.historyMode` is `summary-plus-recent`, and its
   `next.sourceLabels.recalled` includes the drawer source label. The expiry
   turn may also appear for the shared subject. The five unrelated dated turns
   should not occupy recall slots. Record the labels; a reply alone cannot
   prove selection.
5. Ask the same question in the private chat. Check the answer against the
   recorded source, then inspect that turn's persisted prompt. It must still
   carry the drawer source, and `status.packet.bytes` must stay under its
   existing limit. Check one
   Telegram send intent and at most one accepted send. A held reply or UNKNOWN
   send is an incomplete result, never a reason to retry the same send.
6. Probe `What should I know about upcoming trial plans?` with read-only
   `inspect`. One nearby dated source should be offered. Record the selected
   labels and any omissions. Do not infer that absent items were
   forgotten; the selection is bounded.

Use the existing read-only commands with the desk's exact model:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root "$PREVIEW_ROOT"
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs inspect --root "$PREVIEW_ROOT" --text "Where is my trial passport?" --model "$PREVIEW_MODEL"
```

Pass requires summary-mode persisted packet evidence, the source-backed answer,
bounded bytes and unchanged secret, call-cap, stop, intake and one-send records.
This is a supervised user-channel proof, separate from the offline corpus.
