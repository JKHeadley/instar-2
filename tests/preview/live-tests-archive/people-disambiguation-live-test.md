# People across months: Justin's scored private-chat test

Run after the desk lands this branch and resumes an authorized preview runner.
Justin uses only his bound private Telegram account. Do not start a second runner,
edit the journal, or use this builder checkout against the live root. Before
sending, record `status`: stop, expiry, UNKNOWN outcomes, summary state and
remaining turn, call and reply caps. The sequence can use more than 30 turns and
several summary calls; use only the desk's recorded cap-raise authority if needed.
An existing frozen-build root can supply a live baseline only if the same source
and question sequence was actually run there. Otherwise write “live baseline
unmeasured”; the offline fixture is not a provider result.

1. Send `My cofounder Sam goes by Sammy and chose the October launch.` Wait for
   the reply. Over several days or months if practical, send thirteen separate
   messages: `My neighbour Sam lent me garden tool 2.` through `My neighbour Sam
   lent me garden tool 14.` Wait for each reply. The long gap tests the memory
   claim; sending them together only tests compaction and ranking. Record dates.
2. Use the README's harmless memory filler, waiting for each reply and
   `summaryPending: 0`, until `inspect --root ROOT --text "What did my cofounder
   choose?" --model MODEL` reports `historyMode: summary-plus-recent` and its
   `next.people` contains the exact older cofounder source. Stop and record an
   incomplete result if a cap or hold prevents this. Inspect the same packet
   for `What did Sammy choose?`, `What did neighbour Sam lend?`, and `What did
   Sam do?`. The bare-name packet must contain both the cofounder and neighbour
   sources, with dates and the operator as speaker. `status.personMerges` must
   have no link between them.
3. Ask those four questions in Telegram, one at a time. The role and nickname
   questions should answer October directly. The neighbour question should
   answer the garden-tool fact directly. The bare `What did Sam do?` should
   ask one short question distinguishing the two Sams. Also ask `Compare what
   my cofounder Sam chose with what my neighbour Sam lent.` That comparative
   question should answer both parts directly, without asking which Sam.
4. Send `My cousin Maya plans the picnic.` and `Maya Chen is the cousin who
   plans the picnic.` After both sources appear in a summary, inspect `Are
   Maya and Maya Chen the same person?`. Record the exact candidate source IDs
   and `confirmText`. Ask that question; it is not confirmation and must not
   create a merge. Only then send the candidate's exact `confirmText` from
   Justin's bound account. Check that `status.personMerges` links only those
   two source IDs and names the confirmation update. A missing candidate or
   memory hold is incomplete, not a pass. Restart through the desk's normal
   procedure and verify that exact link survives while both Sams remain
   unlinked. Do not test with a second sender in the live chat; the focused
   offline test covers that refusal.
5. For each of the five answer questions, record the exact reply, inspected
   source IDs, send intent and Telegram outcome. Score **clear 4/4** when the
   three targeted questions and the comparative question answer directly with
   the right person and fact; score **ambiguous 1/1** only when bare Sam gets
   one distinguishing question, with no guess. Score **separation 2/2** when
   the cofounder and neighbour remain distinct before and after Maya's merge.
   Score **merge 3/3** for no link after the Maya reports, no link after the
   identity question, and only the exact pair linked after confirmation and
   replay. Report every denominator, failures and holds; do not relabel an
   offline packet pass as a live answer pass.

The accepted trial's secret, spend, stop, durable intake and exact send-intent
guards remain in force for every step. No message in this script grants a new
send route or permission to merge another person.
