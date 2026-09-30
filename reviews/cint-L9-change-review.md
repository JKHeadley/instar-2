# Change review — cint-L9: merge w3-memcorr onto the live build

Subject base: ab8d69232269a4398b27fe4c9962336d7603da40
Review state: open
Reviewed content: none
Outcome: cint-L9 is the live build cint-L8 ab8d6923 plus w3-memcorr 0c03c980 (ba2fd29e and its register regeneration), merged cleanly, then the register regenerated once (284642e9). w3-memcorr fixes live K13b: once one memory correction was recorded, packet.memory showed it as a display row (mode "corrected", no quote, paraphrased replacement) and the terse answer guidance left the real model to copy that row, which the validator refuses, so the operator got "I couldn't record that memory change". memoryDecision now states the exact memory item shape (MEMORY_ITEM_SHAPE) and says packet.memory is a display shape never to copy; the validator is unchanged. journal-memory-correction-shape replays the recorded real-model outputs: it fails on the old guidance (memoryPending, the live symptom) and passes now, and the display-shape echo is still refused (both sides of the decision). The guidance adds 580 JSON bytes to each operator packet; the byte calibrations that depend on packet size were re-measured (memory-inventory, packet-pressure, why-bound, journal recall-drop, packet-selection ceiling) and the recall-latency packet hash re-pinned. The full gate run on the Mama PC passed every test; its only failure was this missing record.
Affected rules: 7, 37, 74, 102, 116 (7 — the memory correction the operator asked for is actually recorded; 37 — nothing quarantined; 74 — this record; 102 — decision below; 116 — one guidance string, validator untouched)
Affected floors: secrets — unchanged (the credential wall still runs before any provider and on the send body); spend cap — unchanged (no added calls; 580 bytes inside the existing byte cap); stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: the change is one prompt-guidance string on the answer path plus test calibrations; no send, spend, stop or intake logic changes, and the validator that guards memory writes is unchanged
Side effects: each operator packet is 580 bytes larger, so a context near the byte cap compacts slightly sooner; a later memory correction after a recorded one is now recorded instead of refused
Undo and recovery: revert the merge 2428c5bc and the regeneration 284642e9; the journal format is unchanged, so no stored state needs migration
Multi-machine posture: machine-local, deliberately: the preview journal worker is single-machine
Layer below: tests/preview/journal.ts memory validator (unchanged; still refuses the display shape)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: cint-L9-memcorr-shape-in-guidance | fix K13b by stating the exact item shape in the guidance rather than widening the validator to accept display rows, so memory writes keep requiring an exact old quote | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L9-PROGRESS.md
Prompt review: memoryDecision now embeds MEMORY_ITEM_SHAPE, a literal statement of the memory item fields the validator accepts, and tells the model packet.memory is a display shape never to copy; no system prompt, provider policy or invocationPolicyDigest changed.
Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (15 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-memory-correction-shape.test.ts, tests/preview/journal-memory-inventory.test.ts, tests/preview/journal-packet-pressure-value.test.ts, tests/preview/journal-why.test.ts, tests/preview/journal.test.ts, tests/preview/journal.ts, tests/preview/packet-selection-quality.test.ts, tests/preview/recall-latency.test.ts

## Closing block

simplestRobustRoute: state the exact item shape once in the guidance and leave the validator strict; merge, regenerate the register, record
80/20: 0 must-fix, 0 notes — one guidance string, re-measured calibrations and generated output
VERDICT: author submission; the independent verdict is recorded as a pass
