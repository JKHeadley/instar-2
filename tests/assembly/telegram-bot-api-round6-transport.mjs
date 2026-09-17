import { writeFileSync } from 'node:fs';

let fetches = 0; let reads = 0;
let redirect = null;
const count = () => {
  if (process.env.INSTAR_ROUND6_COUNT_FILE)
    writeFileSync(process.env.INSTAR_ROUND6_COUNT_FILE, JSON.stringify({ fetches, reads, redirect }));
};

globalThis.fetch = async (url, init) => {
  fetches += 1; count();
  redirect = init?.redirect ?? null; count();
  const token = String(url).split('/bot')[1].split('/')[0];
  const mode = process.env.INSTAR_ROUND6_FAILURE;
  if (mode === 'fetch-failure') throw new Error(`provider marker ${token} https://untrusted.invalid`);
  if (mode === 'fetch-timeout') { const error = new Error(`timeout marker ${token}`); error.name = 'AbortError'; throw error; }
  let status = 200; let bytes = JSON.stringify({ ok: true, result: { id: 818181, is_bot: true,
    username: 'echo_mmtest_seam_b27x_bot', first_name: 'ordinary' } });
  if (process.env.INSTAR_ROUND6_RESPONSE_BASE64)
    bytes = Buffer.from(process.env.INSTAR_ROUND6_RESPONSE_BASE64, 'base64').toString('utf8');
  if (mode === 'invalid-response') status = 500;
  if (mode === 'redirect-response') status = 307;
  if (mode === 'scan-policy') bytes = JSON.stringify({ ok: true, result: { text: token } });
  if (mode === 'scan-budget') bytes = 'x'.repeat(2 * 1024 * 1024 + 1);
  return { status, text: async () => {
    reads += 1; count();
    if (mode === 'body-read') throw new Error(`body marker ${token} https://untrusted.invalid`);
    return bytes;
  } };
};
