# A saved preference keeps its answer

Subject base: a82cdeac28e30f18a6f3dfee9335ae71ca31b890
Review state: open
Reviewed content: none
Outcome: A valid preference admitted by the answer clears the earlier pending-save flag, so the operator receives the model's plain acknowledgment and the preference persists.
Affected rules: Purpose constraints 2 and 3; Rules 4, 7, 10, 36, 42, 49, 55, 57, 60, 70, 74, 75, 77, 85, 87, 88, 101, 111, 113, 116.
Affected floors: Secrets, spend cap, stop, durable intake and no duplicate sends remain on the existing answer and send paths. No new effect or authority.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the projection used to choose the operator's reply after a memory decision.
Side effects: A nonempty admitted answer memory array clears stale memoryPending only when that answer does not itself declare memoryPending. Empty, unresolved and refused proposals do not clear it. Summary memoryUndecided remains historical evidence and keeps exhausted summary retries bounded. Existing memory history, acknowledgments for corrections and saves, required notices, and durable send intents remain in place.
Undo and recovery: Revert the projection clause to restore prior rendering. No schema or store change. Existing durable answer rows supply the same evidence on journal replay. Already sent replies are never resent; the replay tests restart both before and after send. Previously compacted snapshots retain their recorded projection; this change does not rewrite old sent messages.
Multi-machine posture: Same deterministic journal projection and existing conversation ownership on every host. No new machine-local state, transport, authority or store. Replay sources are read-only; tests use isolated temporary journals.
Layer below: Read the exact live control journal, worker result and transport sends. Verified that memoryFrom admitted the source/quote, answer stored that memory, but the reducer only set memoryPending and never cleared it. The send selector then replaced the answer because memoryPending and memoryUndecided survived the failed summaries. Checked the existing format repair, summary retry ceiling, memory acknowledgment, required-notice append and durable intent/restart paths.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/memory-prefer.test.ts; live=tests/preview/fixtures/memory-prefer-1016.json
Hook bypass: none; core.hooksPath unset and the shared hooks directory contains sample hooks only.
Convergence: none
Decision: settle-admitted-memory | Clear stale pending-save state from an admitted nonempty answer memory decision, without interpreting the operator's words or adding a model call. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/memory-prefer-1016-PROGRESS.md

Evidence: Real update 1016801 from liveproof-r08-10-1016/control supplies the input, both summary outputs, pre-answer decision rows, exact worker JSON and delivered failure notice. The positive test fails before the fix with that exact notice and passes after with “You prefer tea to coffee.” and one durable preference. Full-path replay runs both captured summaries before the recorded answer. Crash after the durable answer and restart after delivery prove persistence and no duplicate sends. Malformed quote repair, still-invalid repair, empty decision, required effect refusal, stop and cap are negative neighbors.

Recorded-shape coverage: Existing retrospective-duty-followup-train-1-2026-10-08 fixture supplies summary:715672480, uncertain summary 715672483, Jev undecided 715672482, Jev unsure 969389570, reply review 969389923, delivered reply 715672479 and empty reply 715672550. Those outputs exercise the same answer path; transplanting them tests shape handling, not their semantic suitability to the tea question. The plain tea reply takes the existing exact operator-echo shortcut, so Jev cases use the recorded longer reply to prove the reviewer and escalation actually run.
Prompt review: No prompt, parser, model routing or model-call budget changes. Existing exact validators still decide admission. Required effect-refusal text remains present alongside the successful preference answer.


Prompt finding: 4106b49fff07 | protocol-literal | Existing no-tools provenance instruction is asserted at its consumer; this change leaves that instruction and model authority unchanged.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-label and unknown-source instruction is asserted at its consumer; this projection fix does not alter recall prompting.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory status wording is a fixed rendering contract tested at its consumer; no status wording changes here.

Publication: Regenerated seven existing shape-only register outputs from source commit b4dad6a043e586601bf31893cdfb5528abedfc75, generation sha256:fadfacbd11299e2ebf0a80cad48d593d4c808daccfa3d66a672f2e8c381aabeb. No policy, declaration or runtime authority change.

Validation: Focused run: 10 files, 108 passing tests. Remaining direct journal consumers: 269 passed files, 9 skipped files; 2896 passing tests and 49 existing skips (opt-in live/capture/scale cases and the registered journal-assembled load-timing quarantine). Typecheck and architecture pass. No production test failures or changes to existing tests.

simplestRobustRoute: This is the simplest robust route: use the answer's existing durable admitted memory array to clear its obsolete pending-save flag. The named failure is update 1016801 saving a preference and then reporting that it could not save it. Start guard: nonempty admitted memory and no pending flag on the answer row. End guard: saved preference plus plain reply, also after restart. Existing safety and resource guards hold. No new service, store, watcher, model call or semantic heuristic. Recorded shipped-path replay completes unattended through isolated model/send ports; fresh live-provider acceptance belongs to the desk proof room.
80/20: Recorded positive and negative tests, affected journal consumers, architecture, typecheck and required publication checks. Independent desk review owns convergence and live acceptance.
VERDICT: author submission; independent convergence is not claimed
