# Change review — Preserve fact recall answers instead of replacing them with inventory

Subject base: 6b1d99a740e8287b2b3c8b4274e5cf9cb3722021
Review state: open
Reviewed content: none
Outcome: Keep fact recall answers intact when the model also emits the legacy inventory flag; explicit inventory requests still render bounded journal items.
Affected rules: 1, 10, 11, 12, 34, 36, 37, 49, 70, 72, 73, 74, 101, 102, 113, 116
Affected floors: secrets retain outbound redaction; spend cap retains existing reservation limits with no additional calls; stop retains send admission; no duplicate sends retains journal intent/UNKNOWN fences; durable intake retains the existing journal and ownership path.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Small default-on user-facing answer-path repair in the shared journal runner; no authority expansion.
Side effects: Legacy outputs that combine a nonempty reply and memoryList:true now preserve that reply. Explicit listing uses an empty answer and the existing inventory renderer; lookup turns retain their existing no-inventory fence. This is a protocol clarification, not a memory migration. Outside the brief, dark rungraph graduation metadata is renewed for fourteen days using the existing finite gate; it remains dark and cannot graduate without production liveProof. The expired deadline remains recorded here rather than being represented as met.
Undo and recovery: Revert this commit to restore the old prompt and replacement condition; no state conversion or data deletion. Existing persisted intents replay unchanged and are not resent.
Multi-machine posture: The same pure rendering condition and prompt apply on each machine. No new state or coordination mechanism; existing writer ownership, durable intake and send fences remain authoritative.
Layer below: Read both governing documents and 1.x recall research. Inspected recorded S questions, memories, recalled ids, model reasons, delivered inventories and negative answer; traced the September 27 override and broadening at e19372b4/08335a9f, October 9 main a035d5ed, lookup exception faf9c75f, and train-145 diff. Existing model-owned lookup and inventory rendering are reused.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/recall-meaning.test.ts; live=tests/preview/fixtures/recall-meaning-2026-10-24.json (captured failure; repaired live acceptance belongs to desk group S)
Decision: recall-meaning-register-renewal | The shared dark rungraph deadline expired at 2026-10-25 00:00 UTC. Follow the existing repo-checks-1010 finite renewal to 2026-11-08 00:00 UTC; retain dark status, P5-NF-54, missing-liveProof refusal and strict expiry. Desk reassessment is owed by that date; this grants no runtime authority or graduation. Regenerate existing publication pins through the desk tools. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/recall-meaning-1024-PROGRESS.md
Hook bypass: none
Convergence: none
Decision: recall-meaning-answer-precedence | Preserve any nonempty answer; reserve the existing list flag plus empty answer for explicit inventory, avoiding a new intent classifier or model call. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/recall-meaning-1024-PROGRESS.md
Prompt review: No phrase from a recall question is copied into instructions. The inventory instruction stays within its prior byte budget so optional recall evidence is not displaced. The model decides inventory intent; the code checks only the exact empty/nonempty answer protocol. Historical fixture strings are evidence, not new instructions. No delegated question is issued.
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."


## Closing block

simplestRobustRoute: This is the simplest robust route: narrow the existing inventory instruction and require an empty answer before invoking its renderer. The named failure is replacement of a correct answer already produced from memory. No extra model, classifier, storage or new service. Start guards remain verified operator and valid fields; end guards remain checked durable delivery; existing resource/lookup limits remain. Offline replay is submitted, not an unattended live-success claim.
80/20: Fix the ambiguous replacement boundary, prove fact/list/not-found neighbors and keep the existing floors. Targeted checks and the desk live rerun decide acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
