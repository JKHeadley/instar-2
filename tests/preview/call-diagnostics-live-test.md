# Justin's private preview check: subscription call outcomes

Run only after the desk lands this commit and resumes the reviewed journal runner.
Use the existing private operator chat and root; this procedure does not start a
second runner or repeat an UNKNOWN call.

1. Before sending, have the desk save `journal-agent.mjs status --root ROOT` and
   confirm the same trial has room under its existing call, reply and turn caps.
   Note `calls`, `unknownCalls`, `callOutcomeCounts` and `lastCallOutcomes`.
2. Justin sends: `What can you do in this preview? Answer in one sentence.` Wait
   for the reply. Have the desk run `status` again. One new `role:model` outcome
   should show an exit code, elapsed milliseconds, prompt bytes, and either a
   normalized result frame or a named local limit. A normal completed frame
   should show `type: result`, `subtype: success`, `isError: false`, and usage
   output tokens. Record the actual reply separately; do not copy it into the
   diagnostic row.
3. If the existing rolling-summary threshold is reached during ordinary turns,
   wait for the summary job and check that `role:summary` increased once and the
   new summary outcome appears in the last-ten window. If Jev escalates any
   ordinary reply, check that `role:reply-review` increased once. Do not force a
   Jev outage or manufacture extra paid calls to make either happen; mark any
   role not exercised as unproven by this live check.
4. Inspect all new rows: no answer, summary, candidate reply, provider refusal
   text, or CLI stdout may appear. Compare `callOutcomeCounts.total` with the
   number of new physical model invocations observed. A reservation without a
   physical outcome row is still UNKNOWN; never resend it to fill the row.
5. Record the before/after status outputs, reply receipt, any hold or loss notice,
   and whether each role was exercised. A local timeout must remain UNKNOWN and
   must not cause another call for the same reservation. The 2048-token over-cap
   and 120-second timeout classifications are proved by the offline fixtures;
   this live check does not induce either limit.
