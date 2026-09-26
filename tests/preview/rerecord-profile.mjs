// Desk-only one-use login-profile identity re-record (see README "Profile identity re-record").
// Usage: node --loader ./scripts/slice-ts-loader.mjs tests/preview/rerecord-profile.mjs /ABSOLUTE/rerecord-input.json
// The input JSON names root, profilePath, activationPath, model, reason and recordedBy. The storage
// key comes from INSTAR_SECRET_PREVIEW_STORAGE_KEY exactly as for agent.mjs and is never printed.
import { readFileSync } from 'node:fs';
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';
import { rerecordLoginProfileIdentity } from './rerecord-profile.js';

const key = process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY ?? '';
const bytes = /^[a-f0-9]{64}$/iu.test(key) ? Buffer.from(key, 'hex') : Buffer.from(key, 'base64');
if (bytes.byteLength !== 32) throw Error('preview storage key unavailable');
const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const io = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => true });
const result = rerecordLoginProfileIdentity({ ...input, inspect: io.inspectSubscriptionProfile, storageKey: new Uint8Array(bytes) });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
