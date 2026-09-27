# Memory self-description: supervised live script as Justin

After the desk lands this commit, use the existing authorized private preview
chat, runner, root, model, grant and limits. This script does not change the live
journal or restart the runner. Record the actual messages and read-only outputs.

1. Run `node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root /ABSOLUTE/EXISTING_ROOT`.
   Confirm the trial is active and has room for the planned turns, replies and
   shared model calls. Record `self`, `limits`, `summaryThrough`, `holds` and
   `heldNotices`.
2. As Justin, ask: `What do you remember in this preview, how long does it
   last, and how can I correct or forget something?` The reply should say it
   uses this trial's encrypted local journal across runner restarts and topics,
   can recall during the active trial, and accepts a direct correction or
   forget request from Justin. It should say old claims are withheld from later
   replies while their audit records remain. It must not claim independent
   production or other-agent memory, or claim to send scheduled reminders.
3. Send a harmless new fact: `Please remember that my test color is amber.`
   Wait for the reply, then ask `What is my test color?` The answer should be
   amber. Run read-only `inspect --root /ABSOLUTE/EXISTING_ROOT --text "What is
   my test color?" --model MODEL` and check that the fact or a sourced summary
   is in the prepared packet. A correct answer without packet evidence is not
   sufficient proof of recall.
4. Send `Correction: my test color is teal, not amber.` Wait for the reply and
   memory decision. Ask for the test color again; it should say teal only.
   Send `Forget my test color.` Wait for the reply and memory decision. Ask
   again; it should not recall either color. Check read-only `status.withheld`
   and `inspect` for the correction and forgotten marker. If a memory decision
   is pending, record the hold and treat that step as incomplete.
5. If `status.holds` shows an earlier held answer with a fixed notice, ask an
   unrelated ordinary question. The reply should address that question without
   narrating the earlier hold or repeating the notice. Ask explicitly about
   the held update; then an explanation is appropriate. Check `heldNotices`
   and the chat to attribute any notice to the runner's fixed path. If there
   is no naturally held turn, skip this live observation; the focused replay
   test covers the packet guidance and fixed send path.

Record the exact replies, update IDs, timestamps, status and inspect output,
and any unmet step. Use the runner's existing recovery route if caps run out;
do not edit or replay the journal or manufacture a hold.
