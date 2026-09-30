# People facts through summaries: live check as Justin

Run only after the desk lands this branch and resumes the existing private
preview runner on its current root. Do not start a second runner or reset its
journal. Record the actual Telegram replies and read-only `status` and `inspect`
outputs. This branch has offline evidence only.

1. As Justin, check `status --root ROOT` for at least eight turns, eight replies,
   and enough calls for replies and rolling summaries. Use the existing recorded
   cap-raise authority if needed. Send these separate private messages, waiting
   for each reply:

   - `Maya Chen, my colleague at the archive, collects blue maps.`
   - `Maya Ruiz, my neighbour, collects red stamps.`
   - `Recent news about Maya Chen: she moved the archive exhibit to October.`
   - `Recent news about Maya Ruiz: she repaired the garden gate.`

2. Send the harmless filler from the README's people-memory live script until
   `status.summaryThrough` covers all four messages and `summaryPending` is zero.
   Check that the summaries covering them report person notes. If a summary is
   held, plain, or missing notes, record the result as incomplete.

3. Run `inspect --root ROOT --text "What is Maya Chen's relation to me, what does she collect, and what happened recently?" --model MODEL`.
   In `next.people`, find both Chen messages with their own Telegram source IDs,
   dates, exact messages, and `from: the operator (verified sender)`. The Chen
   evidence must survive even if Ruiz entries also appear. Ask the same question
   in Telegram. The answer should identify the archive colleague, blue maps,
   and October exhibit as Justin's reports; it must not assign Ruiz's red stamps
   or garden gate to Chen, or claim Maya spoke to the agent directly.

4. Repeat step 3 with Maya Ruiz and her neighbour, red-stamp, and garden-gate
   facts. Then ask the short-name question `What do you know about Maya?`.
   `inspect.next.people` should show both people with separate source messages;
   the reply should keep their facts separate or state the ambiguity.

5. Pause and resume that same runner using the desk's normal procedure. Repeat
   both full-name `inspect` probes and Telegram questions. The source IDs and
   attribution must survive replay. Record any packet omissions or cap holds;
   neither counts as a successful answer.
