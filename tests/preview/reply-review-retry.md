# Reply review output-cap repair

A reply review whose recorded physical result proves the process ended over its
output allowance can use the existing single review re-ask. The same full context,
candidate, selected questions and audience are reviewed with a shorter output
request. The discarded result is never accepted as a verdict. A missing final
frame, unknown exit or different failure does not qualify.

The journal validates the reason before admitting the retry. Both calls count
against the existing call cap, and reported usage is retained even above the
output allowance. Unmeasured usage remains reserved separately. Stop and the
shared review deadline still refuse the retry. A second unusable result ends the
attempt; recovery never repeats a reserved review or an uncertain send. The
existing audience and credential checkpoints decide whether a reply can leave.

This changes no tool, session, network or model capability. It introduces no new
store; the retry and accounting follow the existing journal's ownership,
replication, replay and compaction semantics. Rules 1, 4, 36, 41, 42, 55, 57, 58,
60, 70, 75, 77, 88, 95, 113 and 116 govern this repair.

`reply-review-overcap.test.ts` replays update 367052411 from the retained forum
answer-check copy. The first review consumed 2365 output tokens against its 2048
allowance. The replacement-verdict replay uses the actual result text retained
in that call's diagnostic frame, explicitly as a new completed call; production
never promotes the refused output. The tests also replay the earlier probe review
969390374 and the recorded summary, uncertain summary, undecided/unsure Jev,
review, delivered reply and empty reply corpus, and exercise negative neighbors.
Live acceptance remains the desk's answer check on the pushed build.
