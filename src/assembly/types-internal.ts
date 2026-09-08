// Internal import concentrator keeps the record implementation readable without
// creating a second public owner for any Part Ten type.
export type * from './contracts.js';
import type { ConflictClass } from '../facts/index.js';
export interface AssemblyComparison { readonly equal: boolean; readonly conflict?: ConflictClass }
