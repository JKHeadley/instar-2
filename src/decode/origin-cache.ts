/** Disposable, machine-local memo. Only the owning verifier may insert a proof;
 * this container itself confers no validation identity or standing. */
export function createOriginCache<T>(maximumBytes: number, maximumEntries: number) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || !Number.isSafeInteger(maximumEntries) || maximumEntries < 1)
    throw new Error('origin memo requires positive finite bounds');
  const entries = new Map<string, { publicKey: string; value: T }>();
  let heldBytes = 0;
  return {
    get: (bytes: string, publicKey: string): T | undefined => {
      const entry = entries.get(bytes); return entry?.publicKey === publicKey ? entry.value : undefined;
    },
    remember: (bytes: string, publicKey: string, value: T): void => {
      const size = Buffer.byteLength(bytes, 'utf8');
      if (size > maximumBytes) return;
      if (!entries.has(bytes) && (heldBytes + size > maximumBytes || entries.size >= maximumEntries)) {
        entries.clear(); heldBytes = 0;
      }
      if (!entries.has(bytes)) heldBytes += size;
      entries.set(bytes, { publicKey, value });
    },
  };
}
