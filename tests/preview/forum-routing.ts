/** Part 16 §§4–5: the configured group selects the audience; its topic selects
 * the conversation. Omitted forum mode preserves every existing private key. */
export interface TelegramChatBinding {
  readonly bot: string;
  readonly chat: string;
  readonly operator: string;
  readonly forum?: true;
}

export function matchesBoundChat(binding: TelegramChatBinding,
  chat: { id?: unknown; type?: unknown; is_forum?: unknown } | undefined): boolean {
  return String(chat?.id) === binding.chat && (binding.forum === true
    ? chat?.type === 'supergroup' && chat.is_forum === true
    : chat?.type === 'private');
}

export function boundThread(binding: TelegramChatBinding, thread: number | undefined): number | undefined {
  return binding.forum === true && thread === 1 ? undefined : thread;
}

export function journalConversation(binding: TelegramChatBinding, thread?: number): string {
  const base = `telegram/bot-${binding.bot}/chat-${binding.chat}`;
  return binding.forum === true ? `${base}/${boundThread(binding, thread) === undefined
    ? 'general' : `topic-${String(thread)}`}` : base;
}

export function validateChatBinding(binding: TelegramChatBinding): void {
  if (binding.forum !== undefined && binding.forum !== true
    || ![binding.bot, binding.chat, binding.operator].every(id => Number.isSafeInteger(Number(id)))
    || !/^[1-9][0-9]*$/u.test(binding.bot) || !/^[1-9][0-9]*$/u.test(binding.operator)
    || (binding.forum === true ? !/^-[1-9][0-9]*$/u.test(binding.chat) : binding.chat !== binding.operator))
    throw Error('preview: operator chat binding differs');
}

export const journalAudience = (binding: TelegramChatBinding) => binding.forum === true
  ? 'telegram-group-topic' : 'telegram-private-chat';
