# Answer correction: supervised private preview test for Justin

Use the already approved private journal runner and its existing root, grant, bot, audience,
expiry and caps. Run the documented `status` and `inspect` commands for that root. Do not edit
the journal or resend a held turn. Keep the storage key in its host binding, not command text.

1. Ask a question whose answer Justin can verify independently and that has not already been
   stated as a memory fact in this trial. Use a naturally occurring wrong factual answer from
   the preview. Record the question, exact sent reply and its Telegram update ID. If the agent
   says it does not know or answers correctly, use another genuine case; that is not a correction
   result.
2. Send a direct correction as Justin, for example, “No, that’s wrong, it was Tuesday.” The
   corrected clause must be in Justin's message. Check `status.withheld` for the earlier
   `sourceUpdate`, the correction's `operatorUpdate`, and `in: "reply"`. A held or unresolved
   correction is not a pass; record its hold reason. Verify the earlier question remains in
   `inspect --text` while the wrong answer is withheld and the replacement appears in memory.
3. Ask the original question again. Confirm the new answer uses the correction and does not
   repeat the old claim. Check that each operator turn has at most one send intent and one
   Telegram accepted reply; an UNKNOWN send is never repeated. Restart the approved runner and
   inspect once more to confirm the same correction survives journal replay.
4. For the opposite side, ask a separate question that contains a proposed day in its question
   but receives an answer that does not state that day. If a later message disputes that answer,
   verify no `in: "reply"` record claims the day was in the sent answer. Keep any unresolved
   hold visible. A valid correction of an actual operator-stated fact is a separate memory-fact
   case, not evidence of answer correction.

Record the Telegram trace and the relevant `status` and `inspect` output for the desk. This
script requires a real observed wrong answer; it is not completed by the offline tests.
