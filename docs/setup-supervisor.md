# Bounded setup supervision

This is a gated installer component, not a qualified installer release. It prepares
the saved login selection, then validates key, backup, signing and append work with
current owner evidence and a local model. A model hold or an unavailable model saves
progress. It never turns an exact check into a substitute model acceptance.

The 1.x shape reused is `setup-wizard/state-machine.ts`: a finite state validates
before its action and advances only after validation. Existing 2.0 owners remain
responsible: onboarding-state publishes durable checkpoints; the custody-platform
interface owns the broker boundary; One/Two own approved facts and append
reconciliation; Six admits dispatch; Seven owns model exchange and captures. The
Linux process runner is ported from `install-setup-qualify-1025-linux`, rather than a
new execution engine. Host code stays in scripts; no ambient I/O enters src.

## Composition and authority

`runSetupSupervisor` takes the installation root, nonsecret login selection,
installation/session/subject/preparation-grant binding, current clock and stop
readers, owner ports, and a Seven route. It first calls existing `prepareLogin`.
That receipt grants nothing. The function is not called by ordinary installation:
no qualified manifest for this changed contract ships in this tree.

`setupPreparationOwners({broker, facts})` wraps the existing custody platform and
One/Two request boundary. A running, reverified broker must implement the closed
`setup-owner-request` operations `inspect`, `authenticate`, `reconcile`, `execute`.
The operation always binds the same checkpoint. Append goes only to One/Two;
key/backup/signing go only to the custodian. An older read-only broker refuses this
protocol; this component neither adds key custody nor grants that broker new
standing. Installed-owner qualification must supply these real operations before
release admission. `inspect` returns the exact checkpoint plus current frontier
and the full fixed check set from `setup-supervisor-protocol.mjs`. `authenticate`
must verify every short receipt handle against actual current owner receipts,
including installation, subject, session, authority, phase, operation, schema and
frontier. It must never accept caller booleans as proof. The broker must recheck
preparation authority versus separate GE/A0 authority when consuming an operation.

`reconcile` returns `absent`, `executed`, or an uncertainty that holds. `execute`
uses the same stable operation id. A durable dispatch intent is written before
calling it. An uncertain dispatched operation is never executed again, even when
reconciliation says absent: owner reconciliation must resolve it first. A post-step
hold revalidates the actual completed operation on the next explicit attempt.
Completed markers never substitute for current owner checks after restart.

`setupSevenRoute` uses the existing `createModelAdapter` and capture port. Its claim
callback supplies actual Six claims; it does not mint them. Capture capacity is
reserved before dispatch, and the complete response, owner evidence and local
accounting are retained. A route supplies no credential, operator standing or
permission to spend. The model sees only names, owners, booleans and receipt handles.
The new output contract is exactly one `disposition` field, `accept` or `hold`.
Historical responses with prose/citations are audit evidence, not silently admitted
under a contract they were never qualified for. Fixed owner-check text is displayed;
the model's explanation is not. Rule 108 re-derivation belongs to independent review
against the retained record if its justification is refuted.

## Linux bounds and qualification

`linuxSetupModel` accepts only an independently signed, current release manifest
through an installer-held release public key. Its v1 manifest binds `linux-<arch>`,
qualified task-set and independent-review digests, exact `PROFILE_3B_3GIB`, model,
runtime and library paths/digests, and all supervisor, owner-interface, platform,
Seven-adapter, runner, projection/decoder, prompt/template and schema pins. Model
size and source commits must match the assessed 3B candidate. Missing qualification,
a changed artifact or an unsupported host holds before inference. The Linux adapter rechecks actual dynamic-loader resolution with a bounded, clean-environment
loader query and hashes each resolved library against the signed list. Distribution
qualification must additionally establish installed-owner and actual model adequacy.

One validation uses one CPU-only llama-cli child: two threads, 3-GiB memory,
zero swap, 200% CPU quota, sixteen tasks, 4,096 context tokens, at most 512 output
tokens, seed 1 and temperature zero. systemd/cgroup v2 enforces resource ceilings
and an independent wall deadline. A read-only filesystem namespace permits writes
only in the attempt directory, with no network and a finite file-size ceiling.
Temporary streams and log output stay in that directory. Stop is checked before
launch and during execution; only exact owned PIDs are signalled. Missing host
facilities hold visibly. The supervisor permits at most eight validations and
20 minutes per explicit attempt; each call is at most 120 seconds including
artifact checks. No automatic model retry, provider fallback or process reuse.
The four-minute evaluation allowance is not a measured installed-run bound.

State is intentionally installation-local. Fixed paths reject links and caller
write paths. Concurrent attempts refuse while a writer lives; crash recovery
requires evidence its PID is gone, never lock age. Checkpoint loss is detected by
owner reconciliation and missing/mismatched bindings. The owner operations and
clock/stop ports are trusted bounded installer ports, not user or model plugins.
A stopped installer keeps the external durable stop; invoking this function does
not clear it. Every resumed call rechecks stop, pins, owners and completed receipts.

Run the four `tests/assembly/setup-supervisor*.test.ts` files for unit, owner-wiring,
Seven/Six capture integration and physical Linux contracts. Set
`INSTAR_SETUP_LINUX_PHYSICAL=1` to exercise the real cgroup runner on Linux. Physical
proof uses a host-visible `/tmp` scratch directory, since the test worker's RAM
namespace is not necessarily visible to the systemd user manager. No model call,
real key creation, enrollment or genesis is part of these tests. Full installed
owner/model qualification remains a release prerequisite, as docs/14 requires.
