# People merge: Justin's private-chat live check

Run only after the desk lands this branch and resumes the existing preview
runner on its existing root. Do not start a second runner or reset its journal.
Check `status` first for at least 16 turns, 16 replies, and 18 calls of
room; use the recorded `raise-caps` authority if needed. Record the actual
messages, status, and inspect output. This branch does not claim a live result.

1. From Justin's bound Telegram account, send: `My cofounder Sam wants the launch in October.`
2. Send: `Sam Ortiz is my cofounder and proposed the October launch.`
3. Send: `Sam Ruiz, my neighbour, lent me a ladder.` Wait for each reply.
4. Send the README's people-memory filler until `status` shows a summary with
   person notes for Sam, Sam Ortiz, and Sam Ruiz. Stop if the attempt cap or a
   summary hold prevents this; record the hold as an incomplete result.
5. Run `inspect --root ROOT --text "Are Sam and Sam Ortiz the same person?" --model MODEL`.
   The `next` packet must show both source notes and a `personMergeCandidates`
   pair for Sam and Sam Ortiz. It may also propose Sam and Sam Ruiz; that is
   still only a question. `status.personMerges` must be empty for these notes.
6. Ask in Telegram: `Are Sam and Sam Ortiz the same person?` The reply must ask
   Justin to clarify or state uncertainty. `status.personMerges` must still
   have no link for these notes.
7. From Justin's bound account, send: `Actually, Sam and Sam Ortiz are the same person.`
   The reply should acknowledge only that pair. `status.personMerges` must list
   the two exact source update IDs and this confirmation update. A missing link
   or a visible memory-correction hold is a failed or incomplete live result.
8. Run `inspect --root ROOT --text "What does Ortiz think about the launch?" --model MODEL`.
   Its `next.people` must include both the cofounder Sam note and the Sam Ortiz
   note, and `next.personMerges` must identify their exact sources. Sam Ruiz
   must not be in that confirmed link. Ask the same question in Telegram; the
   reply should attribute the October view to Justin's reports, not claim Sam
   spoke to the agent.
9. Pause and resume the same runner with the desk's normal procedure. Repeat
   step 8. The confirmed link must survive replay. Ask about Sam Ruiz's ladder;
   it must remain a separate, sourced note.

Do not send a confirmation from another account as a test. The offline tests
cover that rejection without touching the live chat.
