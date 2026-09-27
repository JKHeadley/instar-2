# Reply length preference: Justin's supervised private-chat script

Run this only after the desk lands the branch and prepares an activation bound to
the revised conversation prompt. Resume the single approved preview runner on its
existing root. Keep its current bot, grant, caps, stop latch and encrypted journal;
do not create a second writer. This script makes no claim of a live result by itself.

1. Record `status` and confirm room for at least ten model calls, seven replies and
   seven turns. If capacity is short, use only the existing recorded `raise-caps`
   authority. Note the current active `preferences` from
   `inspect --root ROOT --text "Explain what this preview can do." --model MODEL`.
2. In Justin's bound private Telegram chat, send `More detail.` Wait for its reply.
   Inspect the next packet with the same `inspect` command. Confirm `next.preferences`
   contains `More detail.` with this turn's source. Ask `Explain what this preview
   can do.` Record the actual reply and confirm it gives useful detail while still
   stating the preview's limits. Record the persisted prompt or inspect view.
3. Restart that same runner normally. Before sending another message, inspect the
   next packet again and confirm `More detail.` remains active. Ask a comparable
   question and record the reply. A missing preference after restart is a failure.
4. Send `Shorter answers.` Wait for its reply. Inspect the next packet: it should
   contain `Shorter answers.` and no active `More detail.` Ask the comparable
   question and confirm the answer is shorter while still accurate. Record the
   source IDs and actual answer; a pending memory decision is incomplete.
5. Send `Forget my answer length preference.` Wait for its reply. Inspect the next
   packet: neither length preference should be active. Restart the same runner and
   inspect again to confirm the removal persists. Ask a comparable question and
   record the actual answer. The preference's old source may appear as withheld;
   the accepted intake and memory actions remain in the journal.

Record status, inspect outputs, prompts and Telegram message IDs for each step.
Check that there was at most one physical reply per turn, no call or send after a
stop, and that counts stayed within caps. If a decision is pending, a call is
UNKNOWN, or a cap prevents completion, report that state rather than claiming the
preference was applied.
