async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
  })
  const data = response.status === 204
    ? null
    : await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || 'Podatkov ni bilo mogoče naložiti.')
  }

  return data
}

export function getCategories() {
  return requestJson('/api/kategorije')
}

export function getReports(filters = {}) {
  const params = new URLSearchParams()

  if (filters.leto) params.set('leto', filters.leto)
  if (filters.kategorija) params.set('kategorija', filters.kategorija)
  if (filters.q?.trim()) params.set('q', filters.q.trim())

  const query = params.toString()
  return requestJson(`/api/porocila${query ? `?${query}` : ''}`)
}

export function getReport(id) {
  return requestJson(`/api/porocila/${id}`)
}

export async function getCurrentUser() {
  const data = await requestJson('/api/auth/me')
  return data.user
}

export async function login(credentials) {
  const data = await requestJson('/api/auth/prijava', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  })

  return data.user
}

export function logout() {
  return requestJson('/api/auth/odjava', { method: 'POST' })
}
