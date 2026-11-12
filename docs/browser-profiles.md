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

`browser_run_code_unsafe` retains the pinned handler and client API in the existing
OS-confined worker. Each call needs its existing tool/profile grant. Browser and
host-fetch requests additionally name `browserOrigin` on that grant: an exact
HTTP(S) or WS(S) origin including the port. An execution grant alone is not a
network grant. The existing doorway records preparation before dispatch and
retains the exact-effect duplicate protection, expiry, spend and stop checks.
Ordinary navigation to a recorded profile origin remains ordinary; its transport
connection still has a recorded preparation under that profile-origin grant.

The browser process uses a deny-network macOS sandbox with one allowed loopback
proxy. The proxy checks each destination before DNS or connection establishment,
including opaque CONNECT transports. This closes routes such as WebRTC which
Chromium's HTTP interception does not report. The proxy uses the existing egress
resource bounds. The profile host requires this native confinement and refuses
when it is unavailable; there is no unconfined fallback. Browser requests also
retain their page/frame HTTP and WebSocket checkpoints. The code tool's host fetch
and Playwright API requests pass the doorway for every redirect and retry. New
contexts keep service workers blocked. Code cannot replace custody interception,
introduce a proxy, launch a host process, or supply host file paths.

Export protection follows sources, not stored strings. Cookie getters return
metadata with values replaced by `[stored sign-in state removed]`; storage-state
exports remove their stored origins. HAR/trace artifacts expose empty streams and
no raw entries. Video artifacts receive the same stream projection. Request and
response header fields remove cookie/authorization values, API fetch logs return
a marker, and CDP cookie/storage getters and credential-bearing network events
are projected before they cross into code. Protocol request identities cannot be
reused to overwrite the source attribution. The pinned MCP export tools return a
marker in their content field before any raw export file is released; recorder
stop calls still stop their underlying recorder. The complete catalog and schemas
remain available. Other protocol results remain under the code call's existing
consequential grant and the installation-held-secret checker.

The explicit MCP export sources are `browser_cookie_list`, `browser_cookie_get`,
`browser_storage_state`, local/session-storage list/get, `browser_network_request`,
`browser_stop_recording`, `browser_stop_tracing`, and `browser_stop_video`. Protocol
sources include BrowserContext/APIRequestContext cookies/storageState, API fetchLog,
Request/Response headers, Tracing harExport/tracingStopChunk, their Artifact/Stream
results, Page video artifacts, Browser stopTracing, and CDP Network/Storage cookie
getters, DOMStorage getDOMStorageItems, IndexedDB requestData and trace event/IO streams.

Ordinary page text is not compared with a profile's cookie or storage inventory.
There is no such inventory or 64 KB inventory shutdown. The installation's known
held-secret and credential-pattern checks remain; decoding still covers binary
responses. Host IPC output is bounded at one MiB. Automatic snapshot/console logs
remain private or disabled. After code has run, background requests cannot inherit
an ordinary-read exemption; only the explicitly requested own-origin navigation
keeps that exemption. A refused navigation is stopped before the next tool begins.
No browser result establishes live-account, member/guest or channel acceptance.

This state is deliberately machine-local (Rules 31/32/63/113). A different serving
machine cannot use this directory or silently start a fresh replacement. Its own
recorded enrollment is required; per-turn paths without the continuing host
connector refuse an explicit selection. Profile data is never replicated by this
feature. Existing conversation ownership and team access govern who can create a
claim and receive its observations; selecting a profile grants no team access.
Remove the selection to restore the fresh-profile path; remove a grant to withdraw
a write. Preserve durable preparations when recovering interrupted work.
