# People attribute history: live check as Justin

Run this only after the desk lands this branch and resumes the approved private
preview. Use the existing runner and journal. Record the Telegram replies and
read-only `status` and `inspect` results; this script does not authorize a new
runner, a cap change or a send outside Justin's private chat.

1. As Justin, check `status --root ROOT` for room for at least thirteen turns,
   replies and the needed capped answer, summary and review calls. Send:
   `My friend Nora Vale works at Cedar Studio and lives in Portland.`
   Check `inspect --root ROOT --text "Where does Nora Vale work and live?" --model MODEL`.
   Its `next.personAttributes` should show Cedar Studio and Portland as current,
   each dated to Justin's source message and attributed to the verified operator.
   Ask that question in Telegram and record the answer.

2. In a later turn, send:
   `Nora Vale left Cedar Studio and now works at Harbor Lab. Nora Vale moved from Portland to Seattle.`
   Ask `Where does Nora Vale work and live now, and when did I tell you?`.
   The answer should give Harbor Lab and Seattle with the report date. The
   `next.personAttributes` view should label Cedar Studio and Portland
   historical, never current. Ask `List Nora Vale's job and city history with
   dates.` Check that both earlier and current values appear with source dates.

3. Send `Nora Vale's partner is Ari. Nora Vale adopted a dog named Pip.`
   Later send `Nora Vale and Ari broke up. Nora Vale's dog Pip died.` Ask
   `Who is Nora Vale's current partner and pet? What is the history?`.
   `next.personAttributes` should label the older Ari and Pip values historical
   or ended, with no current partner or pet asserted from those reports.

4. Wait until `status.summaryThrough` covers the changes and
   `summaryPending` is zero. Ask the current and history questions again.
   Have the desk perform its approved pause and restart of the sole runner,
   then repeat the read-only `inspect` and Telegram questions. The current
   values, dates and historical labels must agree across the boundary. Record
   any omitted history or held turn as incomplete, including the packet drop
   reason and cap status; do not infer a pass from a summary sentence alone.

5. As a negative neighbor, ask about a different Nora with an unconfirmed
   identity. The reply should state the ambiguity rather than merging the
   histories. Do not use real private facts for this exercise.

The offline two-month soak is `journal-person-attributes.test.ts`; the live
check measures actual model interpretation and the real private reply surface.
