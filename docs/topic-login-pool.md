# Continuing login selection per topic

The continuing conversation host selects a reviewed login for each topic. It uses
`createTopicLoginHandoff` from `scripts/topic-login-pool.mjs` at the existing host's
serialized turn boundary and idle maintenance tick. A topic mid-turn keeps its
account until its correlated turn end; another idle topic can move independently.
The physical driver's stop receives the exact claim and incarnation from that
host. Account switching never calls an unscoped stop.

Selection reuses the account-pool logic from step1e: a measured limit at the
configured threshold (95% by default), both fresh destination quota windows,
identity-matched readings, durable reset holds, and at most five prepared moves
per ten minutes. Unknown quota does not make an alternative account eligible;
a healthy current account with unknown usage retains provider-limit behavior.
If no eligible account exists, input stays queued and the ordinary host tick
retries within the existing parent lifetime. Stop and the shared spend allowance
still apply. Sign-in repair items are recorded for the desk, never executed here.

For an installed pool, a launch-supplied `--session-work-activation` applies to
its primary login. Preparation retains that path and fingerprints its bytes;
the normal session validator still checks its account, policy and sealed authority.
The override does not rewrite the installed inventory or supply another member's
grant. Other members need their own session activations. Without an override,
the primary's installed activation remains the default. Continuing conversation
requires the conversation-session policy, which differs from scheduled work's
session policy even though both use the same command-line option.

Each topic's encrypted `topic-login-<topic>.json` records the selected account,
last claim and pending move. The pool registers the topic so loss of that snapshot
cannot look like a first launch. A move records its source, destination and exact
selection attempt before destination preflight or worker retirement. A delayed or
recovered move rechecks fresh destination quota without adding a new attempt. Preflight
failure, including pool activation, authority and login validation during initial
selection or pending-destination revalidation, leaves the idle worker intact and undispatched input queued for maintenance
under its original lifetime and stop. Retirement and custody errors remain visible.
After exact retirement, the physical
adapter copies only the recorded native transcript, never credentials. An
identical copy is reusable; divergent, unsafe or missing bytes use the existing
journal continuation. The source and divergent destination stay intact.

Completed moves are idempotent by topic and sequence. A restart can finish a
prepared move, including a crash after the pool's completion record but before
the topic snapshot commit. An already recorded completion repairs the topic snapshot
before current capacity is checked for further work. The new process claim inherits
the prior native handle
when available. Missing handles still require journal continuation; they cannot
silently become a new conversation. Fresh native handles are retained before
launch and published by the driver's existing reservation reconciliation.

The existing topic host retains intake identities, FIFO, reply cursors and
uncertain outcomes. Switching creates no new intake or sender. The dispatch
checkpoint continues charging every topic against one installation reservation;
copying a transcript cannot replenish or double-charge it. All new state and
transcript copying are deliberately machine-local under the existing owning
host fence. No cross-machine credential transfer or additional owner is created.

Rollback retains the topic snapshots and pool audit fields. A reader that does
not understand them must not delete or reinterpret them as a fresh allowance.
The desk owns native host conformance and live acceptance. Disposable-host tests
cover concurrent topics, prepared-move crash recovery, capacity waits, duplicate
input, selection floors, copying and the shipped configuration's topic binding.
