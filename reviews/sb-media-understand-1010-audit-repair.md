# Change review — Forum summary and carried-source audit repair

Subject base: 4da2912dc8e20a9f763b6e8c2f51f434f8620083
Review state: open
Reviewed content: none
Outcome: Repair MUST-FIX 1: a valid forum summary uses all-topic history, and its predecessor candidates trace to the authenticated carry snapshot instead of nonexistent destination intake. Preserve exact source, content and empty-reply validation, topic-local answer history, and correction/forget projection through compacted replay.
Affected rules: 7, 26, 34, 36, 37, 45, 47, 49, 70, 74, 96, 101, 111, 112, 113, 116.
Affected floors: secrets — audit output remains content-free provenance and findings; spend cap — no model calls added; stop — no execution admission changes; no duplicate sends — no delivery changes; durable intake — audit reads retained authenticated state and does not manufacture predecessor intake.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Shipped memory-audit false rejection requires worker-to-CLI and recorded-journal replay, with negative provenance neighbors. This changes reporting only, not runtime authority or model judgment.
Side effects: Summary history expectation expands to the producer's actual all-topic scope only when the recorded reservation kind is summary. Authenticated carried candidates accept their exact projected text and empty reply; carried corrections trace to that snapshot. Invalid snapshot digest/binding, missing sources, altered text/replies and ordinary answer topic leakage still fail. Generated register source metadata changes.
Undo and recovery: Revert the repair commits and regenerate the register through its existing tool, preserving history. No journal migration or data rollback is needed; reverting restores the false audit findings.
Multi-machine posture: Read-only audit is deterministic over each host's authenticated journal and recorded reservation. The carry already contains cross-root provenance; no new store, transport or machine-specific state is introduced.
Layer below: Inspected packetFor labelAll and groundingHistory, summary memoryCandidates production, groupCarryPacket, validCarriedMemory, projectMemoryClause, carry replay admission and encrypted journal compaction. Destination corrections are projected at the recorded reservation memoryCount. Existing topic-local answers and exact source/reply checks are preserved.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-audit.test.ts
Validation: 21 targeted audit tests pass with one worker; typecheck and build pass. Positive private/forum summaries and carried correct/forget paths pass through worker, compacted reopen and audit CLI. Missing history/source, altered content/reply, invalid snapshot/binding and cross-topic answer neighbors fail. Recorded proof-room journal rows 715672479–715672500 are replayed into predecessor memory. The actual live group journal and reviewer-pinned historical prefix at summary 969390345 audit with zero findings; all seven predecessor candidates resolve, compacted reopen stays clean, and CLI exits 0. Mutated historical packet neighbors fail. Evidence is in the absolute lanes repair PROGRESS and repair-historical-replay.json. No full suite was run locally. Eight saved-report contract checkers pass; P5, assembly and P11 require a fresh worktree/revision-bound process-exit receipt, owned by the pipeline. No failed or skipped test is relabeled.
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none
Decision: audit-source-parity | Reuse recorded call kind and authenticated carry projection; also migrate correction audit consumers so valid carried memory cannot become a false missing-source report after correction. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-media-understand-1010-repair-PROGRESS.md
Prompt review: No prompt, model output parser, accept/escalate/refuse model judgment, tool or capability changes. The audit reports exact provenance. Real recorded uncertain summaries, Jev/reply-check verdicts and delivered history are replayed as predecessor source state, and the exact previously rejected live summary exercises the repaired path.
Deferral: generated/register.json:1 | not-a-deferral=Generated register quotes the constitutional rule book; this repair defers no source fix.

## Closing block

simplestRobustRoute: This is the simplest robust route: follow the producer's recorded summary scope and existing authenticated carry snapshot, reusing the existing correction/forget projection instead of replaying predecessor intake. This prevents false memory-loss reports without narrowing memory or media ability. Start guards are recorded call kind, bound snapshot and digest; end-state evidence is exact provenance plus the unattended shipped audit CLI exit 0 on the reviewer-pinned real journal after compaction. Existing runtime safety and resource floors remain intact; no new gate or service.
80/20: The demonstrated summary and seven-candidate defect is fixed at source with positive and negative recorded replay. Only required register regeneration and review records accompany it. No quarantine, full-suite run, new machinery or independent-convergence claim.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
