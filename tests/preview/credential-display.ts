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
