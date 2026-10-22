# Build, check and host scripts

Build adapters and repository checks (the register build `build-register.mjs`, `check-architecture.mjs`, the contract-map checks) plus the host-side adapters the launchers load at runtime: `production-boot.mjs` and `production-boot-io.mjs` (the fixed installation's OS ports), `transport-file-storage.mjs`, `effect-file-captures.mjs`, `effect-replica-storage.mjs`, `judgment-captures.mjs`, `host-watch.mjs`, the host watchdog launcher, and `approval-surface.mjs`, the operator's own approval page process, with `operator-dashboard.mjs`, its dashboard, which the runner also serves read-only behind the operator's existing dashboard PIN through `operator-dashboard-readonly.mjs` (Rule 81's floors are checked on both by `check-dashboard-floors.mjs`). Durable writers declare their stores beside them in `*.declarations.json`.

`phone-route-proof.mjs` evaluates a recorded preview status for Rules 79/82. Run it with the deployed
tree's `slice-ts-loader.mjs`, passing that tree and the status JSON path. It reads the deployed
reviewed expiry and operator-action declarations; it performs no network call or journal write.
Missing connection, missing actions, a withdrawn acceptance or an absent shared-access disclosure
fails. At the reviewed expiry ceiling, renewal is **untested**, never passing: no surface may offer
a later end on that build. Below the ceiling an unconditional renewal route is still required.
M/Q must capture status before invoking the probe. Its CLI emits `{source, actions, renewalActions, renewal}`. `actions` covers every currently
available action; `renewalActions: null` means renewal is untested at the ceiling. M/Q report
these separately and require a Telegram API-accepted reply for their own probe update before
passing route coverage. Absent/unreadable input fails; configuration alone is not delivery.

The GitHub phone route uses the existing `journal-agent.mjs` options `--explicit-yes-installation`
and `--review-repository`, plus the agent's privately supplied `INSTAR_SECRET_PREVIEW_GITHUB_TOKEN`.
Both `run` and `status` must receive the same options, including a standalone supervisor's launch.
An installation record must name the actual trial and current account-access facts; copying it to
an unrelated trial cannot create acceptance. Adding these options takes effect in the serving
process at its next controlled restart; a standalone status command only proves the configuration.
No passkey setup, new Telegram user or paid phone number is needed for this existing review route.
The operator still supplies every real approval; the agent never approves as the operator.

`agent-paths.mjs` implements the operator's Mac placement rule (Rules 4/26/93/103):
setup, boot, storage/session creation and workspace mounts refuse an agent directory in
`~/Documents`, `~/Desktop`, `~/Downloads` or `~/Library/Mobile Documents`, including
symlink targets and missing descendants. Use the agent home (`~/.instar/agents/<agent>/`)
instead. Checks run on each Mac host, including existing installations at their next
boot; Linux is unchanged. The check performs no writes and does not migrate existing
state. The journal runner keeps status and stop accessible for an existing misplaced root.
