# Change review — cint-L52 repair: the admission hook copy is reachable by the harness user under any umask

Subject base: 47adbbd2cbb943cd449eaa708c798b7879c24712
Review state: open
Reviewed content: none
Outcome: Plan row #527. The 17:51 canary copy of cint-L52 1eb1c87d gave no real answer: the runner's readiness check reported "Harness identity: UNAVAILABLE ... the harness user cannot read /Users/Shared/instar-harness/hook/a1ab8ee15c98b81c/tool-admission-hook.mjs", so every Claude Code launch was held. Cause: readiness installs the hook's content-addressed copy before any launch (harness-user.mjs installHook), and the runner process runs under umask 077, so `mkdirSync(dir, { mode: 0o755 })` created the new digest directory 0700 (the older digest directories, made from a shell under umask 022, are 0755). The files inside were 0644 because installFile already set their mode explicitly. Fix at the source: ensureDirectory sets the requested mode explicitly after the directory exists, so every harness-area directory has its declared mode whatever the process umask; the existing 0700 directory is corrected on the next readiness install. installHook takes an optional hooks root so the test can install into a scratch directory. Both sides proven: under umask 077 the new test fails without the fix (448 = 0700 where 493 = 0755 is expected) and passes with it; under umask 022 both pass. The self-host conformance digest is re-declared for the changed composition after its contract re-ran (native-harness-contract 9/9).
Affected rules: 1 and 57 (the tool route runs as the harness user, now reachable again), 105 and 115 (self-host conformance re-earned on the changed composition), 36 (both sides of the mode decision proven on real processes), 37 (fixed at the source, no quarantine), 74 (this record), 101 (plain commits), 102 (decisions below), 116 (one chmod in the one directory helper; no new mechanism)
Affected floors: secrets — unchanged; the hook directories hold only the hook's code, and the custody, profile, turns and tmp directories keep their 0700 modes and ACLs (ensureDirectory now asserts exactly those declared modes). Spend cap — unchanged. Stop — unchanged. No duplicate sends — unchanged. Durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: the change touches the harness-identity boundary (which directories the separate harness user can enter), so it takes the branch's critical tier.
Side effects: a harness-area directory whose mode had drifted from its declared mode is set back to the declared mode the next time setup or readiness runs ensureDirectory on it (bin and hook to 0755; base, turns, profile, custody, tmp and profile subdirectories to 0700, as setup already chmods them). The self-host conformance digest moves to sha256:a89c42e1….
Undo and recovery: revert the conformance commit and the repair commit; the live hook directory stays 0755 (harmless, it holds only the hook's code).
Multi-machine posture: machine-local preview runner, as cint-L52.
Layer below: reviews/cint-L52-change-review.md and every record it carries, unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none (plain commits; core.hooksPath is unset).
Convergence: none
Decision: cint-L52-r-umask | fix the directory mode in the one directory helper (explicit chmod after mkdir) rather than set the runner's umask or special-case the hook directory: mkdir's mode is always narrowed by the umask, so every declared mode is enforced in one place whatever process installs it | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L52-PROGRESS.md
Decision: cint-L52-r-register-deadline | the register replay and register:check still refuse with "feature rungraph-core graduation overdue" (origin/main's src/rungraph/rungraph.declarations.json gate deadline 1791158400000 = 2026-10-05 00:00 UTC has passed), so generated/ is not regenerated in this repair; the desk repin itself refreshed 0 pins; extending that deadline or graduating the feature is a governed declaration change, not a repair's, as already recorded in cint-L52-register-blocked | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L52-PROGRESS.md
Prompt review: no prompt text changed; the change is a directory mode in the harness installer and its test.

## Closing block

simplestRobustRoute: one explicit chmod in the existing directory helper fixes the mode for every caller; a test drives installHook in a child process under umask 077 and 022 against a scratch root.
80/20: 0 must-fixes, 0 notes; targeted tests only (harness-user 43/43, native-harness-contract 9/9, foreground, --maxWorkers 1).
VERDICT: author submission; the independent verdict is recorded as a pass
