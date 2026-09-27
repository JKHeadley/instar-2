# Held-reply live rate — supervised script for Justin

Use only the already approved private preview chat after the desk integrates this
branch. The four old held update IDs are 969389576, 969389578, 969389581 and
969389583. Do not resend their original messages to force recovery: their paid
review outcomes are uncertain or unavailable, and the existing journal must
retain them. This procedure does not change activation, caps or the live runner.

1. Ask the desk for a read-only `status` snapshot. Confirm the build identity and
   expiry, record `holds`, `replyChecks`, `unknownCallBreakdown`, `unknownSends`,
   `calls` and `replies`. Treat a hold as resolved only if the journal shows a
   completed check and a single exact send intent for that update. A held notice
   is a separate message and does not resolve its answer.
2. As Justin, send one ordinary short question in the private chat. Record its
   update ID. After the runner acts, ask for `status` and `inspect` for that ID.
   A Jev PASS or completed contextual review PASS must precede at most one
   answer intent. If the check is unavailable, the turn must remain held with
   accepted intake and no answer intent.
3. As Justin, send one short memory question likely to make Jev uncertain, such
   as asking whether the preview can remember a non-authentication code you
   just supplied. Do not include a real password, PIN or account token. Record
   its update ID. If Jev escalates, inspect must show the completed contextual
   verdict or a visible hold. Do not force an outage or repeat the question to
   obtain a particular review path.
4. Ask for one more read-only `status` snapshot after any routine runner restart.
   Compare the four historical IDs and the new IDs. No UNKNOWN model call,
   reviewer call or Telegram send may be dispatched a second time. The old
   `unknownSends` count may remain one; without a durable API receipt it cannot
   be called delivered or retried. Record which new turns passed, held, or have
   uncertain delivery, together with their exact cause classes.

Pass requires one checked ordinary reply, truthful visible outcomes for every
new turn, no duplicated send or paid review, and the four historical holds still
represented honestly unless independent durable completion evidence exists.
This is a live channel check of the integrated build; the offline fixture alone
does not establish a lower live hold rate.
