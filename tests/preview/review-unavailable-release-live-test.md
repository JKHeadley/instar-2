# Review-unavailable release (Rule 86): supervised live script as Justin

Use the desk-approved journal preview bot, root, activation, private chat,
expiry and limits. This script changes no grant, credential, cap or live journal.
The offline proof is `review-unavailable-release.test.ts`; it is not evidence
that a real Telegram reply arrived.

1. As Justin, in the bound private chat, send ordinary requests that tend to draw
   a non-secret Jev flag, for example: "Remind me on Friday at 9 to call the
   dentist" and "Can you finish the packing list for me?". Note Telegram times
   and update IDs.
2. Run `status`. For any turn whose last reply check is `subscription` /
   `unavailable` after a completed Jev check that flagged only non-secret rules,
   confirm the reply arrived exactly once in Telegram and that
   `reviewUnavailableReleases.byRule` counts each flagged rule once. Confirm no
   `reply check unavailable` hold exists for that turn.
3. Restart the same authorized runner once and run `status` again. Confirm the
   counter is unchanged, no second reply arrived, and `calls` did not grow for
   that turn (the failed review was not repeated).
4. Control, secrets exception: do not paste a real secret. If the desk has a
   recorded turn where Jev flagged `credential` and the review failed, confirm it
   is still held as `reply check unavailable` and is not counted.
5. Control, review verdict: for a turn where the review returned an actual
   VIOLATION, confirm the holding reply was sent instead of the candidate.
6. If no turn naturally hits a review failure during the window, record that;
   do not create one by editing the encrypted journal or the runner.
7. Record update IDs and times, the counter before and after restart, Telegram
   message IDs, and any held turns with their reasons. Keep secrets and raw
   message bodies out of the report.
