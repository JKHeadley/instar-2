import { readFileSync } from 'node:fs';

type Request = Readonly<{
  method: 'getMe' | 'getUpdates' | 'sendMessage';
  body: Readonly<Record<string, string | number>>;
  timeoutMs: number;
}>;

type Reply = Readonly<{
  kind: 'response' | 'uncertain';
  status?: number;
  bytes?: string;
  limitation?: 'timeout' | 'transport';
}>;

async function main(): Promise<void> {
  const encoded = process.argv[2];
  if (!encoded) process.exit(2);
  let request: Request;
  try { request = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Request; }
  catch { process.exit(2); }
  const token = readFileSync(0, 'utf8');
  if (!token || !Number.isSafeInteger(request.timeoutMs) || request.timeoutMs <= 0) process.exit(2);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${request.method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(request.timeoutMs),
    });
    const reply: Reply = { kind: 'response', status: response.status, bytes: await response.text() };
    process.stdout.write(JSON.stringify(reply));
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    const reply: Reply = { kind: 'uncertain', limitation: timeout ? 'timeout' : 'transport' };
    process.stdout.write(JSON.stringify(reply));
  }
}

void main();
