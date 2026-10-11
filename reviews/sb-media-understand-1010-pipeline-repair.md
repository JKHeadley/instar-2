# Change review — Media pipeline inventory repair

Subject base: 7ca6784b72fde638bbe1c473ca2a61b5c36cb026
Review state: open
Reviewed content: none
Outcome: Repair both full-gate failures: register the existing install:media script as a shipped install-media tool and include the existing media secret checkpoint in the explicit Rule 4 roster. Programmatically refresh native harness conformance and replay the register for these source bytes.
Affected rules: 2, 4, 26, 37, 49, 66, 70, 74, 86, 100, 101, 105, 111, 112, 113, 115, 116.
Affected floors: secrets — existing custody checkpoint remains present and enumerated; spend cap — installation retains existing local-install grant admission and no model charges are introduced; stop — existing harness and owner stop enforcement unchanged; no duplicate sends — no delivery code changed; durable intake — encrypted media originals and journal preservation unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The source inventory is in the native harness composition closure, and the expected roster records a secret-custody checkpoint; preserve the existing conformance evidence bar.
Side effects: The harness can propose the existing local media installer with the existing local-install grant. This runs the fixed installer command; no extra parameters, options, credentials or paths are admitted. Installer dependencies and per-host model storage are unchanged. Generated register metadata and the native composition digest change.
Undo and recovery: Revert these repair commits while preserving history; this restores the reported missing inventory and stale expected roster. No journal or installed media data migration is involved. Recompute conformance and register through their existing tools for any subsequent source change.
Multi-machine posture: The shipped inventory and roster apply on every machine. Installation remains deliberately local to the executing host under its existing local-install standing grant; no cross-machine state, authority or credentials are created.
Layer below: Inspected DEVELOPMENT_TOOLS and admitToolProposal, the actual install-local-media.mjs fixed dependency/model installation, the protectMediaBytes declaration and preserved-input facts, native harness composition closure and its exact contract case. Missing-grant and extra-argument neighbors are refused by the unchanged admission function; the granted fixed command is admitted. Architecture rechecks the refreshed composition hash.
Bug class: unit
Bug evidence: reproducer=tests/assembly/tool-inventory.test.ts
Validation: Both reported failed files now pass: six tests, including granted installer admission and missing-grant/extra-argument refusals. Typecheck, build and the selected native harness conformance case pass. All eleven contract checkers stop at the original saved report global failure; its only two failed assertions now pass in the targeted run. The pipeline owns the fresh full report.
Hook bypass: none; core.hooksPath unset and common hooks directory inspected, sample files only. Plain commits, no bypass flags.
Convergence: none
Decision: media-install-inventory | Add the existing installer through the same local-install grant checkpoint used by package installation, with fixed argv and no parameters. This restores capability without expanding standing authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-media-understand-1010-repair-PROGRESS.md
Prompt review: No prompts, model output parsing, or model judgment accept/escalate/refuse paths changed. Existing recorded media replay evidence is unchanged; this repair exercises deterministic tool authorization and enumeration only.
Deferral: generated/register.json:1 | not-a-deferral=Generated register quotes the constitutional rule book; no repair work is deferred here.

## Closing block

simplestRobustRoute: This is the simplest robust route: add the missing installer to the existing inventory and the existing secret checkpoint to its exact expected roster, prove grant admission and refusal neighbors, then regenerate existing composition and register pins. No new machinery or runtime media limits. Start guards remain the fixed proposal and local-install grant; end-state evidence is the admitted fixed argv and passing inventory/roster/conformance cases; existing custody, resource and stop bounds hold. This is pipeline repair readiness, not a new live media acceptance claim.
80/20: Both named failures are repaired at source, with targeted tests and existing cheap checks. No quarantine, new checker, full-suite run, or claimed independent convergence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
