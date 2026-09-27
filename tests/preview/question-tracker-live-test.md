# Open questions — supervised live script for Justin

Use the existing authorized private journal preview chat and its unchanged runner
configuration. The desk first confirms `status` has at least four model calls, four
replies, and four turns left, the writer is running, the stop latch is clear, and
`pendingQuestionReviews` is zero. If the allowance is insufficient, pause the runner
and use only the existing recorded `raise-caps` procedure and authority, then resume.
Keep `INSTAR_TELEGRAM_LIVE_TEST` unset in offline checks. Do not use a real secret as
a test fact.

1. As Justin, send: “Where did I put the fictional blue-folder plan? If you do not
   know, say so.” Wait for one PREVIEW reply. If it says it does not know, wait for
   `summaryPending: 0`, then run `status --root ROOT`. Check that the question is
   listed in `openQuestions` and `pendingQuestionReviews` is zero. If the answer
   does not contain the uncertainty cue, record that this branch was not exercised;
   do not claim a pass from the cue alone.
2. Before sending another message, run `inspect --root ROOT --text "Where is the
   fictional blue-folder plan?" --model MODEL` and check `next.openQuestions`
   offers the earlier question. As Justin, send: “The fictional blue-folder plan
   is in the cedar drawer. Where is that plan now?” Wait for one reply, then inspect
   its persisted prompt. Run `status`; the open item must disappear only if the
   checked reply actually answered it and Telegram accepted that exact text. A
   holding reply, send UNKNOWN, or non-answer leaves it open.
3. As Justin, send: “What is the fictional red-folder password? If you do not
   know, say so.” Wait for an open item as in step 1. Then send: “Actually I
   meant the fictional green-folder password, not the fictional red-folder
   password.” After its reply and any summary decision, run `inspect` with a
   related question. The open-question excerpt must withhold the superseded
   clause. Send: “Forget my question about the fictional green-folder password.”
   Check `status.withheld` and `inspect`; a forgotten source must no longer
   appear as an open question. If the model cannot identify the exact old source,
   record the pending correction instead of calling the branch passed.
4. Capture the exact operator updates, reply texts, `status` and `inspect` outputs,
   model/reply-check verdicts, and Telegram receipt IDs. Compare them with the
   journal's one intent and at most one receipt per update. Mark any exhausted cap,
   unresolved model decision, or non-answer as incomplete evidence.

For the held and lost-answer branches, the offline
`journal-questions.test.ts` cases inject a cap hold and an ended UNKNOWN result.
Do not cause a provider crash or alter the live runner to manufacture those states.
If either occurs naturally during the authorized trial, run `status` and `inspect`
before and after a related later message and record the same evidence: the original
question remains open until an accepted answer closes it, with no duplicate send.
