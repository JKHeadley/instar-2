/** Operator wording is separate from custody keys and journal references. Older records
 * have no display label; derive the same wording without rewriting their identity. */
export function credentialDisplayLabel(record: { readonly kind: string; readonly identity: string;
  readonly displayLabel?: string }): string {
  if (record.displayLabel?.trim()) return record.displayLabel.trim();
  switch (record.kind) {
    case 'activation': return 'your activation';
    case 'subscription-login': return `your subscription sign-in (${record.identity})`;
    case 'telegram-bot-token': return 'your Telegram bot token';
    case 'api-key': return 'your API key';
    default: return 'your stored credential';
  }
}

/** Render legacy prose with the same labels as current reminders. This is a view only:
 * callers retain the original records and pass prose, never custody keys or journal ids.
 * Account identities remain useful; only an activation's internal reference is wording. */
export function credentialTextRenderer(records: readonly { readonly name: string; readonly kind: string;
  readonly identity: string; readonly displayLabel?: string }[]): (text: string) => string {
  const labels = new Map<string, string>();
  // Shipped activation references survive in old replies after the registry advances to
  // a replacement. These exact legacy identities are compatibility wording, not new records.
  for (const identity of ['preview-activation', 'preview-harness-profile-v1-activation',
    'preview-s2-activation-v2-2026-09-23']) labels.set(identity, 'your activation');
  for (const record of records) {
    const label = credentialDisplayLabel(record);
    if (record.name) labels.set(record.name, label);
    if (record.kind === 'activation' && record.identity) labels.set(record.identity, label);
  }
  const alternatives = [...labels.keys()].sort((a, b) => b.length - a.length)
    .map(value => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_-])(?:${alternatives})(?![\\p{L}\\p{N}_-])`, 'gu');
  return text => text.replace(pattern, value => labels.get(value)!);
}
