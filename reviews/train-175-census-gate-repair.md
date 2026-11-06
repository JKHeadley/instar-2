# Change review — train-175 process observation and gate repairs

Subject base: 1b8d6b1d1e2a508992317a5c8bb7b0396c0e744c
Review state: open
Reviewed content: none
Outcome: Reclaim proven launch members despite partial observations, keep unknown cleanup reserved, and inspect later detached candidates within the existing bounded live window. Repair the gate fixtures' notice grammar, aggregate replay deadlines and host-speed assumptions.
Affected rules: 26, 34, 36, 37, 42, 49, 60, 61, 70, 74, 100, 101, 105, 109, 112, 113, 116
Affected floors: secrets — custody and redaction unchanged; spend cap — uncertain cleanup retains its Six debit, no new model retry; stop — proven members remain reclaimable and a slow observer cannot delay the stop signal; no duplicate sends — dispatch identities and recovery fences unchanged; durable intake — no journal/intake change.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes physical process observation and cleanup, with actual-child positive/negative controls and existing uncertainty/recovery neighbors.
Side effects: Independent bounded cwd/sandbox probes run together. One batched census rechecks unavailable candidates instead of one subprocess per candidate. Live candidate windows rotate; settlement retains the whole bounded census. Positive membership authorizes reclamation even when other membership is unknown; only a complete census can verify absence. No ability, resource ceiling, effect doorway or activation authority is removed or widened.
Undo and recovery: Revert the repair, renew the matching native certificate and regenerate register publication. Existing unresolved rows and debits remain recoverable through the existing owner; never replay an uncertain effect.
Multi-machine posture: Machine-local physical observations, using each host's existing process identity and owners. No distributed ownership, replication or authority change.
Layer below: Ten process-inventory decoder, launchMembership, cwd and sandbox joins; hostQuery and incarnation checks; resource-owner sample, cleanupTree and Six settlement; actual provider invocation/receipt and separate reply settlement; native contract composition closure.
Bug class: none
Bug evidence: Pipeline regression repair. The supplied train-175 gate excerpt names 30 failures in 16 files at the subject base. New controlled reproductions exercise the structural observation defects; passing isolated old tests alone is not claimed as reproducing the full-run timing failures.
Hook bypass: none
Convergence: none
Prompt review: No model prompt, parser or model verdict rule changes. Recorded summary, Jev, review, delivered and empty-reply bytes additionally traverse the physical subscription route and resource cleanup.

1.x FIRST: searched actual JKHeadley/instar origin/main 36290662ca8ace97def8a08874d087f8050860b8 src/ and docs/specs/ for host test admission, cleanup deadlines and process census; inspected src/core/hostTestRunnerSemaphore.ts, src/core/hostSemaphoreCore.ts, src/core/SingleInstanceLock.ts and docs/specs/test-runner-concurrency-bound.md. Inspected history including 1f90fa1a9 (bounded Studio suite turns), 618560b3e (fair suite turns), c91b8780e (next-slot preservation), 681f86543 and e1a1b7218. Read ONEX-LESSONS.md section 6 (host-correct resource observations, bounded concurrency and actual-path evidence). Reuse the bounded-observation/fair-progress design principle, not the host-wide suite semaphore: that semaphore does not implement 2.0's per-launch membership or Six settlement. Existing 2.0 owners are the direct code fit; no 1.x runtime code is transplanted and no suite-wide serialization is added. Native certification inherits the comparison and existing guarded workflow in reviews/train-175-native-conformance-repair.md.

Decision: train175-census | Preserve the existing owners and bounds; rotate the live candidate window, batch incarnation rechecks, and reclaim known members without certifying unknown absence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-repair-PROGRESS.md
Decision: train175-fixtures | Accept the exact shipped notice; split independent replay cases; align status reconstruction's child budget with launch; explicitly admit the local HTTP success allowance without changing the default refusal controls; synchronize the poll and measure physical stop separately from delayed cleanup. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-repair-PROGRESS.md
Decision: train175-no-load | Replace the native test's 400 MiB allocation with an idle real detached process and injected RSS. Keep real identity/sandbox joins and the separate actual-RSS one-byte-ceiling qualification. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-repair-PROGRESS.md

The purpose and rules were read in full and match the named main constitutional base c20b68d1d9b5744a72c243c4dc8a4b69114179d6. Rules 26/42 retain unknown observations; 60/61 keep bounded reads, membership and resource ownership; 34/36/70 require the real child/route and recorded-shape controls; 100 permits the activation reminder; 37/116 favor these source repairs over quarantine or global serialization. Rules 74/101/109/112 are met by open review records, ordinary additive commits and retained gate history. Rule 113's state remains local to the host. The inherited CB6-MF-A, CB7-R90 and CB1-MF5 blockers remain open; this repair supplies no closure claim.

Verification of every supplied failure class:

- journal-agent and review-layers-canary: all 22 tests passed, including all eight formerly rejected activation-notice cases.
- session-work-host and harness-user: the real session release and both harness-user cleanup cases passed. New census controls prove known-child reclamation with unreadable neighbors, retained unknown on failed/partial observations, no signal to unowned candidates, and coverage of 80 candidates with windows no larger than 64.
- native-loop: both detached-child memory cases, suspended-sandbox stop and forged-file neighbor passed. setup-qualification's actual-RSS low-ceiling case passed. No load burner was run.
- journal-agent-resources: all five elapsed/fallback cases passed; media-understanding's real local decoder admission/cleanup passed; both session-work-tmux cases passed with child/helper disappearance.
- production-provider-subscription: all eight recorded Opus usage cases, the pending-child stop, descriptor success/undeclared host and all six invalid descriptor neighbors passed. Independent cases have separate runner deadlines; provider deadlines and assertions remain enforced.
- model-provider-path: all five real HTTP SIGKILL/restart cuts passed. model-provider-reply: separately settled F6 reply passed. The success fixtures now explicitly admit 2000 ms consistently through policy, definition, question and lease; the ordinary reply retains its 100 ms adapter contract. Both original 100 ms timeout/refusal controls passed, including refusal to widen the admitted timeout via driver defaults.
- telegram-poll-concurrency: asynchronous success and synchronous-freeze negative control passed with event-synchronized child/poll progress. tool-turn stop passed with an injected 3500 ms cleanup read, physical processes gone within 3000 ms, and eventual verified cleanup.
- journal-cutover: recorded overlap, durable-intake restart and single-send case passed; status child failures now report their own error before JSON decoding. tool-turn-replay: all 13 earlier-output comparisons plus fenced/empty/cap/refusal frames passed.
- Seven additional recorded shapes passed through both physical subscription framings: summary-writer summary:715672480; summary-uncertain 715672483; Jev undecided 715672482 and unsure 969389570; reply-review 969389923; delivered reply telegram:8994258214:update:715672479; empty reply in recorded context telegram:8994258214:update:715672550. Source: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json, read-only. This is exact-byte replay through a synthetic physical CLI, not new model judgment or live delivery.
- Existing resource controls passed for >64 settlement candidates, recovery with an unreadable candidate, retained debit on unreadable cwd, denied cleanup signals, and retry of a transient failed census.

All test commands used nice -n 10 and --maxWorkers 1 in the foreground. tsc and build passed. The full gate was not rerun here; the pipeline owns its next full-run result, and the previous red evidence remains intact. No test was quarantined or given a new skip declaration. Native conformance was renewed using the existing guarded Studio workflow: before 9/10 (only the stale certificate assertion failed), after 10/10. Composition sha256:20556b44f00de49c7b3d806d410796d941f478001607eaf8bbae037ea747006e, 275 files; evidence under /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-census-r105-evidence. Final committed-head cheap-gate outcomes are retained in the progress report.

## Closing block

simplestRobustRoute: Repair observation and test synchronization inside existing owners and fixtures. Batching removes per-candidate subprocess amplification, rotation prevents permanent starvation, and known-member cleanup preserves the stop without claiming unknown absence. Existing guarded native renewal and canonical register replay provide publication; no new service, grant, retry loop or capability restriction.
80/20: Target every reported failure and the neighboring uncertainty/refusal boundaries, then run cheap gates. The full suite and independent acceptance remain the pipeline's separate conditions.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
