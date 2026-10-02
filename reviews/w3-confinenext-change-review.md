# Change review — w3-confinenext: install the receipt public key where the agent-side owner can read it

Subject base: 4105dc10c2c3243b5a75126ca1685f1c655f16f4
Review state: open
Reviewed content: none
Outcome: The fixed-worker install plan wrote the receipt public key to /Library/Instar2/m4-launch/keys/receipt.pub. accounts-only creates that keys folder root:wheel 0700, so the agent account cannot enter it (measured on the Studio as the agent account: `ls /Library/Instar2/m4-launch/keys` gives Permission denied). The public key is the agent-side owner's receipt trust reference: S8's `trust()` must read it as the agent account. As installed it could never have been read, so the S8 trust wiring (an open CB6-MF-A owner dependency) could not be completed without a reinstall. The plan now writes the public half to /Library/Instar2/m4-launch/receipt.pub, beside service.json, in the root-owned 0755 package folder. The private key stays at keys/receipt.key (0600 in the 0700 folder). `verify` checks the public key is a root-owned 0644 regular file. Uninstall keeps it with the private half and the journal (history). The keygen step's arguments and the monitor module are unchanged; scripts/fixed-native-worker-monitor.mjs, which is in the harness conformance closure, is byte-identical. Proof: tests first. The install dry run pins the keygen line to the new path, and verify passes with the key present and fails with it missing or 0600. Both failed before the change and pass after. tests/assembly/fixed-worker-monitor-native.test.ts and tests/assembly/fixed-installation-live.test.ts: 58/58, foreground and unprivileged.
Affected rules: 60 and 61 (removes an install-layout blocker on the confinement base's owner-trust dependency; neither rule is closed by this change), P-01 (the trust reference is readable but not writable by the agent; the private key and the folder holding it stay root-only), 13 and 26 (verify checks the file the owner actually reads), 74 (this record), 95 (verify fails when the trust reference is absent or unreadable), 113 (machine-local), 116 (a path change and one verify line; no new mechanism)
Affected floors: secrets — unchanged (only the public half moves; the private key keeps its 0600 file in the 0700 root-only folder); spend cap — unchanged (no model call); stop — unchanged; no duplicate sends — unchanged (nothing is sent); durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: it changes what the operator's root install writes (one public file's location) and therefore the install plan and release digests, but no enforcement, bound or authority.
Side effects: the install plan text, its plan digest and every staged release digest change, because the installer travels inside the release. No host has the monitor installed (Studio's releases folder is empty; stage 1 only), so no installed layout needs migrating. A live unprivileged dry run now sees an existing receipt.pub. install_plan does not refuse on it, and the run-time keygen keep-if-present check now looks for the public half at the new path.
Undo and recovery: revert this commit. Nothing is installed by this change.
Multi-machine posture: machine-local, deliberately: each Mac has its own receipt key pair; the Studio's never certifies the Laptop
Layer below: POSIX directory search permission (a 0700 directory denies path lookup of everything inside it to other users, whatever the file modes); the S8 trust contract in src/assembly/production-launch-boundary.ts (`trust()` returns a public Ed25519 KeyObject read by the owner process); accounts-only's fixed folder modes
Bug class: integration
Bug evidence: reproducer=tests/assembly/fixed-worker-monitor-native.test.ts
Hook bypass: none
Convergence: none
Decision: w3cn-pub-beside-service | the receipt public key is installed in the 0755 package folder beside service.json instead of loosening the keys folder, because the keys folder also holds the private key and loosening it would expose the private key's name and metadata to the agent | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-confinenext-PROGRESS.md
Prompt review: no model-facing prompt text changed; nothing here is asked of or parsed from a model.

Subject (3 paths): deploy/macos/fixed-worker/README.md, scripts/provision-fixed-native-worker.sh, tests/assembly/fixed-worker-monitor-native.test.ts

## Closing block

simplestRobustRoute: the required behaviour is an agent-side owner that can read its receipt trust reference while the private key stays unreachable. Writing the public half one folder up, where service.json already lives, is the simplest route; no new folder, ACL, service method or copy step.
80/20: 0 must-fixes, 1 note (the S8 trust() reader itself is still unbuilt; this only makes it buildable against a real install)
VERDICT: author submission; the independent verdict is recorded as a pass
