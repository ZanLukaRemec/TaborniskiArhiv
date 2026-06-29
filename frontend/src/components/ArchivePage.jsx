import { useEffect, useState } from 'react'
import { getCategories, getReports } from '../api'
import ArchiveFilters from './ArchiveFilters'
import ArchiveTree from './ArchiveTree'
import ReportList from './ReportList'

function ArchivePage({ onNewReport, onOpenReport }) {
  const [categories, setCategories] = useState([])
  const [reports, setReports] = useState([])
  const [years, setYears] = useState([])
  const [filters, setFilters] = useState({ leto: '', kategorija: '', q: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const hasFilters = Boolean(filters.leto || filters.kategorija || filters.q.trim())

  useEffect(() => {
    async function loadArchiveBase() {
      try {
        const [categoryData, reportData] = await Promise.all([
          getCategories(),
          getReports(),
        ])

        setCategories(categoryData)
        setReports(reportData)
        setYears(
          [...new Set(reportData.map((report) => report.arhivirno_leto))]
            .sort((a, b) => b - a),
        )
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadArchiveBase()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')

      try {
        setReports(await getReports(filters))
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [filters])

  function clearFilters() {
    setFilters({ leto: '', kategorija: '', q: '' })
  }

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  return (
    <section className="archive-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Brskanje in iskanje</p>
          <h2>Arhiv poročil</h2>
          <p>Odpri leto in kategorijo ali uporabi filtre za natančnejše iskanje.</p>
        </div>
        <button className="button primary" onClick={onNewReport} type="button">
          Novo poročilo
        </button>
      </header>

      <ArchiveFilters
        categories={categories}
        filters={filters}
        onChange={updateFilter}
        onClear={clearFilters}
        years={years}
      />

      {error && <div className="notice" role="alert">{error}</div>}

      <div className="archive-results">
        {loading
          ? <div className="empty-state">Nalagam poročila ...</div>
          : hasFilters
            ? (
              <>
                <p className="results-count">Najdenih poročil: <strong>{reports.length}</strong></p>
                <ReportList
                  emptyMessage="Ni poročil, ki ustrezajo izbranim filtrom."
                  onOpenReport={onOpenReport}
                  reports={reports}
                />
              </>
            )
            : <ArchiveTree onOpenReport={onOpenReport} reports={reports} />}
      </div>
    </section>
  )
}

export default ArchivePage
