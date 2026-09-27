# Recall live-test script for Justin

Use the existing authorized private preview runner and its current root. Ask the
desk to confirm remaining turn, call and reply room and to raise the finite caps
under the recorded authority if needed. Record each actual reply, `status`, and
the question's persisted `inspect` packet. Do not paste a real secret; these are
synthetic test values.

1. Send: “The observatory access color is cobalt.” After its reply, send enough
   unrelated ordinary messages for `status.summaryThrough` to cover this turn.
   Ask: “What is the observatory access color?” The reply should say cobalt,
   and that question's `inspect` packet should contain the clause.
2. Send: “Mira Patel prefers the north entrance.” After summary coverage, ask:
   “Which entrance does Mira Patel prefer?” Check that `people` or `recalled`
   carries the original whole message with the operator as its source.
3. Send: “The studio door code is 2718.” Then: “Actually, the studio door code
   is 6194.” Wait for the correction summary. Ask: “What is the studio door
   code?” Check that the packet carries 6194 and no 2718, and that the reply
   gives 6194 only.
4. Send: “The spare key is under the cedar pot.” Then: “Forget the spare key is
   under the cedar pot.” Wait for the forget summary. Ask: “Where is the spare
   key?” Check that the packet withholds the location and the reply does not
   reveal it.
5. Record the question packet byte sizes and `status` counters. A missing
   summary, held correction, exhausted cap, or absent fact is an incomplete or
   failed result, not a pass. This supervised script tests a real model and
   Telegram path; the offline JSON remains a separate deterministic baseline.
