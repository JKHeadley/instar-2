// Release-owned state compatibility and idempotent migrations (Rules 44/45).
// Steps run in array registration order, as in Instar 1.x MigratorStepEngine.
// Add a stable id and run(root) for each installed-state change. Never reuse an id.
// run may be replayed after a crash; it must check its durable effect before repeating it.
export const schemaVersion = 1;
export const readableSchemas = [1];
export const migrations = [];
