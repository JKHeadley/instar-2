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

The signed-profile client advertises the configured pinned Playwright catalog,
including configured capabilities, using its original schemas and tool handlers.
Tabs, embedded frames and WebSockets remain available. Tool results retain their
MCP content, including admitted image blocks, plus a checked accessibility snapshot.
Tool inputs use the pinned MCP schema (for example `target`, rather than the older
adapter's `selector`). No tool name is removed to enforce profile safeguards.

Configured reads and registered ordinary tab operations remain ordinary.
Signed-in writes require the current effect policy's exact `tool:mcp` target and `browserProfile` scope grant; the existing
resource and sensitive-matter tests still apply. Registration retains ordinary
UI reversibility, so two separately requested ArrowDown calls both work. Actual
non-GET/HEAD traffic receives a separate durable consequential identity containing
the tool input, method, URL and body digest; uncertain writes cannot be repeated.
Workers cannot supply this host-owned request envelope.

`browser_run_code_unsafe` retains the pinned handler and Playwright client API in
an OS-confined child of the existing resource-owned browser process. The child
cannot read profile/host files, write enforcement code, open sockets or spawn
processes. It reaches the browser through the pinned Playwright protocol; the
custodian checks credential-bearing responses before delivering them to code.
Server-side `fetch` uses a bounded host transport that checks URL, headers and
body before dispatch. Replacing the worker's JavaScript globals cannot replace
these checks or the kernel boundary. Host process/file/listener control stays
behind the custody checkpoint; ordinary page APIs and permitted fetch remain.
Each code call remains consequential under its existing whole-operation grant,
without an additional prompt. Filename operations, isolated-context creation and
binary/file transfer tools retain that classification. A scope grant never
waives the credential checkpoint. The fixed-worker macOS profile is required;
an unavailable confinement mechanism refuses without an unconfined fallback.

Every page and frame uses context routing and Chromium request interception.
Named isolated contexts receive the same installation before their pages open.
New tabs await the checkpoint before navigation starts.
The pinned backend's first popup request has no frame/CDP target yet: that exact
request is instead admitted as an `UNINTERCEPTED` consequential operation before
dispatch. WebSocket origins are checked and each outgoing message passes the
same effect owner with a body digest; receiving messages remains ordinary.
HTTP observations follow network completion. WebSocket observations mean a
message was handed to the transport, not that the remote application accepted it.

Cookies, local/session storage and IndexedDB strings are inventoried across
browser contexts and frames before and after tool execution and before code receives a protocol response. Credential checks
run before output reaches the worker or its journal. The parent retains a bounded,
additive inventory over host-private IPC and checks results independently, so code
executing in the confined code child cannot bypass the checkpoint by forging a protocol reply.
The inventory never enters a model response or journal. Automatic MCP snapshot and
console files are not published; console tools retain their in-memory messages
and use the same checked output. The host child's stderr is not exposed. Existing
claim lifetime, operation timeout, input/output bounds, ownership and stop checks
still apply. The host continues to use the pinned Chromium runtime and the
existing service-worker-blocked launch profile; this unit proves tab, frame,
WebSocket and configured-tool restoration, not unrestricted browser networking.

This state is deliberately machine-local (Rules 31/32/63/113). A different serving
machine cannot use this directory or silently start a fresh replacement. Its own
recorded enrollment is required; per-turn paths without the continuing host
connector refuse an explicit selection. Profile data is never replicated by this
feature. Existing conversation ownership and team access govern who can create a
claim and receive its observations; selecting a profile grants no team access.
Remove the selection to restore the fresh-profile path; remove a grant to withdraw
a write. Preserve durable preparations when recovering interrupted work.
