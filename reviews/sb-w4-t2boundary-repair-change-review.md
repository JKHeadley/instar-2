# Change review — sb-w4-t2boundary pipeline repair: a harness directory gets exactly its mode whatever the runner's umask

Subject base: d76239d8ed402f7a1baba9b2ed3c0dc76795e5d0
Review state: open
Reviewed content: none
Outcome: The answer check on a copy of the live preview (2026-10-07 03:17) gave no real answer: readiness reported "the harness user cannot read /Users/Shared/instar-harness/hook/ca6d6d2798618af3/tool-admission-hook.mjs", so every Claude Code launch was held. This branch changed tool-admission.mjs, so the content-addressed hook copy got a NEW directory, and the desk's runner (launchers run under `umask 077`) created it 0700: `mkdirSync`'s mode is masked by the umask, and `installHook` only chmods the files (0644), never the directory. Older hook directories were created under a 022 umask and stayed 0755, which is why earlier builds that reused them passed. Fixed at the source: `ensureDirectory` now chmods the directory to the requested mode after creating it, so a new hook, launcher or executable directory is 0755 whatever the umask, and the directory already left 0700 on this host is corrected by the next install (readiness installs the hook before any launch).
Affected rules: 1 Structure beats Willpower (the mode is set by the code, not by whoever's umask happens to run it), 37 Zero-Failure (no quarantine, no skip), 70 Bug-Fix Evidence Bar (the new test reproduces the live shape — an existing directory at the masked 0700 and a fresh one created under umask 077 — and fails without the fix: expected 448 to be 493), 74 Side-Effects Review Gate (this record), 101 Hooks Are Never Skipped Silently (plain commits, no bypass flag), 116 Occam's Razor (one chmod in the one helper every harness directory already goes through; no new mechanism)
Affected floors: secrets — unchanged: the private directories (custody, profile, turns, tmp, sockets) are requested 0700 and are now held at exactly 0700, which can only close them further; the hook, launcher and executable directories were always meant to be 0755 and hold no secret; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: it changes the file mode of directories in the harness area, the boundary between the runner and the harness user; it opens nothing beyond what each call site already requested and closes masked directories to their declared mode.
Side effects: every ensureDirectory call now also chmods. The 0o700 call sites already chmod 0700 afterwards or create the directory 0700, so they are unchanged in effect; ACL entries are kept by chmod. The hook directory ca6d6d2798618af3 on the Studio, currently 0700, becomes 0755 at the next install.
Undo and recovery: revert the fix commit and the generated replay; no durable state or format changes.
Multi-machine posture: machine-local, unchanged.
Layer below: node's mkdirSync (mode masked by the process umask), chmodSync, and the readiness probe that read the hook as the harness user and correctly held every launch.
Bug class: live-path
Bug evidence: reproducer=tests/preview/harness-user.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-deploy.log
Hook bypass: none
Convergence: none
Decision: sbt2b-pr-chmod-in-the-shared-helper | the mode is enforced in ensureDirectory, the one helper every harness directory goes through, rather than adding a chmod at the three 0755 call sites or changing the runner's umask; a umask is the caller's, and a fixed-mode directory must not depend on it | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-t2boundary-PROGRESS.md
Prompt review: no prompt text, model output parsing or accept/refuse decision changes; the change is a directory mode in the harness install path.
Deferral: generated/register.json:1 | not-a-deferral=generated register output re-emitted by the replay, not a new commitment

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/sb-w4-t2boundary-repair-change-review.md, tests/preview/harness-user.mjs, tests/preview/harness-user.test.ts

## Closing block

simplestRobustRoute: one chmod after mkdir in the shared helper. Alternatives rejected: change the desk's umask (the defect then returns under any other caller), chmod at the three 0755 sites only (the same masking hazard stays for every other call), or loosen the readiness probe (it was right to hold the launch).
80/20: 0 must-fix, 1 note: the full gate re-runs the native-harness cases on the Studio; only tsc and tests/preview/harness-user.test.ts were run here (44 passed, under umask 077), per tonight's operator rule.
VERDICT: author submission; the independent verdict is recorded as a pass
