# Recorded host allocation history

`host-111-facts.json.gz` decompresses to the exact 6,862,662 bytes preserved at
`preview-trial-root/canary-copy-20261018-232834/six/host-111/facts.json` in the desk's
2026-10-18 switch-session-1018 investigation. SHA256 of the uncompressed bytes:
`5bacc0664ad57b62cdb2a87e0bb3051c5d52ddd46258435e56a3e49a3049215e`.
The desk supplied gzip transport parts in `six-conflict-appender-1018-evidence`.

There are 1,820 signed resource facts: 48 leases and 1,772 allocation versions.
The last lease, `machine-a:0:1819`, belongs to incarnation
`launcher:90218:b12629d7eb783d1e`, whose first auth-status subprocess allocation
was refused while answering update 969390594 (reply 579). This ledger contains
preview fixture authority and resource metadata, not message or credential bodies.
The conversation/incident export is not included.

A cold recursive causal index over this history exhausts a 768 KiB Node stack.
The projection test reproduces the exact conflict-appender refusal by extending
an already-read prefix with the recorded last lease. The constrained stack makes
that runtime-sensitive boundary deterministic; it is not a measured Studio stack
size, and the incident did not retain the inner conflict detail. A separate
allocation replay uses the shipped file adapter and allocator on a disposable copy
with every original fact retained, and proves capacity refusal still holds.
