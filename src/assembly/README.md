# Part Ten assembly

This package owns the executable composition boundary. Its twelve stored records
are immutable, schema-versioned Part Two facts. `HarnessAdapterPort`, Part Seven's
`ModelAdapterPort`, and `PersistenceAdapterPort` are interfaces, not stored facts.

`createAssemblyRuntime` admits a scope only after rebuilding current status from
the signed spine. `resolveAssemblyHistory` walks both fact-envelope requirements
and record-declared dependencies, propagating missing, tainted, and conflicting
ancestors. A record's own `passed` or `active` field is never sufficient.

`resolvePackageActivity` is the additive typed package-activity read. It reads the
Part Two store at use, pins and confirms the complete signed frontier, and returns
only `active`, proved `inactive`, or `unresolved`; it never consumes a cached label.
Its owner-issued result carries canonical bytes/hash identity and explicit read clocks.

Native workers receive an Eight-owned process driver; persistence uses exact
AES-256-GCM chunks and an independently administered key port; mediated reads
revalidate Part One standing on every chunk. Local packages are decoded and
hashed before any code can execute. Growth breaches coalesce into one owned
episode and close only on a complete measured exit workload.
