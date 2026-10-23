import { expect, it } from 'vitest';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_NATIVE_SYSTEM_PROMPT,
  SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { CODEX_CONVERSATION_SYSTEM_PROMPT, CODEX_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-codex-provider.js';

// The recorded 969390644 reply-review triggered reasoning_extraction and a model
// fallback. Keep the flat protocol, asking only for an evidence-based explanation.
it.each([
  ['subscription conversation', SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT],
  ['subscription tools', SUBSCRIPTION_TOOLS_SYSTEM_PROMPT],
  ['subscription native', SUBSCRIPTION_NATIVE_SYSTEM_PROMPT],
  ['codex conversation', CODEX_CONVERSATION_SYSTEM_PROMPT],
  ['codex tools', CODEX_TOOLS_SYSTEM_PROMPT],
])('%s asks for a brief rationale, never full internal reasoning', (_name, prompt) => {
  expect(prompt).not.toMatch(/all (?:of )?your reasoning|full (?:internal )?reasoning|chain.of.thought/iu);
  expect(prompt).toContain('Its first field is "reasoning": give a brief decision rationale supported by the relevant evidence.');
  expect(prompt).toContain('Respond with one flat JSON object');
});
