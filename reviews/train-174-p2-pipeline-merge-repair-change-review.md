# Change review — train-174-p2 pipeline merge repair

Subject base: a8f354e1b3aa6497624afdcc1c31426a8b5d257e
Review state: open
Reviewed content: none
Outcome: Merge current main c20b68d1d9b5744a72c243c4dc8a4b69114179d6 into train-174-p2, retaining the candidate's combined declaration shape and main's approved Rule 121, preserving both histories and publishing the register from the combined committed source.
Affected rules: 7, 26, 34, 36, 37, 42, 44, 60, 61, 66, 74, 90, 91, 95, 101, 111, 112, 113, 116, 119, 121
Affected floors: secrets — no credentials or custody paths changed; spend cap — no provider or budget changes; stop — existing guard, lapse and supervisor enforcement unchanged by this merge; no duplicate sends — no dispatch changes; durable intake — no journal changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: integrates an already approved constitutional amendment and regenerates its governed register publication; no new constitutional wording is authored here.
Side effects: generated register now enumerates 121 rules and 298 entries from the combined tree. The reviewed candidate shape remains, main's Rule 121 row and declaration hash are added, and prior changelog entries remain byte-identical. The source conflict is only the conversion publication pin. The existing desk derivation tool computes it from the combined anchor; no runtime authority or new capability restriction is introduced.
Undo and recovery: revert the merge with its generated publication and this review as one change, then replay from the resulting committed source; retain the merge and review history. No installed data migration or journal reversal is required.
Multi-machine posture: machine-independent git publication; native worker observations remain local to each host. No peer dependency or shared mutable state is introduced.
Layer below: scripts/build-register.mjs checks the canonical anchor, shape and document hashes; register-source/bootstrap-anchor.json combines the candidate shape and main's new rule; scripts/register-source.mjs supplies the existing parsing and declaration generation. Inspected scripts/fixed-native-worker-enforcer.c slot_thread, guard_backstop and END report path plus scripts/fixed-native-worker-monitor.mjs terminal mapping to identify the separately owned native failure. terminal 99 remains unknown and 31 remains stopped; this merge alters neither.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no model prompt, model-output parser or accept/escalate/refuse policy is changed by this merge. Rule 121 arrives verbatim from approved main and does not enter a new model-facing excerpt. The required four constitutional briefing regression files are exercised separately; the existing recorded summary cases retain their original fixtures.
Deferral: generated/conversion.json:1 | not-a-deferral=generated constitutional register text, not a new commitment by this repair
Deferral: generated/register.json:1 | not-a-deferral=generated constitutional register text, not a new commitment by this repair

1.x FIRST comparison: inspected actual JKHeadley/instar origin/main ab256f684cda141db19abe8bba5300b980e1025b, src/lifeline/ServerSupervisor.ts (evaluateUnhealthyServer and CPU-starvation handling), src/core/cpuStarvation.ts, docs/specs/supervisor-cpu-starvation-restart-guard.md and history 41bda81c0, 775e68b31, 27dc38944. ONEX-LESSONS session/lifecycle entries for enforced-termination-watchdog, lifeline-self-heal-hardening and session-respawn-thrash-elimination informed the comparison. Reuse the distinction between actual progress, hard deadlines and independent enforcement. The 1.x restart-defer behavior is not a transplant for a fixed-worker authority lapse; this merge keeps the existing 2.0 native enforcement. The conversion conflict is specific to the existing 2.0 register publication, so its own canonical derivation and replay are the simplest fit.

One cause, one repair: the supplied native assertion at tests/assembly/fixed-worker-monitor-native.test.ts:388 is explicitly owned by origin/fix/train174-cleanup-assertions-1105, initial commit 282d2655bc70b8071181660a7f0bd13e2b817f7c. The desk's train174-cleanup-assertions-1105.txt assigns it to a separate branch, and its independent Astra review has a timing-claim must-fix assigned in train174-cleanup-assertions-1105-pipeline-repair-121707-mama.txt. No competing repair or unapproved combine is authored here. Acceptance remains the owner's corrected timing claims, both injected-delay outcomes, independent review and desk combination. A local 1/1 passing rerun of the original assertion is recorded only as baseline evidence, never as exoneration. The full pipeline retains the red evidence and owns qualification after combination.

Merge evidence: 4d7e90c27489c1651723d43c22b14a422af9265c has both the exact candidate and current main as parents. Existing desk train-11-rederive-anchor.mjs derived sha256:5c4f6ec00fff897d806c46112f957e2a9c8fb8b314795942a2fa5ad14d2d0503. desk-rehash-owner-manifests.mjs refreshed zero pins and desk-repin-chain.sh updated zero inventory entries. build-register.mjs --replay --commit 4d7e90c27489c1651723d43c22b14a422af9265c published generation sha256:c45e1e36d1859bca4f98ec60298196a4db3f7522e598a1089cd5bdf45317f4f8 (298 entries, 121 rules, shape-only). No pin was handwritten, no backdated clock used and no certificate declaration altered.

## Closing block

simplestRobustRoute: one ordinary merge, the existing canonical anchor derivation and replay, and the existing targeted checks resolve this publication conflict while retaining both behaviors and histories. This is the simplest robust route; no new mechanism is added. Start guards are the named parents and clean worktree; end guards are generated-source agreement, targeted tests, typecheck and cheap gates; limits are the unchanged five floors. No unattended product completion or independent approval is claimed.
80/20: verify the merged rule publication and affected briefing consumers without a full suite or load run; retain the separately owned native failure and its independent-review requirement instead of duplicating its repair.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
