# Authenticated setup owner IPC

`scripts/custody-platform/setup-ipc.mjs` mounts the existing closed
`setupOwnerReceiver` inside an independently installed broker. It supplies
`mountSetupOwner` and the corresponding `setupOwnerSocketClient.request` for the
existing custody platform's request method. `setupPreparationOwners` continues to
verify that platform and its running state before each owner request.

The installer and broker use mutual TLS 1.3 over a Unix socket. Both verify the
certificate chain and the exact certificate fingerprint installed through the
protected distribution/session configuration. A different certificate from the
same CA is insufficient. The broker, installer, agent and harness UIDs must be
four distinct identities; the broker must be non-root and must be the current
process. The client requires the installer identity. These certificates identify
services, not an installing person's protected selection, GP, GE or A0.

The host supplies the broker implementation's trusted read, reconcile and execute
ports when mounting. Requests cannot choose those methods, their backing owner,
a path, a UID or an authority override. The existing receiver still authenticates
fresh complete owner checks and requires the actual owner to recheck preparation,
supervision, stop and the observed frontier at dispatch. No caller booleans stand
in for those records. Missing authority refuses; TLS success is never permission
to create a key or approve genesis.

Credential files have a 64-KiB bound, one hard link, mode 0600 or narrower and the
configured owner's UID. Every ancestor is checked for symlinks, worker ownership
and non-owner write access. Darwin allow ACLs are refused, including on ancestors:
mode bits alone cannot establish custody there. Deny-only confinement ACLs are
accepted. A root-owned sticky temporary ancestor is allowed for isolated proofs;
the protected child still needs its own exclusive ownership. The runtime socket
is in a broker-owned protected directory. Startup refuses an occupied path rather
than unlinking a service it did not start. This check does not certify executable
distribution, account privilege, process-memory isolation or keychain custody;
Ten's platform verification continues to own those checks.

Each connection carries one request and one response, each at most 16 KiB. At most
four raw connections are admitted. TLS handshakes have a two-second limit, followed
by an absolute two-second authenticated request lifetime; trickling data cannot
renew either deadline. Input chunks are decoded together. Malformed input,
untrusted TLS, missing credentials and oversized input close the connection;
owner refusals retain the receiver's existing plain repair step. Client errors
expose one fixed next step without owner diagnostics or key material. Client
credential protection is rechecked for every request. Closing the mount destroys
its active streams and closes its listener. It grants no automatic retry after an
uncertain owner effect.

The host must retain trusted ownership of the mounted directory and must close
this mount before changing its socket path. Certificates and their private keys
are installed by the independently administered release/session path; this module
creates no alternate installation authority record and no certificate issuer.
Certificate expiry and changed pins hold connection establishment. Updating the
installed broker requires the existing signed-distribution and qualification
process, including restart to load replacement server credentials.

This is the authenticated receiving boundary, a reviewable installation component.
It is not ordinary-install admission. The next Nine/Ten/Seventeen integration must
supply actual separate-identity Keychain/file key custody, the operator-only remote
vault adapter, independently retained encrypted recovery and version/revocation
witness, and restore challenge. It must derive the checks from those observations
and the real GP/Seven owner records. Eleven/One/Two/Four enrollment and genesis stay
in the following assigned run. No preview seal, waiver, manual grant or live-root
credential closes any of these seams.

The machine-local endpoint holds no shared authority or recovery record. It can be
mounted independently on each admitted machine without changing Two's history or
P-08's replication demands. Losing it holds dependent preparation; the installed
stop, durable intake, spend cap and no-duplicate-sends owners are unchanged.

Verification: `tests/platform/setup-owner-ipc.test.ts` exercises real TLS, exact
pins, malformed/oversized/plaintext input, connection exhaustion, credential paths
and cleanup. Its ordinary tests share one OS identity and claim only protocol
coverage. On the Studio, set `INSTAR_SETUP_IPC_PLATFORM=1` and run that file with
`nice -n 10 npx vitest run --maxWorkers 1`. The foreground proof reuses the three
existing desk-owned disposable identities (42000/42001/42002), mounts the receiver
under a temporary launchd service, exercises the real installer client, observes
the kernel broker UID and performs credential/read/replacement/elevation/signal
permission denials as each worker. It observes two actual path/process checks and
refuses execution because preparation authority is absent. It creates no accounts
and never reports the unimplemented custody, supervision or enrollment checks as
passed. It removes only its temporary files/service and exact recorded process.
