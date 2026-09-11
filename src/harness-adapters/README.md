# Session harness adapters

Part Thirteen Slice A1 owns only package-local adapter records, their total
decoders, operation-attempt admission, signed-observation admission, and the
declared progress identity. These values are not core facts, permissions,
effect settlements, run transitions, capture custody, or lease authority.

The holder lifecycle is structurally absent. Durable journal reads and
rotation, pending-work decisions, completion, liveness, reconnect, and resume
confirmation are `NON-EXECUTABLE-UNTIL-slice-A2`. Output ranges decode and
deduplicate in A1, but output cannot be credited as owner-resolved progress
until Slice A2 binds a landed current Part Two capture-custody read.
