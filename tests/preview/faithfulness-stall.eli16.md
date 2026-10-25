# Keep finding facts when a summary is rejected

The proof room remembered 26 facts. Its summary reviewer correctly rejected a
later summary: it said one reply was still pending, then claimed every reply had
been accepted by Telegram. The facts themselves were still there.

Finding those facts by meaning had a separate bug. The indexer only worked on
messages covered by an accepted summary. Once the summary stopped advancing,
newer facts could stay outside the meaning index forever.

After a failed summary, the existing indexer now takes one batch of up to eight
messages on each idle pass, including messages beyond the summary. It keeps the
same two-attempt limit for each message, stop check and shared spending limit.
The rest of the pass can still retry compaction. Only a passing review can commit
a summary. Original messages remain in the journal throughout.

Offline tests replay all 26 facts and 60 filler messages from the October 25
proof-room run. The recorded reviewer still rejects the delivery claim. The
cabin-key fact becomes findable by a paraphrase even when a smaller test packet
limit removes it from visible history. The test reuses the recorded writer's
meaning terms as the indexer's response; it does not claim a new live model run.
The desk runs group S live after shipping.
