# Named agent-owned browser profiles

The continuing worker can use a named, already signed-in profile without receiving
its files or cookies. The host resolves the profile on every call, keeps the browser
in an owned child process, and uses the existing claim socket and effect doorway.
No sign-in, profile copying, owner-browser bridge attachment, or account discovery
is performed. An expired login remains a site's login page.

The installation's operator-owned `mcp.json` selects `browserProfile`. The separate
operator-owned `browser-profiles.json` records `installation` (the canonical root)
and `profiles`. Each profile has exactly `id`, `identity`, `service`, `ownership`,
`purpose`, `userDataDir`, and `origins`. Ownership must be agent; purpose must be
browsing. The existing directory must be host-owned, private (0700), canonical and nonsymlink:
`browser-profiles/<id>` beneath that installation. Origins are exact HTTP(S)
origins, including ports. These records contain metadata only, never credentials.
The installation must retain its `mcpServers.playwright` and explicit read list.
The installed Playwright Chromium runtime must be present before activation.

With no selection, the existing fresh-profile Playwright MCP launch is unchanged.
Unknown names, another installation's enrollment, missing directories, operator
ownership and sign-in profiles refuse. Enrollment does not verify that a site's
current account matches its recorded identity: it records the dedicated profile's
custody; the resulting page supplies evidence of its current login state.

The signed-profile client advertises navigate, snapshot, wait-for, tab-list, click,
type, hover and key-press tools. Its locator arguments are explicit Playwright
selectors. Snapshot returns a bounded accessibility tree. It deliberately does not
reuse MCP's raw diagnostic files: they can contain page credentials before the
host can check them. Raw JavaScript, storage export, arbitrary host files, images,
network/console dumps and extra browsing targets are outside this adapter's
credential-safe projection (purpose's secrets floor; Rules 18/57/100). The ordinary
fresh-profile MCP still exposes its existing tools. This slice does not establish
full browser-tool parity for row 31.

Read classification is restricted to recorded navigate, snapshot, wait-for and
list-tabs reads. Each other supported operation requires a current effect-policy
grant with `effect`, exact `target`, `browserProfile` and `approves` containing
scope, plus the existing source/custodian/recovery and optional expiry fields.
Existing effect registration, resource and sensitive-matter tests still apply.
A read-list entry cannot turn a click into an ordinary read. The exact profile and
policy accompany durable preparation, and an uncertain write is never retried.
An exact profile grant does not change the doorway's registered reversibility:
separate reversible UI calls retain separate call identities; registered
consequential effects retain stable duplicate protection before dispatch. An actual
non-GET/HEAD request also passes the existing effect owner before network dispatch,
with the current tool/profile grant, URL, method and body digest. Its preparation
is irreversible even when the UI operation that triggered it is reversible.
Workers cannot submit the host's network-effect envelope as a UI tool argument.

Only the primary page is observed. Other frame/page requests and WebSockets are
refused. Main-page requests, including redirects, are intercepted before dispatch
and checked against recorded origins. Non-GET/HEAD traffic is allowed only during
an admitted write. Browser errors are returned as bounded refusals. Cookies,
local/session storage and IndexedDB strings stay host-side and are checked before
any observation is returned; raw browser stderr is not exposed or journaled.

This state is deliberately machine-local (Rules 31/32/63/113). A different serving
machine cannot use this directory or silently start a fresh replacement. Its own
recorded enrollment is required; per-turn paths without the continuing host
connector refuse an explicit selection. Profile data is never replicated by this
feature. Existing conversation ownership and team access govern who can create a
claim and receive its observations; selecting a profile grants no team access.
Remove the selection to restore the fresh-profile path; remove a grant to withdraw
a write. Preserve durable preparations when recovering interrupted work.
