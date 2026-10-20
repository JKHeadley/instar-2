# Change review — train-89 Telegram file delivery integration

Subject base: ec8ed1d8f759f760d93e5b0a1509c92b774f30c8
Review state: open
Reviewed content: none
Outcome: Integrate reviewed Telegram file paths and protected audio transcripts while preserving the live train-84 behavior.
Affected rules: 1, 4, 26, 30, 32, 34, 36, 37, 44, 45, 49, 60, 63, 66, 69, 70, 74, 84, 86, 90, 95, 100, 101, 102, 105, 111, 112, 113, 115, 116
Affected floors: Existing raw-byte and transcript custody/held-secret protection, spend admission, stop, unique dispatch and durable encrypted intake remain. No new authority or provider.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Carries the reviewed model-visible file/transcript boundary and its secrecy guards.
Side effects: All file types use the protected path; voice/audio retain existing local transcription and transcript protection before persistence and consumption. PDF-specific decoders and unused dependencies remain removed. The historical audit forms remain valid without accepting invented captions. The live realpath normalization remains on both PDF test roots. No production logic is changed beyond the reviewed member.
Undo and recovery: Revert through review and regenerate publication; preserve encrypted originals, transcripts and dispatch records. No uncertain effect replay.
Multi-machine posture: Files and decoding remain deliberately machine-local on the admitted conversation owner's bounded volume; no ownership or replication policy changes. WSL verification is not Studio live acceptance.
Layer below: Complete constitution, both member progress reports, reviewed source and custody tests, live conflict hunk, inherited harness admission, and cint-L37 desk chain inspected. Regenerated hashes bind the merged tests; native certificate and context guards are unchanged.
Bug class: integration
Bug evidence: reproducer=tests/preview/pdf-attachment.test.ts; live=tests/preview/fixtures/gap-pdf-1017.json
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Prompt review: No additional model-facing changes beyond the reviewed member. Retained recorded summary 715672480, uncertain 715672483, Jev undecided 715672482 and unsure 969389570, reply review 969389923, delivered 715672479 and empty context 715672550 replay through protected transcript/file preparation. Recorded failure 6234449 and voice telegram:12345678:update:1 retain their original meaning. Fresh live acceptance belongs to the desk.
Decision: train-89-merge | Ordinary merge of exact reviewed 528d07b815dcee2dc59210cefaa53d99d4a94488. Read both Studio reports telegram-files-1018-p2-PROGRESS.md and telegram-files-1018r-PROGRESS.md under /Users/dabombstudio/.instar/agents/echo/.instar/lanes/; the latter records the reviewed audio repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-89-PROGRESS.md
Decision: train-89-A | Preserve the final member audio repair and live behavior. Resolve pdf-attachment with the slim member tests plus realpathSync around both temporary roots, as explicitly directed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-89-PROGRESS.md
Decision: train-89-B | Create branch directly at exact live base ec8ed1d8f759f760d93e5b0a1509c92b774f30c8; no main merge or branch movement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-89-PROGRESS.md
Decision: train-89-C | No genuine product conflict and no omitted head. Preserve base generated files only as a temporary valid input, then regenerate all publication files after the source merge; no hand merge of generated content. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-89-PROGRESS.md
Decision: train-89-D | Apply WSL e2e/integration and macOS exclusions, and report host-dependent evidence honestly. Desk owns Studio live and native acceptance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-89-PROGRESS.md
Decision: train-89-desk | Use downloaded repin/build/rehash/replay chain, with Linux sed syntax; refresh the two media test pins and regenerate from the merge source. Preserve native conformance declaration and context guard constants. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-89-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=Existing declaration wording reproduced by the generator; no new deferred repair.
Verification: Focused changed/direct-importing files, requested journal and subscription checks, default-context-floor, pinned READY list, typecheck, lint, architecture, register and review checks; exact results in local desk handoff report.
simplestRobustRoute: This is the simplest robust route: one ordinary merge of the reviewed head, the exact prescribed test conflict resolution, and the existing desk regeneration tools. Added machinery: none. Existing admission, stop, custody, source binding, bounded files/transcription and durable dispatch guards hold. No fresh unattended live-completion claim.
80/20: Only targeted/direct-importing tests and explicit train checks, no full suite or comparison worktree.
VERDICT: author submission for desk gate; no independent convergence or live acceptance claim
