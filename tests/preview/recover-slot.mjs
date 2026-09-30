// Desk-only one-use recovery; no Telegram or provider IO can run through this command.
// Usage: node --loader ./scripts/slice-ts-loader.mjs tests/preview/recover-slot.mjs /ABSOLUTE/recovery-input.json
import { readFileSync } from 'node:fs';
import { recoverPreDispatchSlot } from './recover-slot.js';

const secret = process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY ?? '';
const telegramToken = process.env.INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN ?? '';
const bytes = /^[a-f0-9]{64}$/iu.test(secret) ? Buffer.from(secret, 'hex') : Buffer.from(secret, 'base64');
if (bytes.byteLength !== 32) throw Error('preview storage key unavailable');
if (!telegramToken) throw Error('preview Telegram credential unavailable');
const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = recoverPreDispatchSlot({ ...input, storageKey: new Uint8Array(bytes), telegramToken });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
