# Agent commitment follow-through: Justin's supervised private preview test

Use the existing approved private Telegram journal runner and root. Check `status` first
for enough remaining turns, replies, and model calls; keep its existing activation, audience,
stop, expiry, and time-zone settings. Save `status`, `inspect`, and actual reply text as the
trace. This script does not start, stop, or alter the live runner.

1. As Justin, ask for an ordinary reply that may include a safe explicit first-person promise,
   for example: `Please remember that I want to call the dentist tomorrow. Tell me what you
   can do when I next message you.` If the checked reply says `I'll remind you to call the
   dentist tomorrow`, record its exact text. If it correctly declines to promise, confirm
   `status.commitments.total` did not grow; that is the negative case, and the positive case
   needs a later naturally sent explicit promise. Do not count a promise quoted by Justin.
2. After a sent explicit promise, run `status --root /ABSOLUTE/ROOT` and confirm one new open
   commitment. Run read-only `inspect --root /ABSOLUTE/ROOT --time-zone YOUR_ZONE --text
   "What have you promised me?" --model DESK_EXACT_MODEL`. Its `next.commitments` must show
   the exact agent reply quote, `owner: agent`, `waitsOn: next-relevant-reply`, and the due day
   if the promise included a supported date. Send that question and confirm the reply surfaces
   the commitment without claiming a scheduled reminder or an external check.
3. On the due day, if the trial is still authorized and active, send `What is due from you?`
   Confirm the persisted last packet has `due.state` of `due` or `overdue`, and inspect the
   actual reply. The runner sends nothing until Justin sends a message. If it replies with
   exactly `Reminder: call the dentist.`, confirm one Telegram API receipt and that
   `status.commitments.open` falls by one. A different reply leaves it open.
4. For a promise to check external information, send another ordinary question. Confirm a
   mere `I checked` claim does not close it. A verified operator message stating the task
   was done or withdrawn can close it through the existing summary path; check that path
   only after the summary has run. Restart the runner through the desk's normal procedure
   and confirm the open/closed state survives replay without a duplicate reply.

An unavailable check, held reply, unknown Telegram result, expired trial, or missing positive
promise is incomplete live evidence. Do not edit journal frames or extend the grant to force
the case. The offline test in `agent-commitment.test.ts` and the focused journal tests cover
both sides deterministically without model or Telegram access.
