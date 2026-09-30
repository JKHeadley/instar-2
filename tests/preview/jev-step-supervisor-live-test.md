# Justin's live test: dark Jev step check

Use the existing approved private preview chat and the same runner root, grant,
activation, model, audience, expiry, and limits. The desk pauses the sole runner,
then resumes its exact reviewed command with `--step-check true` and the existing
vault-supplied TypeSafe binding. Do not use a new root or export. This script is
for the desk-supervised live test; the builder does not run it.

1. Before enabling, run `status --root ROOT`. Confirm `stepChecks` is absent.
   Check that there is room for two model calls and replies, and use the existing
   recorded `raise-caps` authority if needed. Resume with the flag. Do not add
   any other launcher change.
2. As Justin, send `Please remember that my test label is Blue Lantern.` Wait
   for the normal PREVIEW reply. Run `status --root ROOT` after the check has
   settled. Record the exact reply, `calls`, `replies`, `jevChecks`, and the new
   `stepChecks.verdicts` entry for that update. Record whether a memory change
   was actually in the journal projection. A pass is meaningful only when its
   evidence matches the recorded effect; an unsure or unavailable verdict is
   a visible observation, not a failed send.
3. As Justin, send `What did you record about my test label?` Wait for one normal
   PREVIEW reply. Check that the second answer has exactly one step verdict and
   that both replies have exactly one send intent and at most one Telegram result.
   If a rolling summary completed, check that it has its own step verdict. Run
   `inspect --root ROOT` and compare its step verdicts with `status` after a
   clean pause and restart. Record the actual Jev score, reason and latency.
4. Pause the runner and resume the same command without `--step-check true`.
   Send one ordinary question as Justin. Confirm it still receives one reply,
   and the count of step-check reservations and verdicts does not grow. Preserve
   the journal as the trace; do not manually edit it.

A Jev violation is not required to claim this live observation: the offline
tests drive a false completed-effect claim and a recorded memory change on both
sides. The live report must state the verdicts that actually occurred and must
not claim a detected false effect unless one occurred.
