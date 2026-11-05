/** The output guards PromiseBeacon uses on session frames and its own status lines, carried from
 * 1.x PresenceProxy. These are guards, not a reading of meaning: a hit degrades to neutral wording. */

// ANSI escape codes
const ANSI_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
// Control characters (except newline, tab)
const CONTROL_CHAR_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
// Common credential patterns
const DEFAULT_CREDENTIAL_PATTERNS = [
  /(?:ANTHROPIC_API_KEY|OPENAI_API_KEY|API_KEY|SECRET_KEY|ACCESS_TOKEN|AUTH_TOKEN)\s*[=:]\s*\S+/gi,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /ghp_[A-Za-z0-9]{36,}/g,
  /sk-[A-Za-z0-9\-_]{20,}/g,
  /password\s*[=:]\s*\S+/gi,
  /token\s*[=:]\s*['"][^'"]+['"]/gi,
];
// Instruction-pattern lines that could be prompt injection
const INJECTION_PATTERNS = [
  /^\s*(SYSTEM|IGNORE|OVERRIDE|IMPORTANT)[\s:]/i,
  /^\s*You (must|should|are|will)\s/i,
  /^\s*<\/?(?:system|instruction|prompt)/i,
];

// Input-box GHOST TEXT (the 2026-06-06 presence-confabulation incident):
// codex renders rotating placeholder suggestions inside its empty input box
// ("› Write tests for @filename", "› Implement {feature}"). ANSI-stripping
// erases the dim styling, so by the time the snapshot reaches the assessment
// LLM the ghost text is indistinguishable from a typed command — and the LLM
// reported "preparing to write tests for the referenced file" for a session
// that was IDLE at a fresh prompt (topic 2271, 00:35:28Z). Status confabulated
// from UI chrome.
//
// Match conservatively: only `›`-prefixed input-box lines whose content is
// recognizably TEMPLATE text — it contains a `{placeholder}` or `@filename`
// token, or exact-matches the known codex suggestion set. A real typed-but-
// unsubmitted command stays visible (it is genuine pane state); only text the
// USER NEVER WROTE is stripped.
const KNOWN_INPUT_BOX_GHOSTS = new Set(
  [
    'implement {feature}',
    'write tests for @filename',
    'find and fix a bug in @filename',
    'explain this codebase',
    'summarize recent commits',
  ],
);
const INPUT_BOX_LINE = /^\s*[›❯>]\s+(.*\S)\s*$/;
const TEMPLATE_TOKEN = /\{[a-z_-]+\}|@filename\b/i;

function isInputBoxGhostLine(line: string): boolean {
  const m = INPUT_BOX_LINE.exec(line);
  if (!m) return false;
  const content = m[1]!.trim();
  return TEMPLATE_TOKEN.test(content) || KNOWN_INPUT_BOX_GHOSTS.has(content.toLowerCase());
}

export function sanitizeTmuxOutput(raw: string, extraPatterns?: string[]): string {
  let output = raw;

  // Strip ANSI escape codes
  output = output.replace(ANSI_REGEX, '');

  // Strip control characters
  output = output.replace(CONTROL_CHAR_REGEX, '');

  // Redact credentials
  const patterns = [...DEFAULT_CREDENTIAL_PATTERNS];
  if (extraPatterns) {
    for (const p of extraPatterns) {
      try { patterns.push(new RegExp(p, 'gi')); } catch { /* skip invalid */ }
    }
  }
  for (const pattern of patterns) {
    output = output.replace(pattern, '[REDACTED]');
  }

  // Remove lines matching injection patterns, and input-box ghost-text lines
  // (placeholder suggestions the user never typed — see isInputBoxGhostLine).
  output = output
    .split('\n')
    .filter(line => !INJECTION_PATTERNS.some(p => p.test(line)) && !isInputBoxGhostLine(line))
    .join('\n');

  return output.trim();
}

const URL_REGEX = /https?:\/\/\S+/i;
const IMPERATIVE_COMMANDS = /\b(sudo|rm\s|git\s+push|curl\s|wget\s|chmod|chown|kill\s|pkill)\b/i;
const INPUT_REQUESTS = /\b(enter your|type your|provide your|what is your|password|credential|api.?key|token)\b/i;

export function guardProxyOutput(text: string): { safe: boolean; reason?: string } {
  if (URL_REGEX.test(text)) {
    return { safe: false, reason: 'Contains URL' };
  }
  if (IMPERATIVE_COMMANDS.test(text)) {
    return { safe: false, reason: 'Contains imperative command' };
  }
  if (INPUT_REQUESTS.test(text)) {
    return { safe: false, reason: 'Requests user input/credentials' };
  }
  return { safe: true };
}
