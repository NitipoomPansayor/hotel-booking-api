export async function api(path, options = {}) {
  const response = await fetch(`/api/v1${path}`, {
    ...options, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่');
    error.status = response.status;
    throw error;
  }
  return body;
}

export async function favoriteIds(signal) {
  const ids = [];
  let page = 1, pages;
  do {
    const result = await api(`/favorites?limit=100&page=${page}`, { signal });
    ids.push(...result.data.map((hotel) => hotel._id));
    pages = result.pagination.pages;
    page += 1;
  } while (page <= pages);
  return new Set(ids);
}
