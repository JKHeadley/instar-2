# Contradiction notice live test (Justin)

Run after the desk lands this revision and resumes the sole approved private
preview runner on its existing root. This script does not authorize a new
runner, grant, cap raise, or journal change outside the runner's normal intake.
Use a harmless test fact, never a real code or credential.

1. Record `journal-agent.mjs status --root ROOT`. Confirm stop is clear and at
   least four turns, four replies and four model calls remain. If a cap is near,
   follow the existing authorized cap procedure before the test. Note the
   starting turn, reply and `withheld` counts.
2. As Justin in the bound private Telegram chat, send `My test notebook cover
   is blue.` Wait for the preview reply. Then send `My test notebook cover is
   green.` Wait for its reply. It should recognize the two statements as a
   possible conflict and ask whether to update its memory. It must not claim
   that it has already changed memory.
3. Immediately run `journal-agent.mjs inspect --root ROOT`. The persisted
   packet for the green statement must have one `contradictions` entry with
   subject `my test notebook cover`, both exact values, distinct source update
   IDs, dates and verified operator sender labels. Run `status --root ROOT`:
   `withheld` must not have gained an entry from the signal alone. If the
   runner returned a hold, no reply, or a packet with no conflict, record the
   actual result as incomplete or failed; do not infer a pass from the chat
   wording alone.
4. As Justin, send `Actually, please update that memory: my test notebook
   cover is green, not blue.` Wait for the reply and any pending summary.
   Check `status --root ROOT` for a correction with the blue source update and
   `verified operator corrected this fact`. Ask `What color is my test notebook
   cover?` The reply should use green only. Run `inspect --root ROOT` and check
   the persisted packet's `memory` block carries the corrected value and the
   old blue clause is withheld from model-facing history or recall.

Record the Telegram messages, redacted `inspect` views, `status` before and
after, and whether each expected result occurred. A correction that did not
validate, an exhausted cap, or a missing summary decision is a visible
incomplete result, not evidence that the memory was updated. Count one send
intent and no repeated physical send for each answered turn.
