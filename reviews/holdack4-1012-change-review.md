# Change review — Ten-second slow-reply acknowledgement

Subject base: ea75ce395d9fdd4f9f2f970e8c278b9fe37a5387
Review state: open
Reviewed content: none
Outcome: A reply whose answer is ready before ten seconds gets no acknowledgement while its review or delivery runs; a still-pending answer gets one fixed acknowledgement starting at ten seconds.
Affected rules: Purpose least revelation and durable cause; Rules 1/4/14/26/32/36/44/46/49/52/63/70/74/75/77/87/101/102/111/113/116.
Affected floors: secrets — existing outbound and disclosure checks retained; spend cap — no new model calls and existing reply allowance retained; stop — existing timer and send admission checks retained; no duplicate sends — durable intent and UNKNOWN fences retained, including old eight-second entries; durable intake — existing journal acceptance unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Small timing change at an irreversible outbound boundary, with historical journal compatibility.
Side effects: Acknowledgement starts two seconds later; some disclosure probes that formerly overlapped an answer no longer run. Historical fixed acknowledgements between eight and ten seconds remain readable only through replay; new admission requires ten seconds. Answer scheduling, prompts, parsing, review chain and delivery cost are unchanged.
Undo and recovery: Revert this change; ten-second records remain valid under the previous eight-second floor. Never retry accepted or UNKNOWN sends.
Multi-machine posture: Existing timers remain process-local, reconstructed from durable intake. Existing ownership, replication and signed send admission remain authoritative; no new shared state or authority.
Layer below: Read both constitutional documents in full. Inspected answerReady cancellation after settled answer calls, turn.answer projection, current() recheck during send admission, timer reconstruction, and admission=new versus replay in the journal fold. The existing answer guard already supplies the requested suppression, so no second readiness flag or new scheduling machinery is added.
Bug class: integration
Bug evidence: reproducer=tests/preview/reply-acknowledgement-timing.test.ts
Hook bypass: none; core.hooksPath checked unset, common hooks directory checked and contains only samples.
Convergence: none
Decision: holdack4-existing-answer-guard | Retain the existing turn.answer guard and answerReady cancellation; move the shared deadline to ten seconds and prove the 9.3-second answer / 12-second delivery and 10.5-second answer boundaries using recorded answer and reviewer bytes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack4-1012-PROGRESS.md
Decision: holdack4-historical-replay | Keep the historical eight-second minimum for replay only; new acknowledgement intents require ten seconds. This prevents the timing correction from making deployed journals unreadable. Both admission and replay boundaries are tested. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack4-1012-PROGRESS.md
Prompt review: No prompt, parser, review criterion or fixed acknowledgement text changes. Replays use committed read-only captures for live updates 969390382 and 969390407–410, plus summary-writer summary:715672480, summary-uncertain 715672483, Jev-undecided 715672482, Jev-unsure 969389570, reply-review 969389923, delivered reply 715672479 and empty reply 715672550. Timing overrides are injected test clocks, not claims of fresh live measurements.
Prompt finding: 849db3a6296a | protocol-literal | Existing answer protocol text is unchanged; no prompt change in this unit.
Prompt finding: bd01de21286a | protocol-literal | Existing source-label grounding instruction is unchanged; no prompt change in this unit.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing operator-history grounding instruction is unchanged; no prompt change in this unit.

## Closing block

simplestRobustRoute: This is the simplest robust route: change the existing deadline, retain the existing recorded-answer and cancellation guards, and keep old journal entries readable using the fold's existing replay mode. A separate readiness flag or alternate timer would duplicate state. Tests cover the timer boundary, pending review, slow answers, delayed send admission, old history, stop and UNKNOWN sends. No live deployment or unattended production completion is claimed.
80/20: Targeted changed and direct-import tests, recorded shapes, compiler, architecture, lint, register and pinned-text gates. Platform-only checks are reported for the Studio gate; no full suite or load generation.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
