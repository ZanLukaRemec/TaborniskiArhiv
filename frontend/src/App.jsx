import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STATUS_LABELS = {
  arhivirano: 'Arhivirano',
  osnutek: 'Osnutek',
}

function formatDate(value) {
  if (!value) return 'Ni datuma'

  return new Intl.DateTimeFormat('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function parseJson(value) {
  if (!value) return null
  if (typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function summarizeContent(value) {
  const parsed = parseJson(value)
  if (!parsed) return 'Ni strukturirane vsebine.'

  const text = Object.entries(parsed)
    .filter(([, fieldValue]) => fieldValue !== null && fieldValue !== '')
    .map(([key, fieldValue]) => `${key}: ${Array.isArray(fieldValue) ? fieldValue.join(', ') : fieldValue}`)
    .join(' | ')

  return text || 'Ni strukturirane vsebine.'
}

function App() {
  const [categories, setCategories] = useState([])
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [years, setYears] = useState([])
  const [filters, setFilters] = useState({ leto: '', kategorija: '', q: '' })
  const [loadingReports, setLoadingReports] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [categoriesResponse, reportsResponse] = await Promise.all([
          fetch('/api/kategorije'),
          fetch('/api/porocila'),
        ])

        if (!categoriesResponse.ok) throw new Error('Kategorij ni bilo mogoče naložiti.')
        if (!reportsResponse.ok) throw new Error('Let arhiva ni bilo mogoče naložiti.')

        const categoriesData = await categoriesResponse.json()
        const reportsData = await reportsResponse.json()
        const reportYears = reportsData.map((report) => report.arhivirno_leto)

        setCategories(categoriesData)
        setYears([...new Set(reportYears)].sort((a, b) => b - a))
      } catch (loadError) {
        setError(loadError.message)
      }
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    async function loadReports() {
      setLoadingReports(true)
      setError('')

      const params = new URLSearchParams()
      if (filters.leto) params.set('leto', filters.leto)
      if (filters.kategorija) params.set('kategorija', filters.kategorija)
      if (filters.q.trim()) params.set('q', filters.q.trim())

      try {
        const response = await fetch(`/api/porocila?${params.toString()}`)
        if (!response.ok) throw new Error('Poročil ni bilo mogoče naložiti.')
        const data = await response.json()
        setReports(data)
        setSelectedReport((current) => (
          current && data.some((report) => report.id === current.id) ? current : null
        ))
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoadingReports(false)
      }
    }

    loadReports()
  }, [filters])

  const archivedCount = useMemo(
    () => reports.filter((report) => report.status === 'arhivirano').length,
    [reports],
  )

  const draftCount = useMemo(
    () => reports.filter((report) => report.status === 'osnutek').length,
    [reports],
  )

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function clearFilters() {
    setFilters({ leto: '', kategorija: '', q: '' })
  }

  async function selectReport(id) {
    setLoadingDetails(true)
    setError('')

    try {
      const response = await fetch(`/api/porocila/${id}`)
      if (!response.ok) throw new Error('Podrobnosti poročila ni bilo mogoče naložiti.')
      setSelectedReport(await response.json())
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoadingDetails(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">TA</span>
          <div>
            <p className="eyebrow">Rod Puntarjev Tolmin</p>
            <h1>Taborniški arhiv</h1>
          </div>
        </div>

        <nav className="nav-list" aria-label="Glavna navigacija">
          <a className="active" href="#arhiv">Arhiv</a>
          <a href="#porocila">Poročila</a>
          <a href="#uporabniki">Uporabniki</a>
          <a href="#administracija">Administracija</a>
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Začetna nadzorna plošča</p>
            <h2>Arhiv in administracija</h2>
          </div>
          <button type="button">Prijava</button>
        </header>

        {error && <div className="notice">{error}</div>}

        <section className="summary-grid" aria-label="Pregled sistema">
          <article>
            <span className="metric">{reports.length}</span>
            <p>Poročila</p>
          </article>
          <article>
            <span className="metric">{archivedCount}</span>
            <p>Arhivirana</p>
          </article>
          <article>
            <span className="metric">{draftCount}</span>
            <p>Osnutki</p>
          </article>
        </section>

        <section className="panel" id="arhiv">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Arhiv poročil</p>
              <h3>Pregled dokumentov</h3>
            </div>
            <button type="button">Novo poročilo</button>
          </div>

          <form className="filters" onSubmit={(event) => event.preventDefault()}>
            <label>
              <span>Iskanje</span>
              <input
                type="search"
                value={filters.q}
                onChange={(event) => updateFilter('q', event.target.value)}
                placeholder="Naslov, avtor ali vsebina"
              />
            </label>

            <label>
              <span>Leto</span>
              <select value={filters.leto} onChange={(event) => updateFilter('leto', event.target.value)}>
                <option value="">Vsa leta</option>
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Kategorija</span>
              <select value={filters.kategorija} onChange={(event) => updateFilter('kategorija', event.target.value)}>
                <option value="">Vse kategorije</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.naziv}</option>
                ))}
              </select>
            </label>

            <button type="button" onClick={clearFilters}>Počisti</button>
          </form>

          <div className="archive-layout">
            <div className="report-list" aria-live="polite">
              {loadingReports && <div className="empty-state">Nalagam poročila.</div>}

              {!loadingReports && reports.length === 0 && (
                <div className="empty-state">Ni poročil za izbrane filtre.</div>
              )}

              {!loadingReports && reports.map((report) => (
                <button
                  className={`report-row ${selectedReport?.id === report.id ? 'selected' : ''}`}
                  key={report.id}
                  type="button"
                  onClick={() => selectReport(report.id)}
                >
                  <span className={`status ${report.status}`}>{STATUS_LABELS[report.status] || report.status}</span>
                  <strong>{report.naslov}</strong>
                  <span>{report.kategorija_naziv} · {report.arhivirno_leto}</span>
                  <span>{report.avtor_ime} {report.avtor_priimek}</span>
                </button>
              ))}
            </div>

            <aside className="details-panel" aria-label="Podrobnosti poročila">
              {loadingDetails && <div className="empty-state compact">Nalagam podrobnosti.</div>}

              {!loadingDetails && !selectedReport && (
                <div className="empty-state compact">Izberi poročilo za podrobnosti.</div>
              )}

              {!loadingDetails && selectedReport && (
                <>
                  <div className="details-header">
                    <span className={`status ${selectedReport.status}`}>
                      {STATUS_LABELS[selectedReport.status] || selectedReport.status}
                    </span>
                    <h3>{selectedReport.naslov}</h3>
                  </div>

                  <dl className="details-list">
                    <div>
                      <dt>Kategorija</dt>
                      <dd>{selectedReport.kategorija_naziv}</dd>
                    </div>
                    <div>
                      <dt>Arhivsko leto</dt>
                      <dd>{selectedReport.arhivirno_leto}</dd>
                    </div>
                    <div>
                      <dt>Avtor</dt>
                      <dd>{selectedReport.avtor_ime} {selectedReport.avtor_priimek}</dd>
                    </div>
                    <div>
                      <dt>Vod</dt>
                      <dd>{selectedReport.ime_voda || 'Ni vezan na vod'}</dd>
                    </div>
                    <div>
                      <dt>Oddano</dt>
                      <dd>{formatDate(selectedReport.oddano_dne)}</dd>
                    </div>
                  </dl>

                  <div className="content-preview">
                    <h4>Vsebina</h4>
                    <p>{summarizeContent(selectedReport.vsebina_obrazca)}</p>
                  </div>
                </>
              )}
            </aside>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
