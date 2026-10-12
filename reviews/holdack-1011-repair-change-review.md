# Change review — repair acknowledgement assertions and recall priority

Subject base: bac58119c93bf0744961a372a43b19770ee33a2e
Review state: open
Reviewed content: none
Outcome: Slow restarted or queued replies retain their one acknowledgement without being counted as duplicate final answers or blocker reviews. Under a tight packet bound, current-question evidence survives ahead of unrelated evidence merely offered in earlier replies. The cross-topic key fact now reaches the question after 87 turns and restarts.
Affected rules: Purpose coherence and ability; Rules 1/4/7/11/14/28/34/36/37/41/58/63/70/74/75/87/89/96/101/111/113/116.
Affected floors: secrets — outbound and audience checks unchanged; spend cap — existing packet and paid-call bounds unchanged; stop — admission and dispatch checks unchanged; no duplicate sends — crash tests separately assert one acknowledgement and one final answer, including UNKNOWN sends; durable intake — original encrypted intake and cursor unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes which memory reaches the live model within its byte bound; requires regression evidence and recorded shapes, despite the small source diff.
Side effects: Within an existing evidence tier, the existing current-question match score precedes earlier exposure. Prior exposure still breaks equal-match ties; higher evidence tiers and packet bounds are unchanged. This can replace previously offered irrelevant sources with currently matching sources. No prompt text, parser, semantic classifier, authority, tool, network access, framework or session ability changes.
Undo and recovery: Revert the comparator ordering to restore the old selection, at the cost of reintroducing the reproduced lost-key context. No journal format or durable runtime state changes and no migration. Test assertion changes need no runtime recovery. Regenerate source publications from committed bytes after a revert.
Multi-machine posture: Each owning worker computes its bounded packet from the existing replicated journal and durable grounding. No new store or cross-machine dependency. Replay copies are temporary, deliberately machine-local test artifacts.
Layer below: Inspected packetFor, recallFor and the optional evidence drop order, durable reserve grounding, and the separate acknowledgement reservation/intent/receipt. A source merely present in a prior packet is not proof it was used or remains relevant. The summary crash child intentionally advances time 100 seconds on restart; the obligation boundary case advances two minutes before drain. Both now legitimately exercise the existing acknowledgement route.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/journal-conversations.test.ts; live=tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only, inspected directly.
Convergence: none
Prompt review: No prompt literal changes. The packet ordering regression retains the original source fact, records dropped alternatives and enforces 8192 bytes. Replay copies the same encrypted pre-question fixture prefix for each captured output, avoiding cross-case state pollution. Captured summary 715672480, uncertain summary 715672483, undecided Jev 715672482, unsure Jev 969389570, review 969389923, delivered reply 715672479 and empty context 715672550 traverse the changed packet construction and answer path. Existing acknowledgement replay also checks these shapes and lookup 969390382 with its captured Jev/review. These are recorded-byte replays, not new live model verdicts; the empty context is not claimed to be an actual Telegram delivery.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed memory-inventory response, not an intent classifier.
Prompt finding: bd01de21286a | protocol-literal | Unchanged source-label instruction asserted by the existing grounding test.
Prompt finding: fb5fa7e706c8 | protocol-literal | Unchanged semantic retrieval instruction asserted by the existing grounding test.
Decision: current-question-first | Reorder two existing signals within the existing tier; earlier exposure must not crowd out the newly requested fact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack-1011-repair-PROGRESS.md
Decision: count-acknowledgement-separately | Assert its exact occurrence and durable receipt without loosening final-answer or blocker-review assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack-1011-repair-PROGRESS.md

Verification: Three originally failing files passed all 85 tests; strengthened conversation regression and captured-shape replay passed all 11 conversation tests. The targeted existing priority sweep and eight acknowledgement replays passed. Typecheck passed before the final test-only additions; final checks are recorded in the absolute desk progress record. The supplied gate JSON is absent; contract checkers report missing results, and the pipeline owns the full suite. No full suite or load test was run here.

Publication: The delegated desk-rehash-owner-manifests tool refreshed one canonical fixture hash in register-source/owner-references/preview.json. desk-repin-chain ran and found no grounding-inventory bytes to change. No hand-edited pins.

## Closing block

simplestRobustRoute: This is the simplest robust route: reorder two existing packet signals and correct tests that conflated acknowledgements with answers. It prevents self-reinforcing irrelevant context without adding machinery. Start is an admitted turn with bounded evidence, end is its grounded reply, and existing byte/call/send/stop/secret/ownership guards remain. The real recorded shapes exercise the worker offline; no new live deployment or autonomous-completion claim.
80/20: Fix the demonstrated source ordering and all stale assertions, preserve higher evidence tiers and exact no-repeat checks, replay captured shapes, then run targeted tests and the required cheap gates. Full-suite proof and independent landing review remain the pipeline's work.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
