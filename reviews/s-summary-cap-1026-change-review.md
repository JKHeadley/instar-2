# Change review — Summary output capacity and bounded recovery

Subject base: 10826ed522b6a11ebc77cb6bb0a047e8dd25def7
Review state: open
Reviewed content: none
Outcome: The subscription CLI receives room for its 2048-token thinking budget without raising the admitted answer cap. Oversized summary spans shrink by halves until the existing four-turn recovery can take over. A smaller real summary from the train-163 S0b conversation now parses, passes full-context review and commits.
Affected rules: 7/11/96 (originals and semantic recall survive summary recovery); 13/24/26 (separate answer, thinking, generation and byte measurements); 35/36/41/58 (proof-room captures and isolated justin-gmail replay); 55/60/61/75 (bounded dispatch, retries and complete usage accounting); 95 (faithfulness still fails closed); 101 (no hook bypass); 113 (existing ownership and journal scope); 116 (two local repairs through existing mechanisms).
Affected floors: secrets — custody and scrubbing unchanged, no serving login used; spend cap — admission, call reservations and whole-output metering unchanged; stop — checked before the smaller retry and before commit; no duplicate sends — replay has no transport and runtime send path unchanged; durable intake — originals and failed outcomes remain journaled.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes subscription generation bounds and automatic rolling-summary recovery on the live memory path.
Side effects: The generation allowance increases by the pinned CLI's 2048-token thinking budget for every subscription framing. A model without thinking can generate more text before admission refuses an answer over the unchanged policy cap; raw bytes, answer bytes, timeout and call admission still bound the invocation. Reported output usage still includes thinking. Large failed summaries take smaller spans sooner, increasing the number of successful chunks but preventing nearly identical oversized attempts. Existing small-span recovery, format re-ask, UNKNOWN semantics and faithfulness review remain intact.
Undo and recovery: Revert the source/test commits and replay generated register output. No journal schema, stored-state migration or activation-policy digest change. Existing failure frontiers supply the recovery ceiling across restart. Native self-host composition conformance requires desk renewal for the final bytes, as explicitly allowed by the builder charter; this change does not alter its declaration.
Multi-machine posture: Existing owner-local execution and durable journal replication; no new store, transport, ownership, authority or machine-local durable state. Provider generation accounting applies equally to every host using this adapter.
Layer below: Inspected the constitution, the retrospective i1b-opus-1020 fix, subscription terminal accounting and invocation environment, summary preparation, failure-frontier replay and faithfulness cascade. Decoded only a copied proof-room journal. Measured every summary-failed row and replayed the actual request on the test login through the physical provider IO, pinned CLI and current answer reader.
Bug class: live-path
Bug evidence: reproducer=tests/preview/summary-cap.test.ts; live=tests/preview/fixtures/summary-cap-2026-10-26.json
Evidence boundary: S-proofroom-20261026-161321 contains six completed over-cap writers at updates 367054889 through 367054884, one stopped writer at 367054883, and 33 completed meaning-index calls. The status counter's 41 summary reservations is not 41 writer failures. Three terminal excerpts were clipped, so their full result byte lengths are unknown. Existing i1b arithmetic already excludes thinking from admission. Real re-execution exposed the remaining generation bug: 1775, 1821 and 1782 answer tokens fit admission but the 2048-total-token generation limit split each output into a malformed continuation. With thinking room, the smaller writer returned complete JSON at 1867 answer tokens, the real full-context reviewer passed at 263, and createJournalWorker committed through 367054864. The original large request then returned 2628 answer tokens and was still refused. All six new real calls used justin-gmail. This is isolated worker/provider proof, not a claim that the serving S proof has been rerun.
Hook bypass: none
Convergence: none
Prompt review: No question, system prompt, parser or review wording changes. The writer's existing output instruction remains 1024 tokens, accepted answers remain capped at 2048, and only the amount of supplied history changes after a measured output-bound failure.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged journal protocol text; no new keyword decision.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged journal protocol text; no new keyword decision.
Prompt finding: 85544c20941f | protocol-literal | Unchanged journal protocol text; no new keyword decision.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged journal protocol text; no new keyword decision.
Decision: generation-thinking-room | Separate the CLI's total generation allowance from the existing answer acceptance cap, preserving full usage metering. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-cap-1026-PROGRESS.md
Decision: shrink-large-failed-span | Halve large remaining prefixes using the existing durable over-cap frontier; keep fine recovery at four turns and below. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-cap-1026-PROGRESS.md
Validation: Targeted provider and summary tests, recorded-shape replays, real model proof, typecheck and final READY checks are recorded in PROGRESS. All tests run foreground, nice -n 10 and maxWorkers 1. No load tests or dependency installation.

## Closing block

simplestRobustRoute: This is the simplest robust route: give generation its already-known thinking allowance while retaining the existing answer cap, and halve an overlarge history prefix using failure state already in the journal. No larger accepted cap, new retry engine, new durable state, scheduler or weaker review. Start guards remain idle/pressure/cooldown and ownership; limit guards remain stop, call admission, timeout and byte/answer caps; the end guard remains a passing faithfulness review. The isolated shipped worker/provider path completed the real recorded case unattended through commit.
80/20: Both measured defects have local repairs and both-sided evidence. The desk owns independent review, the native byte-bound certificate renewal, and the full serving proof.
VERDICT: author submission; no independent verdict asserted
