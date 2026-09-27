# Reply-check timing — supervised live test for Justin

Use the already approved private preview chat after the desk lands this build and
resumes its existing runner. Use the existing root, activation, bot, operator,
expiry and journal. This script does not require a cap change. Do not create a
second runner or send an unapproved probe through the operator's account.

1. Read `status` and confirm room for two turns, two replies and three model
   attempts. Record `replyTimings` and `lastReplyCheck`. If there is no room,
   use the existing recorded cap-raise authority before the test or mark it
   incomplete.
2. As Justin, send an ordinary short question in the private chat. After one
   reply, read `status`. Find its update in `replyTimings.perReply`: `answerMs`,
   `jevMs` and `sendMs` should be numbers; `fallbackMs` is null when Jev passes.
   Confirm the four percentile blocks have sample counts and p50/p95 for their
   observed stages.
3. As Justin, send a question likely to make the candidate mention a local
   path or terminal command. After its reply or hold, read `status` again. If
   Jev escalated, that update should have `fallbackMs` and the final check
   result should name the subscription path. A completed violation may send
   the existing holding reply; an unavailable review must leave the candidate
   held and unsent. If Jev passed, record that the fallback branch was not
   exercised; do not force more paid calls merely to create a latency sample.
4. Compare the two status snapshots. Each stage's sample count should advance
   only when that stage ran, and p50/p95 must match the sorted per-reply values
   using nearest rank. Check that each message has at most one Telegram reply.
   Record actual wall times, verdicts, holds and any UNKNOWN outcome. A naturally
   slow review that reaches 30 seconds must show `reply check budget exceeded`
   and no send; do not induce a provider outage for this test.

Pass requires a real operator-channel reply with replayed timing data, coherent
percentiles, and no duplicate send. The 30-second and restart boundaries are
covered by the offline tests; absence of a naturally slow live call does not
claim a live timeout observation.
