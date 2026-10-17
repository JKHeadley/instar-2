# Answer provenance live test — Justin

Use the already approved, private journal preview root and its unchanged trial,
activation, bot, expiry, and caps. Keep the preview runner supervised. Use the
existing host bindings for its storage, Telegram, and Jev credentials; do not
put values in a command, packet, or test note. Do not use the production runner.

1. As Justin, send a fresh, nonsensitive fact in the private chat: “Remember:
   the test lantern is stored in the blue cabinet.” Wait for the single PREVIEW
   reply. In the same chat or a private topic, ask: “Where did I say the test
   lantern is stored? Cite the source.” Record the reply verbatim.
2. Run the read-only probe from the repository with the existing storage-key
   host binding:

   ```sh
   node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs inspect \
     --root /ABSOLUTE/APPROVED_ROOT --model DESK_EXACT_CLAUDE_MODEL_ID \
     --text 'Where did I say the test lantern is stored?'
   ```

   Check that `next.sourceLabels.history` or `next.sourceLabels.recalled` has a label naming
   `conversation:operator`, its conversation, Telegram date, and update number.
   Check that the answer cites that label or clearly states its source. A reply
   that states the fact without a source is a model behavior finding.
3. If the approved trial has room, send unrelated short turns until a summary
   covers the fact, then ask again. Inspect `next.sourceLabels`: the selected
   original has its own label if recalled; otherwise `summary` has a `summary:` label.
   Record whether the answer identifies the summary as its source rather than
   presenting a summary as a direct quote. Do not raise caps solely for this test.
4. Run `node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root /ABSOLUTE/APPROVED_ROOT`
   with the existing storage-key host binding. Record `answerProvenance.unlabeledRecallReplies`,
   reply count, reply-check path, and UNKNOWN sends. Restart only through the
   approved supervised procedure, then read status again: the provenance count
   must be unchanged. No second Telegram reply may appear for an old update.

The offline preview tests inject an unlabeled legacy packet to prove the positive
signal. This live path should normally keep the counter at zero because its
packet entries are labelled. A zero does not prove the model cited its sources;
the recorded reply and packet answer that question.

## Claim evidence wording

Every answer carries the evidence guidance from `answer-provenance.ts` through the
existing standing instructions, including tool answers and answers after compaction.
The existing contextual `self_state_claim` question also advises on unsupported or
uncertain completion/fact claims, and its revision prompt carries the same guidance.
The model judges support against the packet's sources and recorded outcomes. A source
label or an earlier assertion is not independent verification. This adds no model call,
claim parser, store, external source verification, or blocking gate. A Jev-only pass still
uses the answer guidance; contextual review coverage and its unavailable fail direction
are unchanged. Recorded guidance findings remain measurable through `guidanceReport`.

For the proof room, ask about the same operation with (a) no result record, (b) a
successful result record, and (c) an uncertain result record. Include a terse completion
draft and a factual claim. The delivered reply should respectively use one short
unverified clause, state the supported result plainly, or express uncertainty. Greetings,
thanks, questions and quoted hypotheticals must remain unannotated. Check both the
Jev-clear path and an existing contextual review/revision, then a tool answer and a
post-compaction answer. Keep update ids, prompt/answer/revision records, send intent and
transport receipt. Re-drain and confirm one send. Offline tests exercise recorded reviewer
and worker shapes; they do not certify fresh-model behavior or live delivery.
