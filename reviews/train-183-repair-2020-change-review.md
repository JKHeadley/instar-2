# Change review — train-183 durable carry fixture and owned notice consumers

Subject base: 4f757630a097af8400f1de10fcf3f1e9147b26a5
Review state: open
Reviewed content: none
Outcome: Repair the stale activation-notice consumers using their owning patch and persist the refresh CLI fixture's source people before close/reopen; preserve exact two-put baseline and later put/tombstone behavior. Source handoff only; row40 OPEN.
Affected rules: 26, 32, 34, 36, 37, 49, 56, 70, 74, 101, 102, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing runtime enforcement; only tests and review records change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Bounded test-consumer and durable fixture repair, no runtime feature, prompt, provider, authority or policy change.
Side effects: The notice files are exact owner copies including captured positive/negative controls. The carry fixture now writes source-backed summary frames via the actual journal API and records the later operator change as an accepted turn before its summary. A portable journal-boundary regression shares that fixture with the unchanged macOS CLI gate. All original counts, refusal checks, platform guards and timeouts remain. Wall-clock fixture projection matches the actual CLI child clock instead of mixing October fixture time with November launch time.
Undo and recovery: Revert the source repair commit; no installed state or migration is involved. Original failure evidence and all ancestor commits remain.
Multi-machine posture: Tests run on local temporary encrypted journals and exercise durable source reopen, carry, refresh, destination reopen and idempotence. Existing replication, origin, grant and audience checks are unchanged. Native two-runner acceptance remains desk-owned.
Layer below: Actual journal summary reservation/append/replay, journalRelationships, emitRelationshipChanges witness and HLC, appendGroupCarry durable baseline and refreshGroupCarry. Existing credentialDisplayLabel/credentialNotices remain unchanged. No new runtime store.
Bug class: integration
Bug evidence: reproducer=tests/preview/group-carry-cli.test.ts
Hook bypass: none
Convergence: none
Prompt review: No runtime prompt, model-output parser or accept/escalate/refuse decision changes. Existing notice captured-byte tests are retained. New fixture summary text records known synthetic operator messages through real journal frames; no model judgment or historical capture is fabricated.
Decision: train183-2020-notice | Apply exact e7f0d6de with --no-commit, retaining both consumer files byte-identically and adapting only the retained review's ancestry/report provenance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-183-repair-2020-PROGRESS.md
Decision: train183-2020-durable | Repair only the fixture after a real journal-boundary reproduction lost both people on reopen, tombstoned both during carry, and produced five emits with no later delete. Persist source summary frames and use the actual CLI clock domain. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-183-repair-2020-PROGRESS.md
Decision: train183-2020-handoff | Preserve known Rule56 expiry under owner model-map-evidence-refresh-1105 and all unresolved correct-host/full/native/independent/installed/live debt; no timestamp or certificate edits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-183-repair-2020-PROGRESS.md

1.x comparison: Verified actual JKHeadley/instar origin/main bc4355b8075dad89e8667ab082c526c0460b0455. Searched src/ and docs/specs/ for activation expiry and durable/tombstone behavior. Read src/monitoring/MissingLoginSessionDetector.ts, src/core/ReplicatedRecordEmitter.ts witness-before-tick/append, src/core/JournalSyncApplier.ts fsync-before-applied, and docs/specs/WS2-SEND-SIDE-EMISSION-SPEC.md journal-sourced HLC union/retained tombstones. History ff8344b4b/d4242edc4/6efb50acd and ONEX-LESSONS sections5/6 inspected. Existing 2.0 emitter/applier already adapts this durable design. No new legacy transplant fits a transient fixture view or activation label reader; retain the existing implementation and the owned e7f0d6de consumer patch. Group CLI history across fetched refs ends at3bd863962/81d6682fc/62126fdae/d22fe24c8; no competing durable-fixture owner found.

Evidence: Authorized train183-readable-evidence-2019 bounded log retains exact4f FAIL17:29 (prior quota diagnosis update367055154) and PASS18:22, source lines15268-15270/15283-15285. They are historical, not this repair's live proof. Before repair, the real journal-boundary diagnostic extracted the original CLI setup and emitPeople implementation: emits1/2; reopen people=[] and summaries=0; carry appends deletes3/4; subsequent emitPeople('Porto',true) returns one put, zero deletes and seqs1..5. This isolates a fixture defect without weakening the producer. Portable regression now asserts durable source people/attribute, carry emitsThrough2 without deletes, later put/delete3/4, unchanged predecessor bytes, no-op repeated refresh and reopened destination Sam/Porto with Ana absent. The macOS confined HTTP CLI check remains required on the correct host.

simplestRobustRoute: This is the simplest robust route: reuse the exact owned notice patch and make the existing fixture use the journal's durable source path. No new runtime machinery, stores, skip, widened deadline, provider calls or authority changes. Journal admission, disclosure/audience checks and original resource bounds remain the entry/exit/limit guards. Source-only evidence is not an autonomous shipped-path claim.
80/20: Stop at the bounded causal test repair and normal static gates; preserve known shared Rule56 ownership and host debt without a broad WSL sweep.
VERDICT: author submission; independent acceptance remains with the desk
