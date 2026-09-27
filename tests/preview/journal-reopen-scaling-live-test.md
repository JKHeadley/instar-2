# Justin's journal reopen scaling check

After the reviewed build is installed, run this on the preview host as Justin.
Keep the live runner and its encrypted journal untouched by the benchmark. The
fixture uses a fixed throwaway key in a private temporary directory and deletes
it after each size. It makes no model call or Telegram send.

1. Record the current runner status using the normal, read-only status command.
   Keep the storage-key host binding private; do not print or paste it.

   ```sh
   node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root "$PREVIEW_ROOT"
   ```

2. From the installed repository root, run the three foreground measurements.
   Save the three JSON lines in the desk's trial record.

   ```sh
   node --expose-gc --no-warnings --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-reopen-benchmark.mjs 1000
   node --expose-gc --no-warnings --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-reopen-benchmark.mjs 10000
   node --expose-gc --no-warnings --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-reopen-benchmark.mjs 50000
   ```

3. Require 10k `rawMs` and `openMs` below 2000, and 10k
   `rawHeapDeltaMb` and `heapDeltaMb` below 128. Record all 50k time,
   heap and `peakRssMb` values, even if the 10k bounds pass. On a miss, retain
   the JSON and host load observation for review; do not reset the live journal.

4. Repeat the read-only status command. Its cursor, turns, calls, replies,
   summaries, holds and UNKNOWN counts should match step 1 except for any
   independently arriving live work. The benchmark itself must account for no
   live change. No cap raise, provider-policy change, send or live-journal
   compaction is part of this check.
