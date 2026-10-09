async function request(method, url, body, headers = {}) {
  const isRaw = body instanceof Blob || body instanceof File;
  const res = await fetch(url, {
    method, credentials: 'same-origin',
    headers: { ...(body && !isRaw ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? (isRaw ? body : JSON.stringify(body)) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) { const e = new Error(data?.error || 'Request failed'); e.status = res.status; throw e; }
  return data;
}
export const api = {
  get: (url) => request('GET', url),
  post: (url, body, headers) => request('POST', url, body ?? {}, headers),
};
