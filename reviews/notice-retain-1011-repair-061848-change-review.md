# Change review — preserve successful calls at diagnostic redaction boundaries

Subject base: 192f51a6ed6173d68c68e98be924059d04e4681e
Review state: open
Reviewed content: none
Outcome: A diagnostic excerpt clipped inside an assigned-credential redaction marker no longer makes the journal reject a successful physical call. The existing redactor checks the bounded excerpt; an invalid excerpt becomes an explicit bounded omission marker.
Affected rules: Purpose 2/3; Rules 1/26/34/36/41/49/60/70/74/77/100/101/102/111/113/116.
Affected floors: secrets — pre-clip scrubbing and journal validation remain intact; spend cap — reservations and accounting unchanged; stop — cancellation unchanged; no duplicate sends — no retry or dispatch change; durable intake — existing append order, encryption and replay unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: A narrow diagnostic boundary repair with real encrypted journal append and reopen tests; no model prompt, verdict parser or authority changes.
Side effects: Only an excerpt failing the existing credential validator is replaced with an explicit omission marker. Valid excerpts remain byte-identical, and the original physical result is returned by identity. Byte ceilings remain 4096 total and 1024 for stderr. No catch around journal append, no retry, no new store or classifier. The diagnostic omission cannot alter the model's output or its physical success facts.
Undo and recovery: Revert the repair commit; existing optional diagnostic fields remain compatible. No migration, historical row rewrite or recovery grant.
Multi-machine posture: Deliberately local physical buffers feed the existing encrypted journal and its existing replication/owner policy; no new shared state or network exposure.
Layer below: Read boundedExcerpt, the assignment redactor and credential marker exception, validateCallOutcome's byte and credential checks, and the production subscription adapter's catch-to-uncertain path. Tests use actual encrypted append and reopen, proving capture no longer throws before physical return.
Bug class: integration
Bug evidence: reproducer=tests/preview/call-diagnostics.test.ts
Hook bypass: none; core.hooksPath unset; common hooks directory contains sample files only. Plain commits.
Convergence: none
Decision: notice-retain-clip-validator | Use the same redactor as journal validation after pre-scrub and clipping, replacing only an invalid excerpt with a bounded omission marker. This directly prevents the demonstrated lost-result failure without changing validation or swallowing append errors. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/notice-retain-1011-repair-061848-PROGRESS.md
Prompt review: No prompt, model output parser, verdict or review threshold changes. The existing diagnostic suite replays recorded physical outcome 969390396 without inventing its absent evidence and a captured Claude Code result. Synthetic boundary controls explicitly do not purport to be historical events.
Verification: Both new stdout/stderr regression cases failed with call outcome malformed before the fix and passed afterward. Each exercises all 20 partial marker cuts, the intact marker neighbor and ordinary clipped text through real journal append and reopen. Existing diagnostic and journal-loop-fire tests pass. Portable gate results and the unrelated WSL host-launcher refusal are recorded in the local report for desk copying.

## Closing block

simplestRobustRoute: This is the simplest robust route: preserve pre-clip scrubbing and enforce the existing secret validator on the bounded excerpt, explicitly omitting only invalid diagnostic text. It prevents one demonstrated answer-loss regression. Start admission, end append, byte bounds and all five floors remain unchanged. No autonomous recovery or live acceptance claim.
80/20: Prove red then green at both byte boundaries and their ordinary neighbors, inspect the underlying validator and adapter, and submit with targeted portable checks. Independent convergence remains with the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
