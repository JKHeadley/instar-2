# Change review — w3-summarybound repair: the summary prose bound is stated in UTF-8 bytes, the unit acceptance enforces

Subject base: 4a83b017ecff42abd3b79ad741c83477a599fa46
Review state: open
Reviewed content: none
Outcome: Astra cint-L28 round 1 MUST-FIX 1. The summary question asked for prose "within 1326 characters" while acceptance measured 1326 UTF-8 bytes, so a writer obeying the question with non-ASCII prose (800 accented letters, 1600 bytes) was refused twice as `summary answer over its bound` and the brake stopped the frontier at the first turn. One helper, summaryTextBound(), now feeds both the question and the acceptance check (min of SUMMARY_TEXT_MAX_BYTES and a quarter of the journal byte limit, as before), and the question states it as "bytes of UTF-8", saying non-ASCII characters take two to four. The code comment and README now describe the 2.4 bytes/token allowance as measured sizing rather than an "always fits" guarantee: the reasoning and span lists have no whole-output acceptance bound, so the provider cap and the over-cap brake are the protection. summary-bound.test.ts gains a non-ASCII writer that fills the bound exactly in the stated unit (663 two-byte letters, 1326 bytes) and checks the stated number equals the enforced one: it is accepted, the frontier reaches the head of 40 turns, no brake, no failure. Under the old wording the same test fails (verified by reverting the sentence locally), and the existing ignores-bound test still shows over-bound prose refused and braked. tsc passes; summary-bound.test.ts 8/8 and summary-overcap-cascade.test.ts 4/4 in targeted runs.
Affected rules: 96 (a writer obeying the stated prose limit is no longer treated as unfinishable, so the rolling summary keeps advancing), 2 (the question tells the model the true limit and unit), 37 (fixed at the source; no quarantine), 69 and 90 (register replayed from committed sources), 74 (this record), 116 (one helper and one sentence; no tokenizer, retry layer or new gate)
Affected floors: secrets — unchanged; spend cap — unchanged (the byte budget and the brake are unchanged; only the question's wording changed); stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: model-facing wording of one sentence in the summary question; the acceptance check computes the same value as before through a shared helper.
Side effects: the summary question grows by about 110 bytes, slightly reducing span room under the summary prompt ceiling. SUMMARY_FORMAT is not bumped: format 2 is introduced by this same unshipped branch.
Undo and recovery: revert 88fcee66 and this record and replay the register. Nothing journaled differs.
Multi-machine posture: unchanged; machine-local preview runner, the reducer is unchanged.
Layer below: the acceptance check at the prose bound and the over-bound brake, read and unchanged in behavior; SUMMARY_TEXT_MAX_BYTES derivation unchanged.
Bug class: integration
Bug evidence: reproducer=tests/preview/summary-bound.test.ts
Hook bypass: none
Convergence: none
Decision: summarybound-bound-in-bytes | state the existing byte bound in bytes rather than convert acceptance to characters, as Astra's smallest fix named: bytes are what the output cap and the packet limits measure; one shared helper keeps the stated and enforced numbers identical | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-summarybound-PROGRESS.md
Prompt review: the sentence "Keep the summary prose within 1326 characters; longer prose is refused." becomes "Keep the summary prose within 1326 bytes of UTF-8: a plain ASCII character is one byte, an accented or non-Latin character two to four, so non-ASCII prose holds fewer characters; longer prose is refused." Not re-run on the real model; the number is unchanged, the unit is corrected.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/README.md, tests/preview/journal.ts, tests/preview/summary-bound.test.ts

## Closing block

simplestRobustRoute: the required outcome is that the limit the writer is told equals the limit acceptance enforces, in the same unit. The simplest robust route is one shared helper for the number and a corrected unit in the sentence; converting acceptance to characters was not taken because the cap and limits are byte-measured.
80/20: 0 must-fix, 1 note — the reworded sentence was not re-run on the real model; its number is unchanged and the earlier real outputs were ASCII prose well under the bound.
VERDICT: author submission; the independent verdict is recorded as a pass
