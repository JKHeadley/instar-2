# Change review — clean-install-1020 one-line install

Subject base: e44d3ce1985cc2e47620541d55ab03ae0bba8f8b
Review state: open
Reviewed content: none
Outcome: A fresh macOS or Linux machine gets Instar's role setup from one line, `npx github:JKHeadley/instar-2 setup`, with no hand step; before this change that line failed because the TypeScript loader the setup entry registers imports a dev-only package.
Affected rules: 5, 30, 34, 37, 44, 49, 62, 70, 74, 78, 84, 101, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake are unchanged. Setup still grants no account, channel or paid use and records the monthly limit only.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: User-facing install path. One dependency moves from dev to run time and the README gains an install section; no product logic changes.
Side effects: Installing the package as a dependency now also installs typescript (already present in every development install). The repository's own installs, tests and builds are unchanged because npm installs dependencies and devDependencies alike there. No runtime behaviour, record or authority changes.
Undo and recovery: Revert the commit. Existing agent roots are untouched; a reverted one-liner fails again at module load, before any answer is recorded.
Multi-machine posture: Machine-local, deliberately: the install places code and the setup records on the machine it runs on, as setup already did. No new state.
Layer below: Full constitution; docs/14 "Fresh installation" and its milestones; scripts/onboarding.mjs, bin/instar2.mjs and the slice-ts-loader import closure (300 files, one package import: typescript); the held install units and INSTANCE-ONLY.md.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/one-line-install.test.ts; live=tests/preview/fixtures/one-line-install-2026-10-20.txt
Hook bypass: none; core.hooksPath unset and the common hooks directory holds samples only.
Convergence: none
Prompt review: No model-facing prompt, parser or verdict path changes.
Decision: clean-install-1020-A | Use npm's existing git-package install (the 1.x `npx instar` shape) instead of a new install script: it needs no new machinery and works the same on macOS and Linux. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/clean-install-1020-PROGRESS.md
Decision: clean-install-1020-B | Do not publish to npm or claim the npm name: publishing is an outward release act, and the unrelated `instar2` package is called out in the README instead. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/clean-install-1020-PROGRESS.md
Verification: Targeted tests (one-line-install, onboarding), the live one-liner before and after on a clean macOS home, typecheck, lint, register check and pinned READY tests; results in the desk progress report.
simplestRobustRoute: This is the simplest robust route: declare the one package setup actually loads as a run-time dependency so npm's existing git install works, and say the line in the README. A custom install script, release signing or npm publication were not needed for this step; release verification against a distribution root remains milestone 1 of docs/14 and is not claimed here. The end guard is the real one-liner completing on a clean home, recorded.
80/20: Targeted tests plus the live clean run; Linux run is listed for the desk on the Mama PC.
VERDICT: author submission for desk gate, not independent convergence or live acceptance
