# Memory depth at scale — live check as Justin

Run only after the desk lands this preview build and resumes the existing
approved private-chat runner on its current root. Do not seed synthetic facts
or change the live journal, grant, model policy, caps or bot. The 10,000-fact
size and latency bounds belong to the offline test; this live procedure checks
that the same reply path selects a real compacted source and still sends once.

1. As Justin, use the bound Telegram account and ask one question about a
   specific fact from an older turn that `status.summaryThrough` covers. Record
   the exact question, source turn number, starting status and reply. If there
   is no such source, record this live check as incomplete.
2. Run the existing `journal-agent.mjs status --root ROOT` and `inspect --root
   ROOT` commands. Confirm the answer packet uses `summary-plus-recent`, its
   `recalled` entry contains the expected source turn and exact fact, and the
   answer agrees with that source. Record packet bytes, packet limit, the reply
   check path, one exact send intent and one Telegram API accepted receipt.
3. Ask one ordinary question that makes no new factual assertion, such as
   `What did I say about that project?` Check the persisted packet and one
   reply/receipt for this update. Record the locally reported turn-stage
   timings if available; do not compare them to the offline bound because
   they include model and Telegram time.
4. Pause and resume through the desk's normal procedure. Confirm status and
   inspect still show the earlier source and the same send receipts, with no
   repeated Telegram send. Record any hold or UNKNOWN outcome as such.

Pass requires source-correct recall through the real reply doorway, unchanged
receipt counts across restart, and no held or duplicate answer. Telegram API
acceptance is not proof of human receipt. This procedure does not claim that
the live journal contains 10,000 facts.
