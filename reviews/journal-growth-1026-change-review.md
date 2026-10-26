# Change review — bound idle journal diagnostics and snapshot strings

Subject base: fcc49ab27f44ff45831a7797e4849a277b7d48c3
Review state: open
Reviewed content: none
Outcome: Idle checks retain diagnostic transitions; compaction bounds redundant sentinel observations and handles snapshot JSON without aggregate strings.
Affected rules: Rules 7, 9, 13, 15, 26, 32, 33, 41, 44, 45, 49, 58, 60, 61, 70, 74, 75, 101, 113 and 116.
Affected floors: Secret custody, spend caps, stop, durable intake and no duplicate sends keep their existing owners and causal records. No model, admission or delivery decision changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Internal journal encoding and diagnostic retention; the existing authenticated format and atomic replacement protocol are preserved and tested through crash recovery.
Side effects: Old timing detail is represented by the latest 100 observations. Unchanged sentinel observations keep the latest 100 per family plus exact totals/current state; events and changed decision states remain whole. Every model-call record stays whole. Diagnostic phase caches reset on restart and affect no checks or effects. The journal still materializes state/evidence in memory; no claim of bounded total history storage is made.
Undo and recovery: Keep the latest journal, including post-upgrade intake and effect receipts. Revert diagnostic sampling or the snapshot writer if necessary, but retain the bounded reader once snapshots exceed the old string limit. A pre-upgrade backup is forensic evidence, never a replacement active journal.
Multi-machine posture: Version-1 encrypted snapshots, digests and retained decisions remain portable and replicated by existing journal machinery. Timing suppression caches are deliberately worker-local observations, not shared authority. No new store or replication protocol.
Layer below: Constitution read in full; inspected offset-authenticated encrypted frames, native JSON limits, replay/restore, pending-evidence validation, fsync/rename ordering, group audience checks and live sentinel state projection. Inspected 1.x JsonlStore and jsonl-rotation; their plaintext segment deletion cannot replace the encrypted causal journal, so existing 2.0 snapshot machinery is reused.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-growth-bounds.test.ts
Hook bypass: none; core.hooksPath unset, common hooks directory contains sample files only.
Convergence: none
Prompt review: No prompt, model-output classification, accept/escalate/refuse policy or briefing changes. Snapshot decoding round-trips recorded model shapes exactly; it does not interpret model output.
Decision: retention | Keep all model-call provenance under Rules 41/58/75. Summarize only repeated sentinel observations; retain events, changed states and active/stalled progress clocks, with exact current state and family totals in the projection. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/journal-growth-1026-PROGRESS.md

ELI16: Rechecking the same locked door should not fill a notebook every second. Keep changes and real attempts. Pack the notebook one page at a time so its total size cannot exceed one string's limit.

simplestRobustRoute: This is the simplest route through the existing snapshot format: sample only repeated diagnostic states, summarize redundant sentinel observations using their existing aggregate projection, and serialize/parse/hash JSON in bounded pieces. A separate archive, new snapshot schema or database would add migration and recovery machinery. Bounds apply to JSON buffers/tokens and existing journal frames; the complete projection digest and pending-evidence check still hold before atomic replacement. No autonomous effect completion or live deployment is claimed.

Evidence: Failing tests first reproduced the aggregate-string failure, 301 retained redundant sentinel rows, and 14,400 timing rows for two repeated phases. Targeted tests cover both sides of sampling/retention, malformed JSON, Unicode split boundaries, synthetic retained history beyond V8's maximum string length, native journal crash recovery, rollback and replication. Read-only backup analysis replayed 2,974 recorded shapes. An isolated encrypted copy compacted from 99,839,955 to 23,835,398 bytes and reopened with an identical projection digest and all pending work/accounting unchanged. Source backup and live root were not modified.
80/20: Submit targeted test and actual backup-copy evidence for the desk's independent gate; no full-suite or live-operator claim.
VERDICT: author submission; independent desk acceptance pending
