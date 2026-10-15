# Change review — Post-send reviews run outside the send drain

Subject base: 3b52905f79eba23fcb5826843e9dc1de1fe5aea6
Review state: open
Reviewed content: none
Outcome: A slow post-send review never occupies the ordinary send lane. The host runs one independent review pass, records each judgment against its original durable reply, and recovers interrupted reservations without another paid dispatch.
Affected rules: Purpose durable cause and least revelation; Rules 1, 4, 26, 34, 36, 41, 46, 49, 55, 58, 60, 63, 74, 75, 77, 95, 101, 102, 113, 116.
Affected floors: secrets — existing outbound and review disclosure checks; spend cap — unchanged durable reservations and provider admission; stop — review checks halt before starting or escalating; no duplicate sends — existing intent/send receipts untouched; durable intake — existing journal remains the queue.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes scheduling on the shipped send/review path and preserves durable recovery and accounting.
Side effects: A subsequent answer can finish before an earlier review does. Review findings inform answers prepared after the finding is recorded. Coherence projection must wait for its own review completion, so a fast neighboring review cannot hide a slower result. Reviews remain serial (one active pass, below the existing topic/provider ceilings), with no extra store or provider calls.
Undo and recovery: Revert the scheduling and host wiring together. Journal schema is unchanged. Durable intents without a review are picked up by the next pass; reservations lacking results recover as unavailable, preserving UNKNOWN spend and never replaying the paid call. Host shutdown joins its active pass before closing the journal.
Multi-machine posture: Review scheduling is machine-local to the journal-owning host. Existing lane ownership, disclosure, provider admission, replicated journal and stop checks remain in force; no peer protocol or ownership authority changes.
Layer below: Read durable intent, reply-review-after-send, Jev/reviewer reservation and reply-check reducers; inspected checkCoherence, host ordinary lane callback, shutdown joins and existing interrupted-review tests. Existing records already supply queue/recovery custody.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-conversation-session.test.ts
Hook bypass: none; core.hooksPath is unset; hooks directory inspection is recorded in the report.
Convergence: none
Decision: review-async-queue | Reuse durable reply intents as the review queue and run one serial host task outside the send drain; provider ceilings remain unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/review-async-1015-PROGRESS.md
Decision: review-async-projection | Project only the completed or recovered review into its reply coherence record, so ordinary checks cannot prematurely hide findings. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/review-async-1015-PROGRESS.md
Decision: review-async-publication | Refresh existing owner-source pins and regenerate the shape-only register after committing source changes; no policy or declaration is widened. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/review-async-1015-PROGRESS.md
Decision: review-async-capture-compatibility | Apply the existing COMPLETE_REQUESTED_STEPS historical-prompt normalization to two overlooked recorded-output tests; retain every capture byte and leave current production guidance unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/review-async-1015-PROGRESS.md
Prompt review: No prompt, parser, verdict policy or invocation-policy wording changed. Replay covers the recorded summary writer and uncertain summary, Jev unsure/undecided, reply-review and delivered/empty output shapes through the asynchronous consumer and unchanged readers; injected latency proves scheduling independently of machine load.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed protocol/citation guidance in journal.ts; unchanged by this scheduling change.
Prompt finding: e8708c7fea24 | protocol-literal | Existing fixed protocol/citation guidance in journal.ts; unchanged by this scheduling change.

Subject (source plus generated publication): tests/preview/journal-agent.mjs, tests/preview/journal-conversation-session.test.ts, tests/preview/journal.ts, tests/preview/rule89-speakers.test.ts

Publication: Existing desk rehash refreshed the changed test artifact pin in register-source/owner-references/preview.json. Shape-only replay from source commit ae9cb53d4e2c73dd6a32520d1e769b7ba5b8383d regenerated the seven existing generated outputs. Grounding inventory and policy bytes did not change.

Recorded-output compatibility: Direct-import verification found literal-copy.test.ts and train-12-capability-replay.test.ts still equated historical captures with the current tools prompt. Base commit a7b5338945db8bdbab94e3e2ae09e1a778d6bdee added COMPLETE_REQUESTED_STEPS and already normalized other historical fixtures. Apply that same normalization here; no competing production fix or rewritten capture.

## Closing block

simplestRobustRoute: This is the simplest robust route: move the existing review pass into the existing host background-task pattern and use durable intents as its queue. The one shared promise prevents concurrent duplicate review dispatch; delayed coherence projection prevents lost findings. Existing stop, ownership, disclosure and spend guards apply; terminal review or explicit interrupted/unavailable recovery closes each record. Offline evidence is not a live unattended acceptance claim.
80/20: Keep the existing review cascade and journal schema. Test slow review versus later sends, per-message results, advisory follow-up, restart without repeated spend, stop and cap neighbors, and the actual host callback with recorded outputs.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
