# Local Verify from a worker

The `local_verify` MCP connector asks an existing Instar 1.x verifier to check a
pull request. The full suite runs on that verifier's machine, outside the worker's
workspace. It does not install a verifier, merge, publish a status, or send a message.

Install it using the existing `instar2 mcp-add` path with server name `local_verify`,
command `node`, and the installed absolute path to `tests/preview/local-verify-mcp.mjs` as
its sole argument. For the separate worker account, launch preparation replaces
that path with the existing immutable hook installation, which installs this module
on readiness checks for both new and existing installations. The agent performs setup under its existing account grant.
The configured endpoint must belong to the configured repository: 1.x selects its
repository from server configuration, not from the request. Retain the existing
request-effect policy; do not add the request tool to `reads`.

Server environment:

- `INSTAR_VERIFY_URL`: fixed verifier origin, reached over TLS or the installed private mesh.
- `INSTAR_VERIFY_REPO`: repository in `owner/name` form.
- `INSTAR_VERIFY_TOKEN`: existing verifier credential, given as a SecretRef.
- `INSTAR_VERIFY_GITHUB_TOKEN`: existing GitHub read credential, given as a SecretRef.

Use the installer's existing `secretEnv` custody path for credentials in memory;
never put values in configuration, arguments or conversation. The only read entry
is `mcp__local_verify__status`. The existing host checkpoint retains stop, spend,
held-secret checks, durable effect preparation and request authority. The server
has one call in flight, a ten-second deadline per HTTP request, a 1 MiB response
bound, and no retry or background poll. Existing installations use the same
idempotent MCP installation path. This adds no default endpoint or account grant.

`request({pr})` sends exactly 1.x's `POST /local-verify {pr}`. A receipt means only
that the request was answered. A lost response is unknown; read before retrying.
`status({pr,head,base})` reads the exact record, queue and GitHub's
`instar/local-verify` context for that head. Queued, peer-accepted and locally
running are different states. Peer acceptance does not prove continuing liveness. The local in-flight read
does not carry a base branch, so it reports `baseConfirmed: false`.
An absent, mismatched or unreadable record stays unknown. A recorded outcome and
GitHub's status remain separate: neither gives this connector permission to merge.
Observations carry their time and head, and do not assert that the PR has not moved.

The worker discovers this guidance through the tool descriptions on every launch.
Verification: `tests/preview/local-verify-worker.test.ts` exercises the HTTP
request, refusal and evidence paths, recorded model shapes, and installation through
the real stdio tool-list consumer. Native host-account and live conversation proof
remain the gate host's checks, not a claim made by this document.
