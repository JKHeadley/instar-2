# Change review — merge reviewed Rule 30 route coverage into the live train

Subject base: 1c3447786f1ca9721b4b6b58774edc51eb59b1a3
Review state: open
Reviewed content: none
Outcome: carry the reviewed Codex route tests at 7394caabb3fac30c59ad351a5626f83ab1584380 onto the exact live train head so the desk R30e proof can consume them.
Affected rules: 26, 30, 36, 37, 49, 70, 74, 101, 102, 108, 111, 112, 113, 115, 116
Affected floors: secrets — synthetic isolated profiles and scrubbed recorded frames only; spend cap — no paid calls and over-cap refusal tested; stop — no dispatch after stop tested; no duplicate sends — no sends and no retry on refused outcomes; durable intake — no product state changes
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: ordinary merge of one reviewed tests-only unit, with no product, prompt, parser, authority or generated-file changes.
Side effects: four additional route cases run through the existing Codex fixture. The desk's already-updated R.sh can now find Codex evidence on this tree. Native-harness certification remains unproven for Codex, as declared; no registration status changes.
Undo and recovery: revert the unit's test addition and coordinate restoration of its companion desk predicate; no persisted product state requires recovery.
Multi-machine posture: machine-local isolated test artifacts, deliberately; committed tests and review evidence travel through git. No peer dependency or live store access. Studio artifacts are read-only from this builder.
Layer below: checked the actual base-to-unit diff, registered doorway fixture, recorded CLI frames, and the unit report. The ordinary merge fast-forwarded without conflict; reviewed unit bytes are retained exactly. Register lifecycle and default-context-floor tests check the underlying unchanged build. No independent combined-build or live proof verdict is asserted here.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: sb-w4-rule30-merge | ordinary merge of 7394caabb3fac30c59ad351a5626f83ab1584380 from the exact live head 1c3447786f1ca9721b4b6b58774edc51eb59b1a3; unit evidence is /Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-rule30-PROGRESS.md and its repair report; fast-forward preserves reviewed bytes and history | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule30-PROGRESS.md
Decision: sb-w4-rule30-register | no source or generated file changed, so the brief's conditional desk repin/build/rehash/replay chain is not triggered; verify the existing register with build-register --check and its lifecycle tests instead of rewriting unchanged pins | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule30-PROGRESS.md
Deferral: none

Subject (1 paths): tests/assembly/production-codex-provider.test.ts

## Closing block

simplestRobustRoute: this is the simplest route: merge the reviewed unit unchanged and run the specified targeted checks. No new machinery. Start guard is the exact live base; end guards are passing route, register and context-floor tests; limits are one niced worker, no paid provider, no live sends and no CPU load generator. No autonomous product completion is claimed.
80/20: verify both successful dispatch and unknown-charge accounting, and refused, timed-out, over-cap and stopped dispatch boundaries using existing recorded CLI captures. The desk owns independent combined-build and live proof runs; this author record claims only the checks actually run on WSL.
VERDICT: author submission; independent review belongs to the desk
