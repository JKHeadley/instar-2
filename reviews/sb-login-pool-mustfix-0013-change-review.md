# Change review — isolate pooled login secret custody

Subject base: 9827578db239e5137e3e1b22b4a977764a22bb98
Review state: open
Reviewed content: none
Outcome: A missing secondary login or profile credential source cannot discard readable primary or later-member values from the launcher's exact outbound secret check.
Affected rules: 1, 4, 26, 34, 49, 70, 74, 86, 95, 100, 101, 102, 111, 113, 116
Affected floors: secrets — per-member reads retain readable values and unavailable-source information; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Small source change at a secrets-floor checkpoint, with explicit failure isolation and retained-value regression evidence.
Side effects: The same createHeldSecrets helper receives two independent readers per configured member instead of two aggregate readers. Its existing retained set survives later loss, and its unavailable field still reaches tool and network checkpoints. Ordinary reply reachability, default pooling, identity, independent grants and full-tool admission are unchanged. Source labels use member indexes rather than credential values or account names.
Undo and recovery: Revert this repair commit; no persisted format changes or migrations. Reversion restores the reviewed secrets-floor defect and requires that risk to be addressed before serving.
Multi-machine posture: Deliberately runner-local secret material, as before. Each runner independently checks its own custody; no credentials or additional state cross machines.
Layer below: Read origin/main purpose and rules in full. Inspected createHeldSecrets retention and failure isolation, heldVerdict's held/unavailable/clear outcomes, harness custody readers, journal checkOutbound and the retained reply path. The aggregate eager map/flatMap threw before returning readable values; the existing helper already provides the needed per-source isolation.
Bug class: integration
Bug evidence: reproducer=tests/preview/harness-login-held.test.ts
Verification evidence: Both missing-secondary regression cases failed against the original collection block (empty values) and passed after repair. Exact launcher block plus real createHeldSecrets, heldVerdict and secretMaterialIn cover login/profile failures, later readable members, recovery and later loss. Recorded model/reply shapes are replayed with unchanged controls and explicitly synthetic encoded-primary companions. Typecheck and architecture checks passed. All six READY pinned-text files passed (89 tests). Full launcher cases are retained for the Studio: on this Linux host all stop at bot identity before model execution; /bin/sh rejects the transport shim's ulimit -u. No launcher secret-withholding pass is claimed here.
Hook bypass: none; core.hooksPath unset, common hooks directory contains sample files only; plain git commit and no stash.
Convergence: none
Decision: LPD-0013-source-isolation | Register each member's custody and profile separately through the existing retained-secret helper; no new mechanism or changed checkpoint policy. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-login-pool-mustfix-0013-PROGRESS.md
Decision: LPD-0013-consumer-evidence | Execute the exact launcher collection block with real retention and matching, carry missing/intact custody through launcher cases, and report the Linux transport limitation without changing production resource enforcement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-login-pool-mustfix-0013-PROGRESS.md
Prompt review: No prompt, parser, model judgment or refusal policy changes. The exact secrecy check receives the previously lost readable values. Replayed existing read-only captures in proofroom-summary-cascade-stall-2026-09-30.json and retrospective-duty-followup-train-1-2026-10-08.json, including uncertain, undecided and empty historical context shapes; synthetic credential insertion is labelled, not represented as recorded output or delivery.

simplestRobustRoute: Use existing per-source failure isolation in createHeldSecrets by registering each member independently. Start guards remain custody reads and installed-login admission; end guards remain the exact reply and outward-tool checks; all existing limits remain. No new state store, retry, model gate or autonomous-completion claim.
80/20: One source block, direct red-to-green regression with captured-shape replay, and three additional cases in the existing launcher test. Independent targeted repair review remains the desk's decision.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
