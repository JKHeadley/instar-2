# Continuing login selection per topic

The continuing conversation host selects a reviewed login for each topic. It uses
`createTopicLoginHandoff` from `scripts/topic-login-pool.mjs` at the existing host's
serialized turn boundary and idle maintenance tick. A topic mid-turn keeps its
account until its correlated turn end; another idle topic can move independently.
The physical driver's stop receives the exact claim and incarnation from that
host. Account switching never calls an unscoped stop.

Selection reuses the account-pool logic from step1e and Instar 1.x: placement pressure at
80% or the configured threshold if lower, both fresh destination quota windows,
identity-matched readings, durable configured-cutoff/provider holds, and at most five prepared moves
per ten minutes. The 1.x 80% ceiling leaves reporting-lag and finishing-turn room
before the existing cutoff. A continuing-session destination must have another
15 percentage points of headroom. Among eligible members, the 1.x scheduler's
headroom divided by time-to-reset score prefers capacity that would expire soon.
Prepared destinations recheck the same margin. Unknown quota does not make a proactive alternative account eligible;
a healthy current account with unknown usage retains provider-limit behavior.
Placement pressure is ephemeral: failed or stale telemetry defers the optimization
and leaves ordinary current-account dispatch available. When no cooler destination
exists or the move-attempt bound is reached, the all-hot brake keeps an admitted
source working. Neither path overrides a configured-cutoff hold, provider limit or
unavailable identity. Otherwise input stays queued and the ordinary host tick
retries within the existing parent lifetime. Stop and the shared spend allowance
still apply. Sign-in repair items are recorded for the desk, never executed here.

The Claude adapter in `scripts/claude-pool-quota.mjs` ports 1.x
`QuotaPoller.mapUsageResponse/readUsage`. It reads the official OAuth usage endpoint
using each admitted member's existing custody token, without changing the model,
refreshing credentials or writing a credential store. It runs at the existing
turn/idle boundary and before ordinary provider selection. Calls coalesce across
topics, with one request per member per minute, a four-second request deadline,
64 KiB response bound, exponential failure backoff and a thirty-minute breaker
after three failures. At most eight admitted members are read sequentially.
Observation time is the request start, so network delay never makes old quota fresh.
The pool accepts readings no older than five minutes and requires future reset times.
The status surface reports both windows and their measurement time.

Missing fields stay unknown, including a partial window that 1.x formerly coerced
to zero. HTTP 401/403 can mean missing usage scope; they do not declare the model
login signed out. A configured 1.x `usageFile` remains a compatibility source when
live windows are unavailable, with its original account binding and measurement time.
A fresh partial live observation retains its known window; an older complete snapshot
cannot replace it or supply the missing destination window.
An inference-only setup token may not authorize the usage endpoint. Such an
installation needs its account's telemetry-capable OAuth credential in the existing
custody or a fresh configured snapshot; this port does not acquire additional scope
or borrow another account's credential. Normal-browser sign-in repair belongs to
the subsequent unit.

An installed member can name `quotaLogin`, an absolute reference to another record
in the same existing custody format. The normal custody reader checks its private
owner/modes and exact profile reference, account, organization and plan before use.
This lets a scoped OAuth login supply telemetry while the working inference login
stays unchanged. The inventory carries this reference across build preparation;
it is not a per-build record. Omission uses the member's inference custody. Failed
reads remain unknown; this unit does not mint or refresh credentials.

Source reuse: 1.x `SubscriptionPool.ts` supplies account/config-home identity and
snapshot shape; `ProactiveSwapMonitor.ts` supplies the pre-wall ceiling and safe
boundary; `QuotaAwareScheduler.ts` supplies binding-window and reset scoring;
`QuotaTracker.ts` supplies unknown/freshness handling; `SwapAntiThrash.ts` supplies
the cooler-target and all-hot brakes. `SessionManager.ts`'s resume-follows-account
behavior is already implemented by the retained step1e/per-topic driver handoff.
No large 1.x source file, new polling daemon, sender or spending owner is introduced.

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
