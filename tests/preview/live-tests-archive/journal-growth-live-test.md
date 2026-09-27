# Journal growth — Justin's supervised live check

This check starts only after the integration desk installs the reviewed build. It uses
the existing private preview and its existing grant. The builder does not run it.

1. Note the current journal byte size, accepted operator-turn count and journal root
   from the installed runner's `status`. Record the exact build commit. Do not copy
   or inspect the encrypted journal as plaintext.
2. Send three ordinary, distinct private messages to the preview bot. Include one
   dated fact, one correction or forgetting request, and a later question about that
   fact. Let the runner answer in its normal path; do not raise a cap for this test.
3. Run the installed `status` and read-only `inspect` commands against that same root.
   Check that the count rose by three, the corrected fact is withheld from the later
   recall view, the three outcomes and any UNKNOWN state are truthful, and the
   original question and reply remain attributable to their update IDs. A pending
   or UNKNOWN send must never be repeated to make this check pass.
4. Record the new journal byte size and compute `(new bytes - old bytes) / 3`.
   This small live sample is a smoke check; the 37-turn synthetic regression is the
   byte-budget gate. If the live delta is over 8 KiB per turn, capture only the two
   sizes, turn IDs and `status` output for diagnosis, not journal contents.

No deploy, restart, compaction command or live-journal mutation is part of these
instructions beyond the operator's three normal messages.
