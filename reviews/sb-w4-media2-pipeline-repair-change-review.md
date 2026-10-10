# Change review — sb-w4-media2 pipeline pin repair

Subject base: 9c96b25ad2987a288e92a92993dcb34227f43ded
Review state: open
Reviewed content: none
Outcome: Restore register extraction and exact owner-reference loading after the previous media store-agreement test repair changed the pinned proof artifact. Refresh its fifteen Part Nine references through the delegated desk tool and replay generated register evidence from the committed manifest.
Affected rules: Purpose Rule 3; Rules 26, 37, 49, 69, 70, 74, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — no credential or outbound changes; spend cap — no new provider call; stop — existing checkpoint untouched; no duplicate sends — existing dispatch guards untouched; durable intake — journal and custody paths untouched.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Conservative register-evidence tier; only generated hashes and repository provenance change.
Side effects: Fifteen probe references now resolve the already committed proofs-launcher test bytes. Generated register, briefing and source provenance refer to the repaired commit. No runtime code, prompts, parsing, capabilities or test assertions change.
Undo and recovery: Recompute manifest hashes from the desired committed proof source with the desk rehash tool, commit, then replay the register and commit generated output. Reverting only the new hashes would restore the original defect.
Multi-machine posture: Repository metadata travels through git identically on all machines. No new machine-local runtime state or peer dependency.
Layer below: Inspected all seven saved failure stacks, register-owner-references artifact hash validation, build-register committed-source loading, and both failing test files. All failures share the proofs-launcher hash mismatch. The prior expectation repair committed the test without refreshing its fifteen owner references. Exact stale, spoofed and wrong-owner refusal paths remain exercised by the existing tests.
Bug class: unit
Bug evidence: reproducer=tests/e2e/register.test.ts
Hook bypass: none (core.hooksPath unset; common hooks directory contains sample files only; plain git commits).
Convergence: none
Decision: media2-repair-pins | Use the authorized desk rehash and repin scripts, then committed register replay, to repair stale metadata while retaining exact hash refusal and all runtime ability. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-media2-repair-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Generated constitutional rule text; no deferred work introduced.

## Closing block

simplestRobustRoute: This is the simplest robust route: regenerate the stale pins and register with existing tools. No new machinery. Start guard is the saved seven failures bound to 9c96b25a; end guards are targeted positive/refusal tests, typecheck, architecture, lint, register and review checks. Runtime limits and safety floors stay unchanged. No autonomous live outcome is claimed.
80/20: The two failing test files are the targeted repair evidence. The original full report is retained unchanged; its seven old failures prevent successful-full-run contract checks until the automatic pipeline reruns. No full suite runs during this repair and no passing full-suite claim is made.
VERDICT: author submission; independent review required
