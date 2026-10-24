# Change review — Preserve copied history across bot update streams

Subject base: e44d3ce1985cc2e47620541d55ab03ae0bba8f8b
Review state: open
Reviewed content: none
Outcome: The test-copy command stages complete source journal frames into a new root, durably rebinds to the same operator on a different bot, and fences sends to that test chat. New test-bot intake follows the copied chronological frontier, so ordinary history, summaries and recall remain visible even when the new bot's wire counter starts lower.
Affected rules: 5, 7, 28, 29, 32, 34, 35, 42, 44, 45, 63, 70, 74, 89, 96, 101, 102, 113, 116. Rule 96 requires ordinary history rather than a saved-memory substitute; Rules 7/44/45 require replay and compaction to preserve its meaning. Existing principal, audience and effect checks remain at their doorways.
Affected floors: secrets — raw custody and writer verification unchanged; spend cap — existing accounting and bounds retained; stop — existing intake/dispatch stop checks retained; no duplicate sends — bot-qualified turn ids, raw update ids, cursors and effect receipts retained; durable intake — chronological position recorded in the same intake frame before processing.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: This repairs model grounding across a bot rebind, and checks chronology without changing authority or broadening the copy audience.
Side effects: The initial unit copies only complete encrypted journal frames, not logins, media custody or ownership files; source bytes are read-only. The rebind preserves lineage signing identity, resets only the copy's polling stream and counts dropped source waiting items. Launcher genesis checks remain strict; physical dispatch fences the test chat and strips copied forum threads only after signature verification. Copied turns now use a journal-local chronological update for consumers already ordering on Turn.update. Telegram wire update, raw evidence, cursor and bot-qualified identity stay unchanged. Edit lineage must compare chronological positions and must not link a source bot's private-chat message to a different bot's edit. Non-copy intake retains its existing numbering.
Undo and recovery: Revert the repair before creating new copies. Once new historyUpdate frames have been written, retain this reader or a forward fix: older readers do not understand the additional position and can refuse later chronological intents. Never renumber existing signed or reserved evidence. Legacy rows without the field retain their original projection; subsequent corrected intake follows the complete frontier.
Multi-machine posture: Deliberately machine-local, as the existing test-copy store is. The durable intake position replays identically on another reader or after snapshot compaction; no new store, coordination service, authority or transport is introduced.
Layer below: Inspected the original six-file unit diff from e44d3ce1, complete-frame copying, staging/rename durability, genesis/rebind validation, lineage signer/system-writer preservation, launcher binding and test-chat physical dispatch. Inspected intake authentication and raw writer binding, bot-qualified turn identity, waiting/cursor suppression, edit lineage, journal projection/snapshots, synthetic turn positions, history/summary/recall frontier consumers, and outgoing intent matching. Source encrypted bytes remain unchanged.
Bug class: integration
Bug evidence: reproducer=tests/preview/test-copy-ordering.test.ts
Hook bypass: none
Convergence: none
Decision: test-copy-ordering-1020-D1 | Persist historyUpdate on copied intake and project it as Turn.update, retaining wire ids and cursors. This repairs every existing chronological consumer without a new service or renumbering old evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/test-copy-1020-repair-102419-PROGRESS.md
Decision: test-copy-ordering-1020-D2 | Match edit lineage within the current bot stream, using chronological comparison; equal private-chat message numbers in different bot streams cannot establish lineage. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/test-copy-1020-repair-102419-PROGRESS.md
Decision: test-copy-ordering-1020-D3 | Extend this author review to the original four test-copy commits after the checker found them uncovered, documenting their staged-copy and dispatch behavior without claiming independent convergence. The reviewed unit remains confined to e44d3ce1 onward, not the inherited train. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/test-copy-1020-repair-102419-PROGRESS.md
Prompt review: No prompt wording, output parser, judgment or refusal policy changed. The model context now includes the ordinary copied history required by Rule 96. Recorded proof-room rows and model-output shapes are replayed; fresh model-port answers are deterministic test responses, not claims of live judgment quality.
Prompt finding: 4106b49fff07 | protocol-literal | Existing guidance tells an agent how to describe attempted work; the quoted invariant is unchanged by this ordering repair.
Prompt finding: 849db3a6296a | protocol-literal | Existing exact empty-memory status protocol is unchanged by this repair.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-label provenance instruction is unchanged by this repair.

Deferral: generated/register.json:1 | not-a-deferral=Generated register text retains existing governed vocabulary; it does not defer this repair.

Generated wiring: Ran the delegated owner-manifest rehash and repin chain (no manifest or inventory bytes changed), then replayed the register at implementation commit 837c466e4878b244323e26f9523b00f3d5202aba. Only generated outputs refresh the journal source pin.

## Instar 1.x reuse disposition

1.x precedent: `JKHeadley/instar`, `src/core/BackupManager.ts`, `createSnapshot()` and `restoreSnapshot()` (reviewed by Astra at main `8bbf18fc984b55b3e17d0f2adb43e055c6662756`, as recorded in `astra-train-146-evidence/one-x.json`). The reused behavior is selective state copying that excludes secrets and machine custody and checks safety before restoration; 1.x records a snapshot manifest and refuses restoration while sessions are active. This is behavioral precedent, not a claim that its code was ported. Its selected-file snapshots and in-place restore do not supply complete encrypted-journal frames, preserved signed lineage, or a durable bot/chat rebind, so there is no direct implementation fit. The existing 2.0 journal, carry and dispatch primitives remain the implementation base: complete-frame staging, durable test rebind and guarded publication preserve those journal-specific contracts without transplanting BackupManager or adding machinery (Rule 116).

Pipeline repair scope: This paragraph supplies the missing reuse judgment only. The concrete purpose is to run a retained-history copy on a test bot without touching the source root or sending into its conversation, enabling answer checks on the copied agent. Runtime behavior, invocation policies, inherited evidence and acceptance limits remain unchanged; this documentation correction claims no fresh live proof or full-suite result.

## Closing block

simplestRobustRoute: Persist a chronological position only on intake after the existing durable test-copy rebind, while retaining the raw wire identity. Existing history, summary and recall consumers then work unchanged. The extra field prevents unrelated bot counters from hiding copied history; its persistence prevents replay from reinterpreting old evidence. Existing authentication, resource limits, stop and dispatch guards remain the start, limit and end-state guards. This is the simplest robust route; no autonomous live-completion claim is made by these offline tests.
80/20: Confined to the review's ordering defect and its immediate identity, edit and durability neighbors. No service, capability restriction or new review pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
