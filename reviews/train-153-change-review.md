# Change review — train-153 custody platform integration

Subject base: 206bc77026aae10e4acb3ae6b177f2d0882295c8
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed OS-neutral custody platform and bounded Linux adapter into the accepted train-152 build.
Affected rules: 1, 4, 5, 26, 30, 34, 36, 37, 42, 49, 55, 60, 66, 74, 90, 95, 101, 102, 111, 113, 116
Affected floors: Secrets retain independently administered release custody and identity separation; spend cap, no duplicate sends and durable intake paths unchanged; stop retains bounded exact-PID termination.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of an independently reviewed OS custody boundary and kernel resource ceilings; no live installation or authority expansion.
Side effects: Adds platform lifecycle scripts and conformance fixtures. Linux foreground execution requires root-owned prlimit/setpriv and distinct locked accounts; the adapter refuses missing prerequisites. No existing application source or model-facing text changes.
Undo and recovery: Keep the live build until the desk accepts this candidate. Revert the merge through the release process and regenerate publication; no live installation, state migration or send replay is performed here.
Multi-machine posture: Custody is deliberately machine-local; independent OS identity and resource boundaries apply on each host, without a new peer dependency or shared store.
Layer below: Read the constitution, SHA-verified member and cint-L37 reports, signed-distribution authentication, Linux identity/kernel/resource observations, existing macOS wrapper and the mediated custody-reader contract. Preserve the distinction between same-user socket evidence and unrun privileged cross-identity proof.
Bug class: integration
Bug evidence: reproducer=tests/platform/custody-platform.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model-facing prompt, output parser or acceptance judgment changes. Model journal replay is inapplicable to this adapter-only integration.
Decision: train-153-merge | Ordinary conflict-free merge of exact reviewed a094644f276f4deab1bd4df8b45fa72f7859656f. Member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-broker-linux-1013-PROGRESS.md read from the supplied SHA-verified snapshot, including the resource repair report. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-153-PROGRESS.md
Decision: train-153-A | Preserve all member and live-base behavior; all 13 member files are additions, with no manual conflict or changelog resolution. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-153-PROGRESS.md
Decision: train-153-B | Create branch directly at exact live base 206bc77026aae10e4acb3ae6b177f2d0882295c8 and preserve ancestry without a main merge or branch movement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-153-PROGRESS.md
Decision: train-153-C | No genuine product conflict; include the sole member and omit none. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-153-PROGRESS.md
Decision: train-153-D | Run targeted WSL checks; report privileged Linux, macOS and unchanged host-dependent checks honestly for the desk gate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-153-PROGRESS.md
Decision: train-153-desk | Use the existing repin/build/rehash/replay chain with the authorized Linux sed adaptation; regenerate generated files and keep fixed-prompt guards unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-153-PROGRESS.md
Skip: tests/platform/custody-platform.test.ts:144 | scope=Linux prlimit and proc resource probes require Linux; portable distribution and socket cases still run elsewhere
Skip: tests/platform/custody-platform.test.ts:185 | scope=Linux exempts UID zero from RLIMIT_NPROC; one-fork denial proof runs under the non-root WSL UID
Validation: Run custody tests and direct consumers, requested journal regressions, provider subscription, context floor, pinned tests, typecheck, architecture, wiring, register and change-review checks; report actual outcomes and host exceptions in the handoff.

simplestRobustRoute: This is the simplest robust route: ordinary merge of reviewed code and existing desk regeneration. No additional mechanism. The adapter uses the existing custody reader and OS identity/resource enforcement; signed bytes, ownership and kernel observations guard start and running status, bounded exact-PID termination guards stop. Privileged Linux and macOS installation proofs remain unrun here; no unattended protected installation is claimed.
80/20: Preserve reviewed bytes, verify targeted behavior and submit the candidate with honest evidence residue; no full-suite duplication on WSL.
VERDICT: author submission; no independent verdict asserted
