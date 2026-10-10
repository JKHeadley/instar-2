// Host custody for the journal launcher. Original intake is already durable;
// downloaded bytes never enter a worker, plaintext file, log, or model prompt.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { durablePreviewWrite } from './durable-write.js';

/** Structural metadata only. The intake owner still verifies the sender and captures
 * the original update before a custodian may fetch anything (Rules 28, 46, 100). */
export interface TelegramInboundMedia {
  readonly kind: 'photo' | 'voice' | 'audio' | 'document';
  readonly fileId: string | null;
  readonly name: string;
  readonly size: number | null;
}
export function telegramInboundMedia(message: unknown): TelegramInboundMedia | null {
  if (message === null || typeof message !== 'object' || Array.isArray(message)) return null;
  const fields = message as Readonly<Record<string, unknown>>;
  const kind = (['photo', 'voice', 'audio', 'document'] as const).find(key => fields[key] !== undefined);
  if (!kind) return null;
  let value = fields[kind];
  if (kind === 'photo') {
    // Telegram orders PhotoSize variants by size; choose the largest supported
    // variant, not the thumbnail. A malformed array still becomes a visible turn.
    value = Array.isArray(value) && value.length <= 100 ? value.at(-1) : undefined;
  }
  const file = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : {};
  const size = typeof file.file_size === 'number' && Number.isSafeInteger(file.file_size) && file.file_size >= 0
    ? file.file_size : null;
  const validSize = file.file_size === undefined || size !== null;
  const fileId = validSize && typeof file.file_id === 'string' && /^[A-Za-z0-9_-]{1,512}$/u.test(file.file_id)
    ? file.file_id : null;
  return { kind, fileId, size, name: typeof file.file_name === 'string' && file.file_name.length > 0
    ? file.file_name.slice(0, 256) : kind === 'photo' ? 'photo.jpg' : kind === 'voice' ? 'voice.ogg' : kind };
}

export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_STORE_MAX_BYTES = 96 * 1024 * 1024;
export type MediaCustodyResult =
  | { state: 'stored'; reference: string; bytes: number }
  | { state: 'unavailable' | 'failed' | 'file-limit' | 'store-limit' | 'malformed' };

export function mediaCustodyText(result: MediaCustodyResult): string {
  switch (result.state) {
    case 'stored': return `The file was saved in encrypted custody (${result.bytes} bytes). Its contents have not been read.`;
    case 'file-limit': return 'The file was not downloaded: it exceeds the 8 MiB per-file limit. The original message is retained.';
    case 'store-limit': return 'The file was not downloaded: the encrypted media store is full. The original message is retained.';
    case 'malformed': return 'The file could not be downloaded because its file metadata is malformed. The original message is retained.';
    case 'unavailable': return 'File download is unavailable in this host. The original message is retained.';
    case 'failed': return 'File download or encrypted storage failed. The original message is retained; do not claim the file was saved.';
  }
}

/** Fixed Telegram origin, no redirects or provider-supplied absolute URLs, bounded
 * streaming and lifetime, no retries. The bot credential stays in the host closure. */
export function createTelegramMediaCustody(root: string, key: Uint8Array, ports: {
  token(): string; stopped(): boolean; fetch?: typeof fetch;
}) {
  if (key.byteLength !== 32) throw Error('media: key refused');
  const directory = join(root, 'media'), request = ports.fetch ?? fetch;
  const referenceFor = (source: string) => createHash('sha256').update(source).digest('hex');
  const pathFor = (reference: string) => {
    if (!/^[a-f0-9]{64}$/u.test(reference)) throw Error('media: reference refused');
    return join(directory, `${reference}.sealed`);
  };
  const read = (reference: string): { source: string; fileId: string; bytes: Buffer } => {
    const path = pathFor(reference);
    if (statSync(path).size > MEDIA_MAX_BYTES * 2) throw Error('media: stored size refused');
    const sealed = JSON.parse(readFileSync(path, 'utf8')) as { iv: string; tag: string; data: string };
    const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
    cipher.setAAD(Buffer.from(`telegram-media:${reference}`)); cipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
    const saved = JSON.parse(Buffer.concat([cipher.update(Buffer.from(sealed.data, 'base64')), cipher.final()]).toString('utf8')) as {
      source: string; fileId: string; bytes: string };
    const bytes = Buffer.from(saved.bytes, 'base64');
    if (bytes.length > MEDIA_MAX_BYTES) throw Error('media: stored size refused');
    return { source: saved.source, fileId: saved.fileId, bytes };
  };
  const verify = (result: MediaCustodyResult): boolean => {
    if (result.state !== 'stored') return false;
    try { return read(result.reference).bytes.length === result.bytes; } catch { return false; }
  };
  const receive = async (source: string, media: TelegramInboundMedia): Promise<MediaCustodyResult> => {
    if (ports.stopped()) throw Error('media: stopped');
    if (media.fileId === null) return { state: 'malformed' };
    if (media.size !== null && media.size > MEDIA_MAX_BYTES) return { state: 'file-limit' };
    const reference = referenceFor(source);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const stopTimer = setInterval(() => { if (ports.stopped()) controller.abort(); }, 100);
    const check = () => { if (ports.stopped() || controller.signal.aborted) throw Error('media: stopped or timed out'); };
    const bounded = async (response: Response, max: number): Promise<Buffer> => {
      if (!response.ok || !response.body) throw Error('media: response refused');
      const announced = response.headers.get('content-length');
      if (announced !== null && (!/^\d+$/u.test(announced) || Number(announced) > max)) {
        await response.body.cancel(); throw Error('media: size refused');
      }
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          check(); const chunk = await reader.read(); if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > max) throw Error('media: size refused');
          chunks.push(chunk.value);
        }
        check(); return Buffer.concat(chunks, size);
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    };
    try {
      if (existsSync(pathFor(reference))) {
        const saved = read(reference);
        if (saved.source !== source || saved.fileId !== media.fileId) throw Error('media: identity collision');
        return { state: 'stored', reference, bytes: saved.bytes.length };
      }
      const used = existsSync(directory) ? readdirSync(directory).reduce((sum, name) => sum + statSync(join(directory, name)).size, 0) : 0;
      // Reserve for the worst case including base64 inside encrypted JSON. One
      // journal worker owns this store, so simultaneous downloads cannot oversubscribe it.
      if (used + MEDIA_MAX_BYTES * 2 > MEDIA_STORE_MAX_BYTES) return { state: 'store-limit' };
      check(); const token = ports.token();
      if (!/^[0-9]+:[A-Za-z0-9_-]+$/u.test(token)) throw Error('media: credential refused');
      const options = { signal: controller.signal, redirect: 'error' as const };
      const metadata = JSON.parse((await bounded(await request(`https://api.telegram.org/bot${token}/getFile`, {
        ...options, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file_id: media.fileId }),
      }), 16 * 1024)).toString('utf8')) as { ok?: boolean; result?: { file_id?: string; file_path?: string; file_size?: number } };
      const file = metadata.result;
      if (metadata.ok !== true || file?.file_id !== media.fileId || typeof file.file_path !== 'string'
        || file.file_path.length > 1024 || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)+$/u.test(file.file_path)
        || file.file_path.split('/').some(segment => segment === '.' || segment === '..')) throw Error('media: metadata refused');
      if (file.file_size !== undefined && (!Number.isSafeInteger(file.file_size) || file.file_size < 0)) throw Error('media: size refused');
      if (file.file_size !== undefined && file.file_size > MEDIA_MAX_BYTES) return { state: 'file-limit' };
      check();
      const bytes = await bounded(await request(`https://api.telegram.org/file/bot${token}/${file.file_path}`, options), MEDIA_MAX_BYTES);
      if (file.file_size !== undefined && bytes.length !== file.file_size
        || media.size !== null && bytes.length !== media.size) throw Error('media: incomplete file');
      check();
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(`telegram-media:${reference}`));
      const data = Buffer.concat([cipher.update(JSON.stringify({ source, fileId: media.fileId, bytes: bytes.toString('base64') })), cipher.final()]);
      durablePreviewWrite(pathFor(reference), { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') });
      if (!read(reference).bytes.equals(bytes)) throw Error('media: readback differs');
      return { state: 'stored', reference, bytes: bytes.length };
    } catch {
      // Never propagate transport errors: their text may contain a bot-token URL.
      return { state: 'failed' };
    } finally { clearTimeout(timer); clearInterval(stopTimer); }
  };
  return Object.freeze({ receive, verify });
}
