async function requestJson(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Podatkov ni bilo mogoče naložiti.')
  }

  return response.json()
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
