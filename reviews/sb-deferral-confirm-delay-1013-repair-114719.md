# Change review — install the locked development tools

Subject base: 58f2c153e121eeee1d36ed9e94704a440ea8954a
Review state: open
Reviewed content: none
Outcome: Plain npm ci installs this private source repository's locked compiler and test runner even on a host configured to omit development dependencies.
Affected rules: 26, 37, 49, 70, 74, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. Only dependency installation configuration changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One npm configuration entry repairs the development environment; no runtime, model, parser or assertion changes.
Side effects: This private source checkout installs development dependencies even with a host omit=dev default. It consumes the existing lockfile without changing package versions. Installation takes the usual development disk space and time.
Undo and recovery: Revert the .npmrc addition; npm ci --include=dev remains the explicit equivalent for source verification. No deployed state is migrated.
Multi-machine posture: The checked-in setting applies consistently to each source checkout. node_modules remains deliberately machine-local and is recreated from the same lockfile.
Layer below: npm config get omit returned dev. Plain npm ci installed no development packages and reproduced the reported compiler failures through parent-directory tools. npm ci --include=dev installed 54 locked packages and typecheck passed unchanged. The repository is private and declares compiler and runner as development dependencies.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only.
Convergence: none
Decision: repair-114719-install-dev | Include locked development dependencies in this private source repository rather than altering tests to accommodate accidentally inherited tools. Both install paths were exercised and only the complete locked installation typechecked. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-deferral-confirm-delay-1013-repair-114719-PROGRESS.md

Subject (1 paths): .npmrc

## Closing block

simplestRobustRoute: One repository-local npm include setting is the simplest robust route. It prevents the observed host omit default from silently resolving incompatible parent tools; no new checker, dependency, runtime mechanism or test exception is needed. Existing compiler and targeted tests remain the checks.
80/20: Repair the actual dependency installation cause, preserve all test assertions and existing branch history, and submit targeted evidence to the Studio gate. No full-suite or live capability claim.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
