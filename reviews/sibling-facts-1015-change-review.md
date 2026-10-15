# Change review — sibling-facts-1015

Subject base: d97249b540e0f9804644f2fce0ca84ae2f3c52b1
Review state: open
Reviewed content: none
Outcome: sibling topics receive bounded action-backed operator-request and effect states in their grounding, refreshed at actual session dispatch even for an already-running worker.
Affected rules: 1, 4, 26, 28, 29, 32, 36, 49, 58, 60, 70, 74, 84, 96, 98, 101, 102, 111, 113, 116
Affected floors: secrets — opaque source/input references and no private text, with verified operator audience; spend cap — no new model call or reservation; stop — rechecked after asynchronous grounding; no duplicate sends — existing effect identity/preparation and send intents unchanged; durable intake — original envelope and actual delivery remain in existing durable custody.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: shared model context and effect metadata, without a new authority or effect writer.
Side effects: packets gain bounded context; source/input references are opaque and establish exact identity only, never semantic equivalence. Existing records without topic metadata cannot acquire invented provenance. A failed or oversized freshness reader retains intake and does not dispatch stale grounding. The full journal and deduplication set remain intact; the additional latest-effect projection retains only 64 metadata entries.
Undo and recovery: revert the added projection and dispatch callback together. Existing records remain readable because their additional metadata is optional. No new store or destructive migration. Replay and compaction carry the projection with the existing snapshot, while full action evidence remains journal-owned.
Multi-machine posture: same journal and exclusive conversation-owner fence as the base. Siblings on this owner share fresh facts; replicas receive ordinary journal records. This is not an instantaneous cross-machine arbitration guarantee and adds no second writer.
Layer below: inspected outbound intent addOperatorRequest, effect-owner prepare-before-dispatch and observed-return records, nested edge inheritance, shared topic allowance, session custody/delivery persistence, journal replay/snapshot and group membership disclosure reader. Prepared is not approved; observed is not successful.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-topic-sessions.test.ts
Hook bypass: none
Convergence: none
Decision: sibling-existing-writes | use existing operator requests per the desk clarification and add topic plus opaque source/input references to existing effects; no new model declaration, summary extraction or store | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sibling-facts-1015-PROGRESS.md
Decision: sibling-dispatch-freshness | read the bounded journal projection after worker admission immediately before every actual delivery; retain the original intake and persist the delivered prompt through existing custody | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sibling-facts-1015-PROGRESS.md
Prompt review: model-facing context only, no changed output parser or semantic gate. Replay existing archived summary-writer, uncertain summary, Jev undecided/unsure, reply-review, delivered reply and empty reply shapes from retrospective-duty-followup-train-1-2026-10-08.json, plus canary9-review-2026-10-11.json update 969390374. Tests assert the new dispatch facts occur with those recorded envelopes; no live-provider judgment or live Telegram proof is claimed.
Prompt finding: 849db3a6296a | protocol-literal | existing saved-memory response in journal.ts, unchanged by this change.
Prompt finding: e8708c7fea24 | protocol-literal | existing memory source-label guidance in journal.ts, unchanged by this change.

## Closing block

simplestRobustRoute: this is the simplest robust route: extend the current journal fold and packet with bounded metadata from existing writers, and inject a freshly read projection at the existing dispatch boundary. The named failure is an already-prepared packet missing a sibling's newer action; another summary job or watcher cannot close that timing gap. Existing admission, stop, audience, delivery-size, spend and durable intake guards remain. This delivers visibility, not mechanical agreement between models. No autonomous live-provider completion or independent convergence is claimed.
80/20: targeted consumer tests exercise two topics, an existing running worker, after-packet effects, writer provenance, bounds, replay, audience withholding and private-input exclusion. The desk owns native macOS conformance and the full landing suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
