# Harness temporary-file isolation across a macOS reboot

The preview harness runs as `_instarharness`. Its readiness check requires the
kernel to deny that user a newly created, world-readable file in `/private/tmp`.
macOS recreates that directory at boot, losing a manually installed ACL. A missing
ACL correctly holds model launches but leaves accepted conversation input waiting.

An administrator provisions persistence once on each macOS harness host:

```sh
bash scripts/install-harness-tmp-acl.sh print
sudo bash scripts/install-harness-tmp-acl.sh install
```

The installer requires the existing harness account. It installs a root-owned,
0644 launch daemon, `ai.instar.harness-tmp-acl`, with `RunAtLoad`. The daemon invokes
only `/bin/chmod` with the existing inherited deny entry and `/private/tmp` as
literal arguments. It reads no executable or configuration from the agent's
workspace. The harness cannot edit this job or administer the ACL. An existing
different job is refused, and repeating the installation does not duplicate the
ACL. There is no polling, model call, network access or persistent worker.

The entry is inheritance-only: `/private/tmp` remains traversable, while new
entries inherit the denial. Harness scratch files continue to use its own area.
The existing readiness sweep closes older runner-owned entries. Readiness still
checks actual kernel access, including a fresh canary, before allowing a launch;
neither this installer nor a successful launchd exit substitutes for that check.
If a runner starts before the boot job, its existing bounded readiness recheck
can observe the restored isolation. No tool set, cap, stop, effect doorway,
conversation ownership or durable-intake policy changes.

Verify with `launchctl print system/ai.instar.harness-tmp-acl`, then the existing
`harnessReadiness` probe on the host's installed profile. A fresh canary must be
readable by its producer and return `EACCES` through `probeAccess` as the harness
user; the harness's own temporary area must remain usable. An administrator may
exercise the boot action without rebooting using
`sudo launchctl kickstart system/ai.instar.harness-tmp-acl`.

To roll back boot provisioning, an administrator runs:

```sh
sudo launchctl bootout system/ai.instar.harness-tmp-acl
sudo rm /Library/LaunchDaemons/ai.instar.harness-tmp-acl.plist
```

This leaves the current ACL intact; after a reboot, readiness will hold launches
until isolation is provisioned again. Removing the harness identity and its
existing isolation is a separate administrative action. This state is deliberately
machine-local (Rule 113): install the job independently on each harness host.
