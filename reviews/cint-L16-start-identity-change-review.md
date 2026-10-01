# Change review — cint-L16 pipeline repair: the resource owner compares one canonical process start identity

Subject base: 4839a934aa54c7d2181a1abeb0fea6e1ddfc23a6
Review state: open
Reviewed content: none
Outcome: The cint-L16 studio gate failed 8 tests in tests/integration/resource-owner.test.ts, none touched by this branch. Cause: a date-dependent mismatch. On 2026-10-01 `ps -o lstart=` pads a single-digit day ("Thu Oct  1 ..."); startEvidence kept that padding (trim only), while the process-inventory census row collapses whitespace ("Thu Oct 1 ..."). Every recorded member therefore read as a different incarnation on days 1 to 9 of a month: sampled points went 'missing', memory/process ceilings were not attributed, and recovery could not see a surviving member. The fix adds one startIdentity normalizer in scripts/resource-owner.mjs, used by startEvidence and by recovery for every start read back from the durable ledger (member starts, the root start, the owner start), so ledgers written in the padded form still compare. A new date-independent test pins both sides: a padded and a collapsed start are one identity, and a different start stays different. The file's 30 tests pass (previously 8 failed today). Because scripts/resource-owner.mjs is in the self-host composition, the conformance contract (tests/preview/native-harness-contract.test.ts) was re-run (8 behavioural cases passed, only the declared hash trailed), the declaration re-pinned to the new composition bytes, and the contract re-run 9/9 twice. The register was regenerated with --replay at the fix commit; the owner-reference rehash and inventory repin refreshed nothing.
Affected rules: 60 and 61 (subprocess ceilings and pressure settling attribute members again on days 1 to 9), 105 (self-host conformance re-run and re-declared for the new composition bytes), 74 (this record), 69 and 90 (register regenerated from committed sources with --replay), 116 (one normalizer at the two read sites; no new state or gate), 37 (fixed at source; no quarantine)
Affected floors: secrets — unchanged; spend cap — unchanged (no call added); stop — strengthened: ceiling kills and recovery once more recognise recorded members on single-digit days; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: the comparison decides membership for ceiling kills and observation-only recovery, which sit beside the stop floor
Side effects: recorded and compared start identities use single spaces; a ledger written with the padded form is normalised on read, so no ledger migration is needed
Undo and recovery: revert the fix commit, the conformance re-declaration, the register regeneration and this record
Multi-machine posture: machine-local: each host's resource owner reads its own processes
Layer below: reviews/cint-L16-summary-direction-change-review.md (the base, carried)
Bug class: date-dependent identity mismatch between two readings of the same ps field
Bug evidence: gate run at 4839a934 (8 failures in resource-owner.test.ts on 2026-10-01); targeted re-run before the fix reproduced 8 failures, after the fix 30 passed
Hook bypass: none
Convergence: none
Prompt review: no prompt text changed
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/cint-L16-start-identity-change-review.md, scripts/resource-owner.mjs, src/assembly/harness.declarations.json, tests/integration/resource-owner.test.ts

## Closing block

simplestRobustRoute: normalise the start identity at the two places it is read (live ps and the durable ledger) instead of changing the census decoder or adding a date parser
80/20: 0 must-fixes, 0 notes (targeted tests only; the full gate runs elsewhere)
VERDICT: author submission; the independent verdict is recorded as a pass
