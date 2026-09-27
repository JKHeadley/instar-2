# Justin's live build-handoff continuity script

Run this only on a newly reviewed, isolated private-chat trial with its own bot,
activation, finite caps and root. Keep the frozen live runner and its journal
untouched. The desk records the exact old and candidate build commit IDs and uses
the `journal-agent.mjs run` command in [README.md](../README.md#structural-journal-runner-rounds-1013)
with the same trial root, activation, model, caps and storage-key binding for each
start. The candidate must keep the existing invocation policy digest inputs.

1. As Justin, send a short memory fact and a preference, then ask a question the
   runner cannot yet answer. Ask it to remember one concrete commitment. Record
   each Telegram update ID and exact reply. The desk records `status` and
   `inspect --root ROOT --text "What do you remember and what remains open?"
   --model MODEL`, including cursor, pending and held turns, memory, open
   commitments and questions, and summary frontier.
2. Send one further question. The desk stops **only this trial process** while it
   is handling that conversation, waits for its writer lease to exit, and saves
   `status`, `inspect`, and the journal byte count. If the stop leaves a model
   reservation or send intent without a result, mark it UNKNOWN. Do not retry
   that effect by hand.
3. Start the candidate build on the same trial root. Before new input, compare
   `status` and `inspect` with the saved state: cursor, pending turns, held turns,
   memory projection, open commitments and questions, and summaries must agree.
   Any UNKNOWN call or send stays UNKNOWN. As Justin, send a fresh question about
   the first fact; record its exact reply. Confirm one accepted intake and at most
   one physical Telegram send per update, including the interrupted update.
4. Stop the trial candidate and wait for its lease to exit. Make a private copy
   of its quiescent journal, mark that copy `.journal-compaction-clone`, and run
   [journal-compaction-probe.mjs](../journal-compaction-probe.mjs) on the copy with
   the same host storage-key binding. Require `result: "verified"`. Compare the
   copied projection with the source `status`; retain both before and after byte
   counts. While the isolated trial stays stopped, copy the verified compacted
   journal to a temporary name in that trial root and rename it over its
   `journal.encrypted`. Record `status` again and require the same projection.
   Restart the candidate on that same isolated trial root, then
   ask one more question about the first fact and open work. Confirm the answer,
   cursor, held turns, memory, commitments, questions, and summaries still agree
   with the pre-restart record plus the new turn. No earlier reply appears twice.

The verified snapshot and restarted trial prove continued use of the same
causal journal. The offline `journal-handoff.test.ts` test separately
uses a SIGKILL after a durable send intent, checks both UNKNOWN fences, and
continues after compaction. For an old-to-new source test, set
`PREVIEW_OLD_JOURNAL_MODULE` to the `file:///.../tests/preview/journal.js` URL
and `PREVIEW_OLD_LAUNCHER` to the absolute `journal-agent.mjs` path of an
archived `56fe0b7c` tree containing `tests/preview`, `src` and `scripts` before
running that one test file. Preserve the
trial trace for the desk. This script does not itself authorize a deploy.
