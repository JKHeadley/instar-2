# Justin's supervised active-memory budget check

Use the existing approved private journal runner and its current root, activation,
grant, bot and operator binding. This script spends only from its existing call and
reply caps. Check `status` first; use the established `raise-caps` authority if the
trial needs more room. Do not edit the journal or run another writer.

1. Send distinct, synthetic operator messages naming one person each, with a
   different harmless fact and roughly 250 characters of context. Ask ordinary
   questions between them so rolling summaries run. Stop once `status.memoryBudget`
   reports at least one `archivedInferred` note. Record the budget, pinned bytes,
   active bytes, and both inferred counts. If the summarizer did not extract enough
   notes before the trial caps, record this as inconclusive, not a pass.
2. Use `inspect --text "Tell me about PERSON" --model MODEL` for the oldest named
   person. If that person's note is archived, `next.people` should omit it. Send
   that ordinary question and record the answer; a summary or recalled original
   may still supply it, so absence from `people` alone is the measured condition.
3. Use `inspect --text "Search memory PERSON" --model MODEL`. Check that
   `next.people` contains the archived note with its whole original message,
   verified operator sender and date, and that any corrected clause is withheld.
   Send the search request as Justin and record the actual PREVIEW reply.
4. Run `status` and `inspect --text "Tell me about PERSON" --model MODEL` again.
   The searched note should now be active if it fitted in the reserved packet;
   another older inferred note should have moved to archive when the budget is
   full. Restart the same runner and repeat `status` and `inspect` to check replay.
   Check one Telegram send intent and at most one API receipt per request, with no
   duplicate reply.

Keep the five floors visible in the trial record: redacted packet content and the
existing outbound secret check; capped model calls; stop and expiry; exact durable
send intent with no retry of UNKNOWN; fsynced intake before cursor advance. An
archive search is a normal reply request, not a new effect or authority grant.
