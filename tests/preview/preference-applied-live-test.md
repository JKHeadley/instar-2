# Preference applied to reply: Justin's private-chat test

Use only the existing approved journal runner, root, private operator chat and
grant after the desk lands this branch. Do not change its bot, expiry, limits or
activation. The runner must have room for three turns, three replies and its
usual model and review calls; use the existing recorded `raise-caps` authority
if needed. Do not start a second runner.

1. Run `status` and record `preferenceApplied`, calls, replies, holds and the
   current active preference shown by `inspect --text "How should you answer?"
   --model MODEL`. Send `Keep replies under 20 words.` as Justin. Wait for its
   reply. Inspect the next packet to confirm that exact clause is active with
   the operator turn's source ID.
2. Send `In one sentence, what is Instar for?` as Justin. Record the exact reply
   and count its visible words, including `PREVIEW`. Run `status` again. If the
   reply has at most 19 words, `preferenceApplied.checked` must advance and no
   finding may name this update. If it has 20 or more, the finding must name
   this reply update, the preference source update, its word count and
   `maxWords: 19`. Record `delivery` as Bot API acceptance or unknown; neither
   means the human read it.
3. Send `Forget my reply length preference.` as Justin. Wait for its reply.
   Confirm with `inspect --text "How should you answer?" --model MODEL` that
   the preference is inactive. Ask the same Instar question again. The latest
   answer must add no check or finding for the retired preference. Earlier
   findings, if any, must remain in `status` after a normal runner restart.

A model that follows the preference throughout may produce no live violation;
record that honestly. The focused offline test exercises both sides of the
boundary and the holding-reply case. If the runner holds a turn or exhausts a
cap, record the visible hold as an incomplete live result. Do not edit or replay
the live journal to manufacture a violation.
