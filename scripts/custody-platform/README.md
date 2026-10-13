# Custody broker platform boundary

This is the first installation boundary unit, not an installer for a usable agent.
It installs and checks distribution material and starts it under a separate Linux
identity. It creates no installation key, genesis, pairing, grant, subscription or
real login. The conformance request reuses `src/assembly/custody.ts`; there is no
second custody implementation.

`interface.mjs` exposes `install(material)`, `verify()`, `start()`,
`request(scopedRequest)`, `status()` and `stop()`. A host supplies the existing
broker entrypoint in its independently signed distribution. The entrypoint accepts
a Unix socket path and reports its real process ID and UID on the bounded status
request. `tests/platform/custody/conformance.ts` takes an implementation fixture
and runs the same behavioral checks on every platform. Fixture probes must perform
actual operations as the agent, harness and broker identities.

## Linux installation authority

`linuxCustodyPlatform({base, broker, agent, harness, trustAnchorPath, node})` is an
administrator-side API. All identities are distinct non-root locked system accounts
with separate groups. Agent and harness must already exist. Installation creates the
broker account with `useradd --system --user-group --no-create-home` if absent. It
refuses extra group membership or any sudo authorization, including password-required
sudo. It never adds sudoers, polkit or shell access for the agent or harness.

A real installer first prompts the person for the operating system's administrative
authentication, outside the agent and harness. That independent administrator installs
the release public key at `trustAnchorPath`; all its ancestors, the Node executable,
and the destination are checked for root ownership, no symlinks and no non-root
write permission. A root-owned sticky temporary ancestor is allowed for isolated
proofs. Neither an agent-provided key nor an included download key is a trust anchor.
Only root can invoke installation, verification or start. No password is collected
by this code.

An Ed25519 signature authenticates the exact manifest bytes. The manifest binds the
platform, entrypoint (`entry.mjs`), exact file set and SHA-256 of every file. Path
traversal, duplicate files, missing/extra files, altered bytes and another signing key
refuse before placement. Verified bytes are copied from a private snapshot; no archive
extraction or execution of package install hooks occurs. Count and byte bounds are
4096 files, 512 KiB of manifest and 32 MiB of payload.

The installation is exclusive: an existing destination refuses, including a partial
installation. It never overwrites an existing release or key. The administrator can
inspect and remove an incomplete fresh install and repeat; this is not an update or
rollback mechanism. Each file is flushed before success, then verification reads it
back. Release files, manifest, signature and service definition are root-owned and
read-only. Directories under the release are root-owned 0755. `private/` and `run/`
are broker-owned 0700. No production key material is created by this unit.

An independently administered host remains a prerequisite: the administrator must
not grant these identities root-equivalent access by another mechanism, such as
custom polkit rules, container control sockets or privileged file capabilities.
The adapter inspects account/group/sudo state; it does not claim to audit every
administrator-installed privilege broker on an arbitrary Linux distribution.

## Service lifetime

The adapter writes a systemd service definition to `<base>/broker.service`. On a
systemd host, the independent administrator can install that unit through the normal
system manager after `verify()` succeeds. It specifies the broker user/group,
`NoNewPrivileges`, empty capabilities, read-only system paths, a private temporary
directory, only `run/` writable, and process/memory bounds. It has no automatic retry
loop. `KillMode=process` addresses the exact main PID; the scoped broker entrypoint
must not spawn unmanaged children. This API's `start()`/`stop()` manages its own
foreground process, not a separately installed systemd instance; `status()` refuses
to label a foreign PID as its own running instance.

Without systemd (including this session's container/WSL environment), `start()` uses
`setpriv` to clear supplementary groups and capabilities, set `no_new_privs`, and
exec the verified entrypoint as the broker UID/GID. The environment is rebuilt without
`NODE_OPTIONS` or inherited credentials. Readiness has a finite retry count. `stop()`
sends TERM to its recorded child PID, waits, and escalates to KILL for that same PID
only after two seconds. It never kills by name or process group. A non-systemd host
needs an independent service supervisor for persistence across administrator-session
loss; this unit does not pretend a foreground process is an installed persistent
service. The conformance fixture itself is bounded to 60 seconds and 128 requests.

The broker's socket is inside its private runtime directory. These operations are
for the authenticated installation administrator; this unit does not expose an
agent-accessible signing or credential export endpoint. The conformance payload is
public and exercises the existing custody reader, with stub standing for that public
fixture only. It is not a production standing grant or cryptographic custody proof.

## Running the proof

From the repository root:

```sh
npm run build
nice -n 10 npx vitest run --maxWorkers 1 tests/platform/custody-platform.test.ts
```

This always runs signature/tamper tests and a real socket/process request against
the existing custody reader. A same-user process is explicitly not identity-isolation
evidence. The real identity cases are NOT RUN unless invoked on Linux as root with
`INSTAR_CUSTODY_ROOT_TEST=1`. The root run needs `useradd`, `userdel`, `getent`, `id`,
`setpriv`, root-owned `/usr/bin/node`, and permission to create/delete temporary users,
change file owners, clear groups and change UIDs. The fixture creates three unique
locked accounts and a root-owned temporary tree, uses only a public canary, and
removes them in cleanup. It never uses a real login or live agent root.

```sh
# Run from an independently authenticated root test session on an isolated Linux host:
INSTAR_CUSTODY_ROOT_TEST=1 nice -n 10 npx vitest run --maxWorkers 1 tests/platform/custody-platform.test.ts
```

A sandbox with UID 1000, no capabilities and `NoNewPrivs=1` cannot run those cases.
The suite records that limitation and reports skips, never a passed denial matrix.
The root conformance cases prove three separate identities, the allowed read, refusal
of wrong scopes/bounds/extra authority fields, broker access to its private canary,
and agent/harness denial of read, overwrite, replacement, UID elevation and service
file administration. They also prove exact-process stop and refusal of changed
installed bytes before restart.

## macOS sibling

`macos.mjs` keeps the existing host lifecycle behind the same interface and calls the
existing `tests/preview/harness-user.mjs` readiness check before starting it. No
existing macOS implementation or test was changed. Harness readiness alone is not
proof that the broker is independently administered. The Laptop sibling provides
`createFixture()` returning `CustodyConformanceFixture`, using its existing broker
and real isolated identities, and runs:

```sh
INSTAR_CUSTODY_MACOS_FIXTURE=/absolute/path/to/laptop-fixture.mjs nice -n 10 npx vitest run --maxWorkers 1 tests/platform/custody-platform.test.ts
```

Those cases are labelled “to run on macOS” here. No macOS conformance is claimed on
Linux. The repository's existing detector (`node tests/platform/macos-only.mjs`)
currently enumerates 17 macOS-bound test files; this unit ports none of those files.
It adds an OS-neutral contract and Linux boundary rather than changing their proofs.
