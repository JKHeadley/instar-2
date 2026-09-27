# Conflicting memory question — Justin's supervised private-chat test

Use only the already approved journal runner, its private operator chat, existing root,
activation and credentials. This script makes no new grant. Keep the sole writer and
the live journal under desk control; the builder does not run it. Before the test,
check `status` for at least five turns, five replies and enough shared model calls
for answers and possible reply reviews. Use the recorded `raise-caps` authority if
the approved trial needs more room. Do not reset a root or an UNKNOWN effect.

1. As Justin, send: “For this test, my rehearsal birthday is March 2.” Wait for
   the ordinary preview reply.
2. Send: “For this test, my rehearsal birthday is April 4.” The agent should ask
   once which date is right, quoting both clauses rather than choosing either.
   Run `status`; `conflicts` should have one entry with `asked:true`, no
   `answeredByUpdate`, and the two source quotes. Check that there is one exact
   send intent for the question and one Telegram result or an explicit UNKNOWN.
3. Before answering, ask “What is my rehearsal birthday?” The reply should state
   uncertainty and must not repeat the same choice question. `status.conflicts`
   should still show one open pair.
4. Answer: “The first one, March 2, is right.” Run `status`; the pair should now
   show `answeredByUpdate` and the March 2 source as `winner`. The April 4 clause
   should appear in `withheld`. Pause and resume the same runner and root.
5. Ask “What is my rehearsal birthday?” The answer should use March 2, not April 4,
   and no second choice question should be sent. Run `inspect --text "What is my
   rehearsal birthday?" --model MODEL` and confirm the open conflict is gone and
   the losing clause is withheld from the next packet.

Record the exact `status` conflict state, intent/result IDs, reply-check paths and
whether the sent answer followed the chosen date. If the model never proposes the
pair, record that as a failed semantic-detection case; a plain answer is not proof
that the conflict check ran. An UNKNOWN question send must not be retried.
