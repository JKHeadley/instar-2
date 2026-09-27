# Journal upgrade live check — Justin

Use this immediately before and after a supervised preview runner switch. The
offline check below uses disposable fixture roots. The live steps use a copy of
the runner's journal; keep the live runner and its journal untouched until the
approved switch procedure reaches its stop and install step.

1. In the candidate checkout, run `npx vitest run tests/preview/journal-upgrade-compat.test.ts --configLoader=runner --maxWorkers=1`. Require the single test to pass. Run `node scripts/check-architecture.mjs` and require exit 0. Record the candidate commit and both command outputs.
2. While the existing runner is still the only writer, run `node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root LIVE_ROOT` from its checkout using the existing host storage-key binding. Record the effective expiry, cursor, caps and usage, held updates, UNKNOWN calls and sends, summary frontier, memory-health line, and `modelJsonShapes`. Do not paste the secret or raw journal into a report.
3. After the existing runner is stopped by the supervised switch procedure, copy `journal.encrypted`, `runs.jsonl`, and `model-json-shapes.json` into a private, mode-0700 scratch root on the same host. Copy any other read-only status sidecars the preview root uses. Do not point the candidate writer at the live root during this check.
4. With the candidate checkout and the same host storage-key binding, run `node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root SCRATCH_ROOT` and `node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs inspect --root SCRATCH_ROOT --text "Where does Sam keep the cedar map?" --model REVIEWED_MODEL` (replace the example question with a harmless question tied to a known retained fact). Compare status fields with step 2; no cursor, cap, expiry, summary, hold, UNKNOWN, or sidecar count may disappear. Inspect must show the expected retained evidence without an older corrected or forgotten claim resurfacing. Confirm the scratch journal SHA-256 is unchanged. A mismatch or read error stops the switch; keep the existing build and journal pair together.
5. At the approved switch point, start the candidate with the existing reviewed activation, login profile, model, caps and host bindings. Do not change provider policy, `maxTokens`, or any invocation-policy digest input. Ask one harmless private-chat question about a retained fact. Record the exact reply, the following status, and an inspect view. Require one answer and at most one Telegram send intent/receipt for that update, the expected cursor advance, and no new UNKNOWN or unexpected hold. A wrong or missing answer stops the switch and preserves the journal for diagnosis; never restart an older writer on the updated journal without a proven reader check.
6. Attach the offline result, redacted before/after status, scratch digest comparison, and first live answer to the switch record. Report a failed check as failed; the offline fixture alone does not prove the live channel.

The scratch root and fixture are machine-local copies. They are not a second
writer or a replication claim. Keep scratch material under the same access
controls as the live journal and remove it under the operator's retention
procedure after the evidence is recorded.
