# Renewal continuity live test for Justin

Use the existing approved private Telegram preview and the renewed activation. The builder does
not run this script. Coordinate with the desk so the runner is paused for any file copy; keep the
original journal and live runner untouched by compaction. Do not send a test message if the trial
is stopped, expired or at a cap.

1. Ask the desk for the saved reply or redacted `inspect` result for a specific fact Justin told
   the preview **before** the 2026-09-27 renewal. Record its original message date and wording.
   Read `status --root ROOT`; record `expires`, `expiryAuthority`, counters, holds and stop. The
   expiry should be `2026-10-05T20:40:00Z` (`1791232800000`).
2. As Justin in the same private chat, ask an ordinary memory question about that exact fact.
   Record the actual reply, its Telegram update and message IDs, and a redacted
   `inspect --root ROOT --text "YOUR QUESTION" --model MODEL` result. Confirm the answer keeps
   the pre-renewal fact and its source/date, without claiming new knowledge or losing a correction
   or forgetting marker. If the answer is held, record the hold rather than claiming recall.
3. Read `status` again. Check the effective expiry and authority are unchanged, the new intake
   appears once, and that update has at most one send intent and one Telegram acceptance. Compare
   counters with the actual call and send records; do not infer delivery from API acceptance.
4. With the runner paused and its writer lease free, the desk copies the encrypted journal and
   necessary non-secret status files to a new isolated root under the same authorized key custody.
   Run the read-only `status` and `inspect` commands against the copy, then compact **only the
   copy** with the existing journal API, reopen it and repeat them. Compare memory selection,
   expiry, authority, counters, holds, and stop before and after compaction. Keep the original
   journal byte-identical; resume the runner under the existing procedure.
5. For a later separately reviewed renewal, repeat steps 1–4. Never append a speculative future
   expiry to the live journal. The offline two-frame fixture in
   `journal-renewal-continuity.test.ts` covers multiple frames until such a live case exists.

Save the redacted replies, status output and copy comparison with the reviewed activation reference.
Do not include the storage key, provider credentials or private journal bytes in the evidence.
