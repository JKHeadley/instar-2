// Part Ten's physical process-inventory adapter (SEAM-LEDGER rows 40/63): one batched,
// read-only census of every current-user process, decoded by the Ten owner decoder in
// src/assembly/process-inventory.ts. It signals nothing and holds no control authority.
// A refused or failed read is a `failed` census with no rows, never an empty population;
// a census past its bound is `partial` with its omitted count.
import { createHash, randomUUID } from 'node:crypto';
import { PROCESS_CENSUS_COLUMNS } from './process-census-query.mjs';

/** Ten's owner decoder and joins, loaded when a census first runs (they are TypeScript, so a module that
 * only imports this adapter and never observes, such as a boot child without the source loader, still loads). */
let tenOwner = null;
// Source first (the source loader or test runner); the built module for an installed, plain-node host.
export const loadTenOwner = () => tenOwner ??= import('../src/assembly/process-inventory.js')
  .catch(() => import('../dist/assembly/process-inventory.js'));

// As in 1.x ExternalHogProcTable, collect the executable name, not argv. Long
// model prompts in unrelated argv can overflow the bounded host query and blind
// every launch's accounting/cleanup. Membership uses identities, never this label.
const CENSUS_COLUMNS = PROCESS_CENSUS_COLUMNS;
