# Change review — audit summary scope and carried memory provenance

Subject base: f34d2b940c1da2678bfe7b32ce70ca5f58fd0784
Review state: open
Reviewed content: none
Outcome: Valid forum summaries audit against the producer's all-topic history, and predecessor memory candidates resolve through the authenticated carry snapshot rather than destination intake. Ordinary answers remain topic-local; missing sources, changed content and fabricated replies remain findings.
Affected rules: 7, 26, 34, 36, 37, 41, 45, 49, 58, 70, 74, 96, 101, 102, 111, 112, 113, 116; purpose Constraints 2 and 3
Affected floors: secrets — audit emits provenance without message bodies; spend cap — no model calls; stop — no dispatch path changes; no duplicate sends — read-only audit; durable intake — originals and authenticated replay remain unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Repair a shipped diagnostic consumer with exact positive and negative evidence, without modifying runtime model decisions or effects.
Side effects: Summary calls use the same all-topic selection as packetFor labelAll=true. Carried candidates must match a recall/preference/correction entry's full projected text and empty reply, and report the snapshot digest. Other audit checks retain their behavior.
Undo and recovery: Revert the source repair with an ordinary commit and regenerate the register. No journal migration is required; retain every journal and UNKNOWN effect without repetition.
Multi-machine posture: Read-only machine-local audit of the existing authenticated journal/carry format; no new store, peer dependency, ownership or replication change.
Layer below: journal.ts packetFor and summary memoryCandidates producer; groundingHistory; group-carry.ts validCarriedMemory and groupCarryPacket; projectMemoryClause at the recorded reservation memory count; encrypted journal compaction/reopen and shipped journal-agent audit CLI.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-audit.test.ts
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains samples only
Convergence: none
Prompt review: No model prompt, output decoder, routing or runtime accept/escalate/refuse decision changes. Recorded encrypted group summary through 969390345 exercises both repaired branches, with seven exact carried sources; the old auditor reports eight findings and the repaired auditor zero. Seventeen copied live/proof-room journals replay strictly without writes. Archived uncertain-summary and reply-review rows also replay before and after compaction. Three previously accepted historical findings remain visible, as does the archived fixture's absent prompt.
Decision: audit-forum-history | Select summary-wide history only from the recorded call kind; never infer it from missing thread metadata or packet claims. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/audit-forum-1010-PROGRESS.md
Decision: audit-forum-carry | Validate the authenticated carry snapshot and reuse its correction/forget projection at the reservation; exact source/content/reply matches are required without reranking at today's clock. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/audit-forum-1010-PROGRESS.md

Subject (3 paths): tests/preview/journal-audit.d.mts, tests/preview/journal-audit.mjs, tests/preview/journal-audit.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the recorded call kind, existing history selector, authenticated carry validator and source-scoped memory projection. The start guard is authenticated retained evidence; the end guard is exact provenance/content/reply matching; topic isolation and the five runtime floors remain intact. No new mechanism or unattended runtime completion is claimed.
80/20: 22 audit tests and 64 direct-consumer/briefing tests pass; the existing opt-in scale soak remains disabled on the Studio. Forum and private CLI reproductions both exit 0 before/after compacted replay. Build, typecheck and architecture pass. Initial lint/register checks identify only source-pin lag; generated publication is refreshed in a separate reviewed commit.
VERDICT: author submission; independent landing review remains required
