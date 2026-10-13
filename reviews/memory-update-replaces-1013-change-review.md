# Change review — Saved-fact replacement instructions

Subject base: 0ed77d1682e55fb894fdc1f13b26cabd62972e00
Review state: open
Reviewed content: none
Outcome: The answer packet and its bounded declaration repair distinguish a new independent fact from a changed value of the same saved fact. They direct the latter through the existing sourced update operation rather than a second remember.
Affected rules: Purpose coherence and constraints 2/3; Rules 4, 7, 10, 11, 12, 34, 36, 37, 49, 57, 70, 74, 85, 96, 101, 102, 111, 113, 116.
Affected floors: secrets — existing redaction, audience and outbound checks; spend cap — existing call reservations and one repair; stop — existing turn and retry stop checks; no duplicate sends — existing durable intents and recovery; durable intake — existing accepted turn and append-only memory history. No floor changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Model-facing instructions govern persistent memory choices, although this patch changes no admission, projection or storage code.
Side effects: The model is told to classify a restated value by its relationship to an earlier fact rather than by the presence of a remember request. Different facts remain independent; an explicit correction still uses correct and forget remains available. This changes future model choices, not already recorded remember decisions. No heuristic merges facts or repairs old journals automatically.
Undo and recovery: Revert the instruction change to restore the old packet. Existing update/correct/forget journal records retain their existing format and remain readable across restart. No migration or new durable state.
Multi-machine posture: Instructions are identical on each runner; memory writes still use the existing owner, journal and replication boundaries. No machine-local memory or new transport.
Layer below: Inspected memoryFrom's offered-source, exact old/new quote, principal and ordering checks; selected saved facts already enter memoryCandidates; updates already persist as historical corrections and project away the old current value. Inspected the recorded save and recall reasoning: the packet explicitly required remember even with an older value. The recall-time update is separately invalid because its replacement is not in that recall message; that exact check stays intact.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/memory-update-replaces.test.ts; live=tests/preview/fixtures/memory-update-replaces-2026-10-13.json
Hook bypass: none; checked core.hooksPath (unset) and the shared hooks directory (sample hooks only).
Convergence: none
Decision: memory-update-replaces-guidance | Repair the contradictory instructions at initial decision and repair; retain the existing update admission and history projection, with no keyword-based supersession or recall rewrite. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/memory-update-replaces-1013-PROGRESS.md
Decision: memory-update-replaces-replay | Preserve exact recorded output bytes and label the update response relocated from recall to the save turn; do not claim a fresh model response or that replaying the old bad choice changes that choice. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/memory-update-replaces-1013-PROGRESS.md
Prompt review: The instructions classify by meaning and relationship, not fixture words. Replay covers exact save output 715675724, update and malformed repair outputs 715675726, the changed instruction at both delivery sites, durable supersession/recall, and unrelated facts. Existing correction, forget and recorded-shape repair suites remain acceptance neighbors. The actual save-then-recall sequence also proves the recorded recall-time update remains pending when its replacement is absent from the current message. These are offline recorded-output replays, not a fresh provider trial or live deployment.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory status wording tested at its consumer, not a phrase deciding operator intent.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-provenance instruction tested at its consumer, not a phrase deciding operator intent.

simplestRobustRoute: This is the simplest robust route: remove the instruction that demands a separate remember even when replacing the same fact, and reuse the existing update operation. No new resolver, heuristic, model call or store. Start guards are verified retained intake and offered old sources; end guards are exact validated replacement and durable history projection; current caps, stop, secrets and send ownership remain. No unattended live-provider completion claim.
Publication: Regenerated seven shape-only register publications from source commit f8787af8c8157d32ef0ee388e4f5eaeb3fc526d4 using the existing replay generator. Generation sha256:d35d620f9e3afe02db7dbbd9f5fa9bdd5dffd6ec6c83dc7184d59d27573d7696. The desk owner-manifest rehash and grounding-chain repin found no pins to change. No declaration or authority changes.

80/20: Targeted regression and direct-import consumer tests, compile and architecture/publication checks; final independent review and the Studio gate own live acceptance.
VERDICT: author submission; independent convergence is not claimed
