# Updating an installation

`instar2 update [root] [--release <tag>]` installs a release beside the existing one.
The root defaults to `~/.instar2`; the tag defaults to `v` plus the invoking package's
version. Production releases must have an existing git tag. There is no tag creation
or npm publication in this command.

Use a stopped installation or a scratch copy for this first update step. This command
installs and migrates; it does not stop, restart, or supervise an agent. Self-update,
health checks and automatic rollback belong to step D of the update-path plan.

## ELI16

Think of the agent's folder as its home. The updater puts the new program in a separate
room, saves a copy of the home's data, and does any required conversions. Only after
those conversions finish does it move the sign saying which program to use. It leaves
the person's model choice alone. If a conversion is interrupted, the next run knows
where it stopped and can finish it without starting over blindly.

## Files and recovery

- `version.json`: version, state schema, applied migration ids, and `adopted` or
  `installed`. An unstamped root is adopted at the invoking package's version.
- `releases/<tag>/node_modules/@instar/constitutional-types`: the installed package.
  Installation uses npm's GitHub git source with lifecycle scripts disabled. A staging
  folder becomes the release folder only after npm succeeds and the files are flushed.
- `backups/<id>`: a flushed snapshot of root data before migrations. Release trees,
  other backups, the current pointer and updater coordination files are excluded.
  The transaction records the prior pointer. Backup copies preserve symlinks without
  following them; the backup's parent is private to the installing user.
- `update-state.json`: current transaction, backup, prior stamp/pointer, ordered
  migration starts/completions and activation intent. Earlier completed transactions
  stay in `update-history/`. A started migration is retried; a completed one is skipped.
- `current`: atomically replaced relative symlink to the installed package. The stamp
  is written after the pointer. If interrupted between them, rerunning the same tag
  completes the recorded activation. Two file changes are not one atomic transaction.
- `.update-lock`: unique local process ownership. Concurrent writers refuse. A dead
  local owner's unique marker can be reclaimed; an ambiguous or foreign owner refuses
  and is preserved for inspection. No age timeout grants ownership.

Retry the same release after a failure. A failed migration keeps the old stamp and
current pointer; it can have partially applied its own data conversion, which is why
migration functions must be idempotent. An unfinished transaction refuses a different
release. Corrupt JSON is preserved and refused, never silently treated as a fresh root.
A release that cannot read the root's schema is refused before migrations or activation.
A readable older release is allowed, without lowering the recorded schema.

The state and lock are deliberately machine-local: this command updates one installation
and makes no peer, conversation ownership, network-send, or restart decision. It makes
no model calls and never changes model settings, grants, stop state or spend limits.

## Adding a migration

The installed release owns `scripts/update-release.mjs`. Declare the schema it writes,
the schemas it can read, and an array of `{ id, run(root) }` in strictly increasing id
order. The initial list is empty. Keep ids stable forever and make every effect durable
and replay-safe inside `run`: intent is flushed before calling it, and completion after
it resolves. A migration must preserve the five floors and name all affected consumers
(Rules 44 and 45). Do not lower a schema to make older code appear compatible.

`tests/preview/update.test.ts` exercises npm installs from local fixtures, the actual
CLI, failure before activation, incompatible and compatible older releases, a real
process exit during a migration, and concurrent update refusal. CLI fixture tests
replace only the npm source argument with a local path; they use real npm and no network.
They then invoke the installed command, which needs only Node built-ins for update.
The TypeScript loader remains specific to setup.
