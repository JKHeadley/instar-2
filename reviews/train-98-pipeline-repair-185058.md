# Change review — train-98 remaining rendered-delivery replay repairs

Subject base: 0b186f1b4a63008fb72e48255c7c7b14a3a6f851
Review state: open
Reviewed content: none
Outcome: Repair the eight failing replay tests to reflect accepted Markdown rendering and actual Telegram receipt text while preserving timing, disclosure, durable intake and send uniqueness assertions.
Affected rules: 1, 13, 26, 36, 37, 49, 70, 74, 89, 101, 102, 111, 113, 116
Affected floors: secrets — no runtime changes; spend cap — existing caps unchanged; stop — existing tests retained; no duplicate sends — receipt mismatch and replay tests retained; durable intake — encrypted journal and restart checks retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair; no model prompt, parser, runtime gate, authority or production behavior changes.
Side effects: Replays now compare displayed text rather than raw Markdown; the HTTP substitute returns displayed receipt text rather than encoded HTML. Raw captured inputs remain byte-for-byte unchanged.
Undo and recovery: Revert this test repair; production state and behavior are unchanged. Keep all recorded fixtures and journal evidence.
Multi-machine posture: Tests travel through git; no new state, transport or ownership path. Existing copy relocation and one-sender replay assertions remain.
Layer below: Read the constitution, accepted review in the task brief, renderer, journal preparation and exact receipt classifier; preserve the distinction between raw answer, signed HTML and displayed receipt text.
Bug class: integration
Bug evidence: reproducer=tests/preview/receipt-match.test.ts; regression=tests/preview/group-carry-relocation.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample files.
Convergence: none
Decision: train98-repair185058-rendered-boundary | Compare delivered output with rendered recorded bytes and fix the receipt substitutes, preserving raw captures and all timing, mismatch, restart and disclosure assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-98-repair-185058-PROGRESS.md

Subject (16 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/ack-deadline-rewalk.test.ts, tests/preview/deferral-finish.test.ts, tests/preview/group-carry-relocation.test.ts, tests/preview/owed-delivery.test.ts, tests/preview/receipt-match.test.ts, tests/preview/reply-acknowledgement-timing.test.ts, tests/preview/telegram-media.test.ts, tests/preview/working-progress.test.ts

Decision: train98-repair185058-fixture-clock | Inject the existing clock at the recorded group fixture time so a replay cannot expire with the host calendar; keep real monotonic elapsed time and all activation checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-98-repair-185058-PROGRESS.md

Register replay: Owner artifact hash refreshed with the delegated desk scripts; no manual pin edit. Generated outputs rebuilt from 0cffc4cb46c61fc53350f8ec14114a8edb21b111 (shape-only replay, no entering-force authority).

## Closing block

simplestRobustRoute: This IS the simplest robust route: use the existing renderer for downstream delivery expectations and make the local HTTP receipt match Telegram semantics. No added runtime machinery. Recorded intake guards entry; exact displayed receipt and durable replay guard completion; existing stop, spend, disclosure and uniqueness limits remain.

80/20: Target the eight gate-failing test files and required cheap checks; the Studio owns the full-suite rerun. No deployment or independent acceptance claim.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
