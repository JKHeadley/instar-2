# Fact updates without correction words — live test for Justin

Run this only after the desk lands the branch and resumes the approved private
preview runner on its existing root. This script grants no new runner, cap raise,
deployment, or access. Use harmless test facts, never a real code or credential.

1. Record `journal-agent.mjs status --root ROOT`. Confirm stop is clear and enough
   turn, reply, and call slots remain for this test. Record the starting counters
   and `withheld` entries. If a cap is near, use the existing authorized cap
   procedure before starting.
2. As Justin in the bound private Telegram chat, send `The test launch is in
   October.` Wait for the reply. Send `The studio launch is in March.` Wait for
   the reply. Then send `The test launch moved from October to November.` Wait
   for the reply. This last message contains no correction request. It should
   treat November as current and mention the change if useful.
3. Inspect the November turn's persisted packet. Its `contradictions` entry
   must name the exact October and November clauses, distinct source update
   IDs, dates, and verified operator provenance. Check `status --root ROOT`:
   one new `withheld` entry should say a newer verified operator statement
   updated the test launch fact. It must not name the studio launch source.
   If the model did not return an update, record the result as incomplete.
4. Ask `What do you remember about the test launch?` The answer should lead
   with November and note that October was the earlier plan. Inspect the
   persisted `memorySearch`: the current value comes before the superseded
   October quote, and both carry dates. Ask about the studio launch too; March
   remains current.
5. Have the desk perform one normal stop and resume on the same root. Send
   `The test launch is in December.` Then send `The test launch is in October.`
   After each reply, inspect its update decision and `status`. The latest value
   should become current even when October returns. Ask `What do you remember
   about the test launch in November?` Its earlier value and date should be
   retrievable, while the answer leads with the current October value.
6. Record the redacted Telegram replies, `inspect` packets, `status` before
   and after, restart result, and any holds. Confirm one durable send intent and
   no repeated physical send for each answered turn. A missing update, wrong
   subject, lost old date, cap stop, or unresolved hold is a failed or incomplete
   result, not proof of success.
