// @ts-nocheck -- Synthetic installation metadata for U4-G restart tests only.
import { canonical } from '../../src/index.js';
import { value } from '../facts/fixtures.js';
export function recordedCheckpoint(installed, stage) {
  const f = installed.f, refs = new Set();
  for (const [reference, bytes] of Object.entries(f.ctx.decode.captures)) {
    if (!installed.storage.captures.preserve(reference, bytes)) throw Error(`capture changed: ${reference}`);
    refs.add(reference);
  }
  for (const [reference, row] of Object.entries(f.ctx.captures)) {
    if (typeof row.bytes !== 'string') continue;
    if (!installed.storage.captures.preserve(reference, row.bytes)) throw Error(`capture changed: ${reference}`);
    refs.add(reference);
  }
  return JSON.parse(value(canonical({ stage, register: f.ctx.decode.register, schemas: f.ctx.schemas,
    captures: [...refs], admissions: [...f.admissions], versions: f.owners.host.current().versions,
    facts: value(f.store.read()).map(row => ({ id: row.id, kind: row.kind, hash: row.contentHash })),
    intakeOwners: f.deps.context.intakeOwners, run: f.id })).bytes);
}
