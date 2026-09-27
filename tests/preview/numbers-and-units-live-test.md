# Numbers and units: Justin's supervised private-chat test

Use the approved journal runner, its existing private operator chat, root, bot,
grant, expiry, credentials, and caps. The desk starts or resumes that runner; this
script does not create a trial or authorize a send. Confirm `status` has room for
six operator turns, six replies, and the normal summary/review calls. If needed,
the desk uses the existing `raise-caps` authority before the test. Do not run a
second writer or edit the live journal.

1. As Justin, send: “For this test, my walking route is 3.25 miles and my sample
   supplement note says 5 mg.” These are synthetic examples, not medical advice.
   Wait for the one reply. Ask: “How far was the walking route, and what was the
   sample supplement amount?” The answer should say **3.25 miles** and **5 mg**,
   without rounding, converting, or dropping either unit.
2. Let the existing rolling summary cover the first message. Use `status` to
   confirm `summaryThrough` reaches its update ID. If no summary has run yet,
   continue ordinary private-chat turns until it does, within the trial caps.
   Pause and resume the same runner on the same root. Ask again: “What were the
   exact route distance and sample supplement amount?” Check the same exact
   values and units. With `inspect --text "How far was the walking route and what
   was the sample supplement amount?" --model MODEL`, check that the relevant
   original quote is present in `next.recalled` or unsummarized `next.history`.
3. As Justin, send: “Correction: my walking route is 3.5 miles.”
   After its reply, ask the exact distance again. Check for **3.5 miles** and
   absence of **3.25 miles** in the answer and the model-facing `inspect` packet.
   The original remains in the encrypted journal as evidence.
4. Send: “Forget the sample supplement amount.” After its reply, ask: “What was
   the sample supplement amount?” The answer must not repeat **5 mg** as an
   active fact. Check `status.withheld` and the next `inspect` packet; the latter
   must omit the forgotten clause.

For each prompt, record the operator update ID, reply text, `status` outcome,
summary frontier, and `inspect` evidence. Confirm one send intent and at most one
Telegram acceptance per update, with no unprompted message. A wrong number,
missing unit, or stale corrected/forgotten value is a failed live test; keep the
exact evidence for repair. `api-accepted` means Telegram accepted the message,
not that Justin read it. The full landing gate is a separate integration step.
