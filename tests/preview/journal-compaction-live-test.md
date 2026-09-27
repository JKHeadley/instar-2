# Justin's live journal compaction test

Use the approved private preview runner and its existing grant. This is a supervised
durability check on a **copy** of its encrypted journal; the live journal is never
compacted by this script. No Telegram send or model call is needed.

1. As Justin, pause the runner with its usual signal and wait until its exclusive
   writer lease has exited. Record the following status and size. Keep the existing
   vault-to-host storage-key binding; do not print or paste it.

   ```sh
   node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root "$PREVIEW_ROOT"
   wc -c "$PREVIEW_ROOT/journal.encrypted"
   ```
2. Make a fresh private directory outside the live root, copy only
   `journal.encrypted` into it, and mark it as an isolated clone:

   ```sh
   umask 077
   CLONE_ROOT="$(mktemp -d /private/tmp/instar-compaction.XXXXXX)"
   cp "$PREVIEW_ROOT/journal.encrypted" "$CLONE_ROOT/journal.encrypted"
   touch "$CLONE_ROOT/.journal-compaction-clone"
   node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-compaction-probe.mjs "$CLONE_ROOT"
   ```

3. Require `result: "verified"`, unchanged cursor, turns, calls, replies, holds,
   UNKNOWN calls and sends, stop and summary reservations, and a readable compacted file. Compare
   the counters with the saved live `status`. Record the before and after byte
   counts. A small live trial may make the snapshot larger; the automatic path
   starts after 8 MiB and only runs again after the file doubles from its last
   snapshot size.
4. Resume the original runner on its original root. As Justin, send one ordinary
   message in the bound private chat and confirm exactly one PREVIEW reply and one
   new intake/reply in `status`. Confirm the copied journal's counters stay fixed.
   Preserve the live root and delete the isolated clone under the desk's normal
   trial-data handling.

The offline `journal-compaction.test.ts` suite kills a child at each write,
verification and replacement boundary; this live script checks replay of the
actual encrypted trial shape without mutating its active journal.
