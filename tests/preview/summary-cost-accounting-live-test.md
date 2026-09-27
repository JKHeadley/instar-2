# Justin's supervised token accounting check

Use the already approved private-chat journal preview, its existing root and
activation, and the same vault-to-host bindings. This script grants no new
audience, cap, expiry, or model route. Do not inspect or alter the encrypted
journal by hand. Keep the live runner and its journal under desk custody.

1. Before sending, run the read-only command below against that root and save
   its JSON output. Check `limits`, `calls`, `tokens`, and `tokenTotal`; leave
   enough existing call and reply allowance for the trial. Each of the three
   token kinds starts at zero only on a fresh root. On an existing root, use
   differences from this baseline.

   ```sh
   node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root /ABSOLUTE/APPROVED_JOURNAL_ROOT
   ```

2. As Justin, send one ordinary message in the bound private chat:
   “In one sentence, what is Instar trying to preserve?” Wait for one PREVIEW
   answer. Run `status` again. `tokens.answer.calls` increases by one and its
   input/output totals increase. `tokens.replyCheck.calls` increases by at
   least one for Jev; it may increase by one more for a subscription review.
   Compare `lastReplyCheck.path` with that count. No new send should appear on
   another status read.

3. If the existing caps allow it, continue as Justin with short, distinct
   messages until `summaryThrough` advances. After that advance,
   `tokens.summary.calls` and its input/output totals increase; originals
   remain in the journal. Do not raise caps solely for this check. If there
   is insufficient allowance or no summary boundary is reached, record that
   as untested live summary evidence; the offline replay test covers it.

4. Pause the runner by its ordinary signal, wait for its writer lease to exit,
   and run `status` twice. The per-kind totals and `tokenTotal` must be identical
   to the last running status. Resume with the same approved command and root,
   then run `status` once more before sending anything. The totals must still
   match. For each snapshot, `tokenTotal` must equal the sum of the three kind
   rows for calls, input tokens, output tokens, and unmeasured calls.

5. Record the three status snapshots, the exact Justin messages, the Telegram
   message IDs, whether a summary frontier advanced, and any UNKNOWN count.
   An UNKNOWN or missing-usage call should retain its reserved input/output
   maximum in the totals and must not be retried. Do not induce a provider
   failure or stop an in-flight call just to create an UNKNOWN in this live
   trial; `journal-cost.test.ts` proves that branch offline.
