// Rules 1/4/100: project known state-export sources, never match ordinary page text.
export const PROFILE_MARKER = '[stored sign-in state removed]';
const exports = new Set(['browser_cookie_list', 'browser_cookie_get', 'browser_storage_state',
  'browser_localstorage_list', 'browser_localstorage_get', 'browser_sessionstorage_list', 'browser_sessionstorage_get',
  'browser_network_request', 'browser_stop_recording', 'browser_stop_tracing', 'browser_stop_video']);
export const profileExport = tool => exports.has(tool);
const header = name => /^(cookie|set-cookie|authorization|proxy-authorization)$/iu.test(name);
export function projectHeaders(value) {
  if (Array.isArray(value)) return value.map(row => row && typeof row.name === 'string' && header(row.name) ? { ...row, value: PROFILE_MARKER } : projectHeaders(row));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, header(key) ? PROFILE_MARKER : projectHeaders(item)]));
}
// Protocol identity follows the pinned dispatcher, never a name supplied by the worker.
export function projectProtocol(dispatch) {
  const pending = new Map(), seen = new Set(), artifacts = new Set(), streams = new Set(), cdpStreams = new Set();
  return {
    request(p, target) { if (p.method === '__abort__') return true; if (!(Number.isSafeInteger(p.id) || (typeof p.id === 'string' && p.id.length > 0 && p.id.length < 128)) || seen.has(p.id)) return false; seen.add(p.id); pending.set(p.id, { type: target?._type, method: p.method, guid: p.guid, cdp: p.params?.method, handle: p.params?.params?.handle }); return true; },
    response(message) {
      const source = pending.get(message.id); if (message.id) pending.delete(message.id);
      const result = message.result;
      if (source && result) {
        if (['BrowserContext', 'APIRequestContext'].includes(source.type) && ['cookies', 'storageState'].includes(source.method)) {
          if (result.cookies) result.cookies = result.cookies.map(cookie => ({ ...cookie, value: PROFILE_MARKER }));
          if (result.origins) result.origins = [];
        }
        if (source.type === 'APIRequestContext' && source.method === 'fetchLog') result.log = [PROFILE_MARKER];
        if (source.type === 'Tracing' && ['harExport', 'tracingStopChunk'].includes(source.method)) {
          if (result.artifact) artifacts.add(result.artifact.guid);
          if (result.entries) result.entries = [];
        }
        if (source.type === 'Artifact' && artifacts.has(source.guid) && result.stream) streams.add(result.stream.guid);
        if (source.type === 'Stream' && streams.has(source.guid) && result.binary) result.binary = '';
        if (source.type === 'Browser' && source.method === 'stopTracing' && result.artifact) artifacts.add(result.artifact.guid);
        if (source.type === 'CDPSession' && source.method === 'send') {
          if (/^(Network\.(getCookies|getAllCookies)|Storage\.getCookies)$/u.test(source.cdp)) result.result = { cookies: [] };
          if (source.cdp === 'DOMStorage.getDOMStorageItems') result.result = { entries: [] };
          if (source.cdp === 'IndexedDB.requestData') result.result = { objectStoreDataEntries: [], hasMore: false };
          if (source.cdp === 'IO.read' && cdpStreams.has(source.handle)) result.result = { data: '', eof: true };
        }
      }
      // Video is delivered as an Artifact in Page.video, outside a request/reply pair.
      if (message.method === 'video' && message.params?.artifact) artifacts.add(message.params.artifact.guid);
      if (message.method === '__create__' && message.params?.initializer?.video) artifacts.add(message.params.initializer.video.guid);
      const type = message.method === '__create__' ? message.params?.type : dispatch._dispatcherByGuid.get(message.guid)?._type;
      if (type === 'CDPSession' && message.params?.method === 'Tracing.tracingComplete' && message.params.params?.stream) cdpStreams.add(message.params.params.stream);
      if (type === 'CDPSession' && message.method === 'event' && /^(Network|DOMStorage|IndexedDB|Storage)\./u.test(message.params?.method)) message.params.params = {};
      if (type === 'CDPSession' && message.params?.method === 'Tracing.dataCollected') message.params.params = { value: [] };
      // Only header-bearing protocol sources are projected; page evaluation JSON stays ordinary.
      return ['Request', 'Response', 'APIRequestContext', 'CDPSession'].includes(type ?? source?.type) ? projectHeaders(message) : message;
    }
  };
}
// The pinned API request implementation funnels redirects, retries and auth retries here.
export function guardProfileRequest(api, network) {
  const original = api._sendRequest;
  api._sendRequest = (progress, log, url, options, body) => network({ method: options.method, url: url.href,
    headers: options.headers, postData: body?.toString('base64') ?? '' }, () => original.call(api, progress, log, url, options, body));
  return () => { api._sendRequest = original; };
}
