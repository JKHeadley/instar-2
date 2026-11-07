# Change review — plain continuity for ordinary replies

Subject base: 14748355a844739f3e99cf400973ba08a3a45276
Review state: open
Reviewed content: none
Outcome: Every newly composed continuity disclosure uses the existing plain wording, including ordinary, pending and superseded replies. Exact inbound, frontier and delivery evidence stays in ContinuityAccount.
Affected rules: 26, 34, 36, 49, 70, 74, 77, 80, 101, 102, 110, 111, 113, 116
Affected floors: secrets — unchanged outbound checks; spend cap — no new call; stop — unchanged; no duplicate sends — unchanged intent/receipt; durable intake — unchanged journal and captures
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Small user-facing wording repair touches the persisted continuity reader and writer.
Side effects: Plain disclosure is now accepted for ordinary answers as well as unknown-answer notices. The historical detailed format remains readable; already delivered bytes are not rewritten. Exact capture, frontier, basis, disposition, grounding, spoken/silent and digest validation remains. No change to continuitySpoken or when the worker asks it. The rolling-frontier wording count retains both summary and set-aside disclosures under their shared plain prefix. Pending wording remains accurate for held, failed and unconfirmed ordinary replies and does not claim a task stopped.
Undo and recovery: Revert the writer and wording pins before deployment; after deployment retain additive reader support for newly persisted plain ordinary accounts. Never resend uncertain effects or rewrite delivered evidence.
Multi-machine posture: Publish the matching reader and writer to all hosts. Existing replicated journal, ownership, capture and send identities remain unchanged; no local state is added.
Layer below: continuityFor disposition/reference derivation, projectRow persisted account validation, continuitySpoken identity-based suppression, reply digest binding, historical continuityDisclosure and existing stopped-task/ordinary worker tests.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/journal-boundaries.test.ts; live=tests/preview/journal-boundaries.test.ts
Live evidence context: The authenticated assigned brief reports the delivered sentence naming frontier 46040892 and previous inbound 46040893 at 2026-11-06 19:30 PST. The test preserves that excerpt as a negative control; it does not claim a fresh live journal read or live fix delivery. The new ordinary-worker regression failed against unmodified 14748355 and is rerun against this repair.
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only.
Convergence: none
Prompt review: No model prompt, parser or acceptance policy changed. Existing recorded-shape tests exercise uncertain task 2184, Jev/review update 969390396, proof-room continuity samples and summary/delivered/empty-context shapes; empty context is not evidence of an empty Telegram delivery. Fixed candidate prose and persisted reader compatibility are changed. The old ordinary-answer rejection becomes acceptance under the explicitly requested all-reply policy; malformed wording, basis, digest and capture still refuse.
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged grounding instruction.
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged memory inventory response.
Prompt finding: 85544c20941f | protocol-literal | Existing unchanged waiting message.
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged source-label instruction.

1.x comparison: Actual JKHeadley/instar main 8c2a16e67b394990ea8a7fd761ede283fbc3900f fetched and searched in src/, docs/specs/ and history. Read src/messaging/plainNoticeCheck.ts (history f0d03ccc8), docs/specs/wedge-recovery-message-loss.md and ONEX-LESSONS sections 3/5. Reuse plain outward wording and test-time internal-ID detection, keeping notice-versus-answer accounting. The watchdog recovery machinery does not fit a wording-only repair; the existing 2.0 formatter and durable account provide the required behavior without another runtime gate or store.

Decision: train-195-idleak-plain | Use the existing plain formatter for every reply and admit it in persisted ordinary accounts; retain historical reader compatibility and exact internal evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-idleak-1952-PROGRESS.md
Decision: train-195-idleak-pending | Keep no finished answer is confirmed: accurate for undelivered, held or failed ordinary turns, without claiming a stopped task. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-idleak-1952-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=Existing prerequisite descriptions are republished unchanged; no work is deferred.
Generated publication: Existing replay generator from committed source 325be822f8da3bf734fd4aa1561f5d62fa9070bc, generation sha256:de3ce6338c476286e3c4bc995d6cd491bb4ff0e5350a579318be10e9b48fc203. No authority declarations or native certificates changed.

Decision: train-195-idleak-pins | Refresh existing owner artifact hashes and generated register publication with the desk tools; no grant or native conformance declaration changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-idleak-1952-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the existing plain formatter and remove its notice-only reader/writer restriction. No new runtime mechanism. Existing intake and account validation are start/limit guards; confirmed send and exact digest remain end guards. No unattended live completion is claimed.
80/20: Prove the reported failure red then green, preserve semantic checks while updating wording pins, run the named targeted and pinned-text checks, then submit the pushed head to the Studio gate.
VERDICT: author submission; independent review belongs to the desk
