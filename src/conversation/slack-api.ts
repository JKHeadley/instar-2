/** Bounded Slack Web API parsing; transport and SecretRef custody belong to Part Ten. */
import type { SecretRef } from '../index.js';

export interface SlackHttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}
export interface SlackHttpTransport {
  readonly owner: 'part-ten';
  post(input: Readonly<{ method: 'auth.test' | 'chat.postMessage'; token: SecretRef;
    body: string; timeout: number; hiddenRetries: 0 }>): Promise<SlackHttpResponse>;
}
export type SlackApiResult = Readonly<{
  ok: true; body: Readonly<Record<string, unknown>>; retryAfter: null;
} | { ok: false; error: string; permanent: boolean; retryAfter: number | null; uncertain: boolean }>;
const permanent = new Set(['invalid_auth', 'account_inactive', 'token_revoked', 'token_expired',
  'org_login_required', 'ekm_access_denied', 'missing_scope', 'not_authed']);
const boundedRetryAfter = (text: string | undefined): number | null => {
  if (text === undefined || !/^[0-9]+$/u.test(text)) return null;
  const seconds = Number(text);
  return Number.isSafeInteger(seconds) && seconds <= 3600 ? seconds : null;
};
export function createSlackApiClient(transport: SlackHttpTransport, token: SecretRef,
  timeout: number, maxResponseBytes = 65536, maxRequestBytes = 8192) {
  if (transport.owner !== 'part-ten' || !Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 30000
    || !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0 || maxResponseBytes > 1048576
    || !Number.isSafeInteger(maxRequestBytes) || maxRequestBytes <= 0 || maxRequestBytes > 65536)
    throw new Error('Slack API requires bounded Part Ten transport');
  return Object.freeze({
    async call(method: 'auth.test' | 'chat.postMessage', params: Readonly<Record<string, unknown>>): Promise<SlackApiResult> {
      if (method !== 'auth.test' && method !== 'chat.postMessage') throw new Error('unsupported Slack API method');
      const requestBody = JSON.stringify(params);
      if (new TextEncoder().encode(requestBody).length > maxRequestBytes)
        return { ok: false, error: 'request-too-large', permanent: true, retryAfter: null, uncertain: false };
      let response: SlackHttpResponse;
      try { response = await transport.post({ method, token, body: requestBody, timeout, hiddenRetries: 0 }); }
      catch { return { ok: false, error: 'transport-unknown', permanent: false, retryAfter: null, uncertain: true }; }
      if (new TextEncoder().encode(response.body).length > maxResponseBytes)
        return { ok: false, error: 'response-too-large', permanent: false, retryAfter: null, uncertain: true };
      let body: unknown;
      try { body = JSON.parse(response.body) as unknown; }
      catch { return { ok: false, error: 'invalid-response', permanent: false, retryAfter: null, uncertain: true }; }
      if (body === null || typeof body !== 'object' || Array.isArray(body))
        return { ok: false, error: 'invalid-response', permanent: false, retryAfter: null, uncertain: true };
      const parsed = body as Readonly<Record<string, unknown>>;
      if (response.status >= 200 && response.status < 300 && parsed.ok === true)
        return { ok: true, body: parsed, retryAfter: null };
      const error = typeof parsed.error === 'string' ? parsed.error : `http-${response.status}`;
      return { ok: false, error, permanent: permanent.has(error),
        retryAfter: response.status === 429 || error === 'ratelimited'
          ? boundedRetryAfter(response.headers['retry-after'] ?? (typeof (parsed.response_metadata as Record<string, unknown> | undefined)?.retry_after === 'number'
            ? String((parsed.response_metadata as Record<string, unknown>).retry_after) : undefined)) : null,
        uncertain: method === 'chat.postMessage' && !permanent.has(error) };
    },
  });
}
