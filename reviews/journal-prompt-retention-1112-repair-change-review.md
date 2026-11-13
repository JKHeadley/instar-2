# Change review — Preserve sources and truthful replay through prompt retention

Subject base: 3783357cbaf5933fa0e58936a70941c22cb8ac85
Review state: open
Reviewed content: none
Outcome: Preserve unique source bodies and provenance when retiring old rolling prompt context; mark affected referenced calls not-faithful without changing output or accounting.
Affected rules: 7, 26, 33, 41, 58, 70, 74, 102, 111, 113, 116, 123
Affected floors: secrets — existing encrypted/redacted record; spend cap — unchanged accounting and no additional calls; stop — unchanged; no duplicate sends — unchanged intents and receipts; durable intake — unchanged original messages
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Local repair of an encrypted retention transform and its replay evidence, with no new effect path or model decision.
Side effects: Source content now contributes to retained size, as required for unique knowledge. All reservation, lookup, format-retry and answer-replace references to the exact retired final prompt lose faithful eligibility; inline, recent and different-hash inputs retain their existing evidence. Repeated compaction preserves the marker.
Undo and recovery: Revert the repair commits to undo this projection change, but doing so restores the reviewed loss and false-evidence defects. Already deleted source bodies cannot be recovered by this repair; restore an encrypted pre-retention backup if necessary. Original hashes, outputs and call usage remain unchanged.
Multi-machine posture: Existing encrypted replicated snapshots carry source bodies and replay transformations identically. No new local-only store or ownership path.
Layer below: Inherited 1.x comparison rechecked at JKHeadley/instar ee957c98be8e09cf83285ee6140b20e981d79787: src/messaging/MessageStore.ts cleanup, src/messaging/TelegramAdapter.ts rotation, docs/specs/bounded-accumulation-standard.md and their git history (9065c5040, 7ac38f1b8, 753857c0e). Resolution-first retention and audit preservation fit the existing encrypted compactor; plaintext rotation/SQLite pruning do not. Studio ONEX-LESSONS.md section 5 (memory/coherence), fetched through its authorized file API, reiterates bounding indexes without deleting source history. Also inspected deskStatusSource, launcher reservation references, retainedEvidence and replayEligibility.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-prompt-retention.test.ts
Hook bypass: none; core.hooksPath unset, actual repository hooks directory contains sample hooks only; plain git commit and push.
Convergence: none
Validation: 50 focused tests pass across four files; the final retention-file run passes all 10 cases, including paired same-input/different-input retries; two new regression probes fail on unrepaired 3783357 and pass on the repair. Typecheck/build pass. Register replay uses 35d138ea8a634e46fb3df258e727ff173219a5a2. Native R105 composition certificate renewal requires the Studio; no declaration is edited.
Decision: retention-repair-register | Run the authorized desk rehash/repin tools and replay the generated register from the committed repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/journal-prompt-retention-1112-repair-build-report.md
Team posture: Source ownership and audience metadata remain inside the existing private encrypted journal. Existing owner/member/guest standing controls access; no sharing or authority is widened.
Decision: retention-repair-sources | Retain complete source bodies/provenance because mutable desk reports can have no other durable copy. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/journal-prompt-retention-1112-repair-build-report.md
Decision: retention-repair-replay | Match each answer-attempt reference and original hash to the retired prompt, mark input body-not-retained, and preserve all output and accounting evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/journal-prompt-retention-1112-repair-build-report.md
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No turn-time prompt or semantic gate changes. Historical source bodies are preserved; exact referenced replay reports input body-not-retained after retirement. The new tests age six captured proof-room prompts and preserve seven recorded output shapes. Existing prompt findings below are unchanged protocol guidance, not new semantic phrase gates.
Prompt finding: 105c1569b6bb | protocol-literal | Unchanged existing prompt instruction; no semantic literal gate introduced — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "once stopped, this installation refuses renewal."
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged existing prompt instruction; no semantic literal gate introduced — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 7ef11b68103f | protocol-literal | Unchanged existing prompt instruction; no semantic literal gate introduced — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "after that it cannot read or answer messages here. its activation must be renewe"
Prompt finding: 849db3a6296a | protocol-literal | Unchanged existing prompt instruction; no semantic literal gate introduced — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Unchanged existing prompt instruction; no semantic literal gate introduced — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: 9f0106c66027 | protocol-literal | Unchanged existing prompt instruction; no semantic literal gate introduced — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: bac6ce7485d9 | protocol-literal | Unchanged existing prompt instruction; no semantic literal gate introduced — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged existing prompt instruction; no semantic literal gate introduced — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

Subject (11 paths): tests/preview/journal-prompt-retention.test.ts, tests/preview/journal.ts, tests/preview/model-call-boundary.ts, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/required-release-checks.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest route: retain sources in the existing encrypted projection and carry a retention transformation on the affected existing model-call records. Start: settled turn outside the existing retention window; end: verified atomic snapshot with preserved knowledge and honest replay; limits: pending work, recent exact prompts, and all five existing floors. No service or new retention gate.
80/20: Two source defects repaired with fewer than 25 product lines changed; regression coverage exercises complete snapshots, repeated compaction, reopen, recent/inline boundaries and real recorded shapes. No full suite run on the M5.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
