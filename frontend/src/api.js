async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
  })
  const data = response.status === 204
    ? null
    : await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(data?.error || 'Podatkov ni bilo mogoče naložiti.')
    error.status = response.status
    error.data = data
    throw error
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
  if (filters.status) params.set('status', filters.status)
  if (filters.moji) params.set('moji', '1')
  if (filters.limit) params.set('limit', filters.limit)

  const query = params.toString()
  return requestJson(`/api/porocila${query ? `?${query}` : ''}`)
}

export function getReport(id) {
  return requestJson(`/api/porocila/${id}`)
}

export function updateReport(id, content) {
  return requestJson(`/api/porocila/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vsebina_obrazca: content }),
  })
}

export function submitReport(id) {
  return requestJson(`/api/porocila/${id}/oddaja`, {
    method: 'POST',
  })
}

export function reopenReport(id) {
  return requestJson(`/api/porocila/${id}/vrni-v-osnutek`, {
    method: 'POST',
  })
}

export function deleteReport(id) {
  return requestJson(`/api/porocila/${id}`, {
    method: 'DELETE',
  })
}

export function createReport(report) {
  return requestJson('/api/porocila', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  })
}

export function getReportOptions(year) {
  return requestJson(`/api/porocila/moznosti?leto=${year}`)
}

export function getTemplates() {
  return requestJson('/api/predloge')
}

export function createTemplate(template) {
  return requestJson('/api/predloge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  })
}

export function getAuditLog(filters = {}) {
  const params = new URLSearchParams()

  if (filters.tabela) params.set('tabela', filters.tabela)
  if (filters.limit) params.set('limit', filters.limit)

  const query = params.toString()
  return requestJson(`/api/dnevnik${query ? `?${query}` : ''}`)
}

export function getUsers() {
  return requestJson('/api/uporabniki')
}

export function createUser(user) {
  return requestJson('/api/uporabniki', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  })
}

export function updateUser(userId, user) {
  return requestJson(`/api/uporabniki/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  })
}

export function assignUserRole(userId, assignment) {
  return requestJson(`/api/uporabniki/${userId}/vloge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assignment),
  })
}

export function revokeUserRole(userId, assignmentId, validTo) {
  return requestJson(`/api/uporabniki/${userId}/vloge/${assignmentId}/odvzemi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ odvzeta_dne: validTo }),
  })
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
