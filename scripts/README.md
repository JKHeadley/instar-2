# Build, check and host scripts

Build adapters and repository checks (the register build `build-register.mjs`, `check-architecture.mjs`, the contract-map checks) plus the host-side adapters the launchers load at runtime: `production-boot.mjs` and `production-boot-io.mjs` (the fixed installation's OS ports), `transport-file-storage.mjs`, `effect-file-captures.mjs`, `effect-replica-storage.mjs`, `judgment-captures.mjs`, and `host-watch.mjs`, the host watchdog launcher. Durable writers declare their stores beside them in `*.declarations.json`.
