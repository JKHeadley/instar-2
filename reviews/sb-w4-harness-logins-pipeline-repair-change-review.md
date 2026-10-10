# Change review — Migrate installed single-login custody before harness readiness

Subject base: 58771f5dfed27016fe7a688472bc28e6b02e4731
Review state: open
Reviewed content: none
Outcome: Existing single-login installations with legacy custody migrate their verified login into profile-bound custody before harness readiness, so accepted work can answer. Explicit pools retain provisioned per-profile custody.
Affected rules: 1, 4, 14, 15, 26, 32, 37, 41, 42, 44, 45, 46, 49, 57, 58, 69, 70, 74, 75, 77, 90, 100, 101, 102, 111, 112, 113, 116
Affected floors: secrets — runner-only custody and exact account/org/plan checks precede migration; spend cap — existing shared reservations unchanged; stop — existing stop checkpoints unchanged; no duplicate sends — existing journal deduplication and no call replay; durable intake — journal intake unchanged, migrated credential fsynced before atomic installation
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repairs an installed credential admission path that prevented the real preview from answering.
Side effects: A single-login runner may create one profile-bound credential from a matching legacy record at readiness. Existing entries are never replaced, even when unusable. Legacy custody remains available to older runners. Pool provisioning and account assignments do not change. Register artifacts are regenerated from source, never edited by hand.
Undo and recovery: Revert this repair to restore the previous source behavior. Preserve newly provisioned custody for subsequent runs; older code already understands that format. A refused identity requires matching reviewed custody; migration never substitutes another account or overwrites an existing bad record. No live runner or Shared file was changed during verification.
Multi-machine posture: Deliberately machine-local credential migration, performed under each host runner identity with its existing reviewed profile. No credential replication, new profile selection or peer dependency.
Layer below: Checked actual legacy custody shape read-only, readHarnessLogin owner/mode/account checks, harnessGate readiness and recheck, atomic filesystem link semantics, sealed activation resolution and the shipped journal launcher. The failed copy records update 715675403 with zero replies and unavailable harness custody.
Bug class: live-path
Bug evidence: reproducer=tests/preview/harness-login-launcher.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-harness-logins-repair-PROGRESS.md
Hook bypass: none
Convergence: none
Decision: MIG-1 | Migrate verified legacy custody only for existing single-login runners; keep strict dispatch reads and explicit pool provisioning. Atomic non-overwriting installation prevents concurrent startup replacing a provisioned login. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-harness-logins-repair-PROGRESS.md
Prompt review: No prompts or judgment parsers changed. Recorded summary/uncertain summary, Jev undecided/unsure, reply-review, delivered reply and empty-context shapes replay through migration and selection; exact source/update ids and the empty-candidate limitation are in PROGRESS. Launcher tests retain physical IO substitution and do not claim a new live answer check.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse existing credential validation at the harness readiness checkpoint, migrate only the known legacy single-login shape, and retain strict reference-bound dispatch. Atomic non-overwriting installation prevents concurrent startup clobbering a provisioned login. Existing authority, identity, stop, resource and spend guards remain the start/limit checks; targeted shipped-runner delivery is the local end-state evidence, and the pipeline owns the next real answer check.
80/20: Targeted custody and launcher tests pass, including positive migration/delivery and negative identity, permission, symlink, corruption, pool and withdrawal cases. Architecture and typecheck pass. The failed copy is read-only; this submission claims no independent convergence or new live deployment.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
