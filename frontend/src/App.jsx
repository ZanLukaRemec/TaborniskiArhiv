import { useEffect, useState } from 'react'
import {
  getCategories,
  getCurrentUser,
  getReport,
  getReports,
  login,
  logout,
} from './api'
import ArchiveFilters from './components/ArchiveFilters'
import ArchiveTree from './components/ArchiveTree'
import LoginDialog from './components/LoginDialog'
import ReportDetails from './components/ReportDetails'
import Sidebar from './components/Sidebar'
import './App.css'

function uniqueYears(reports) {
  return [...new Set(reports.map((report) => report.arhivirno_leto))]
    .sort((a, b) => b - a)
}

function App() {
  const [categories, setCategories] = useState([])
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [years, setYears] = useState([])
  const [filters, setFilters] = useState({ leto: '', kategorija: '', q: '' })
  const [loadingReports, setLoadingReports] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadSession() {
      try {
        setUser(await getCurrentUser())
      } catch {
        setUser(null)
      } finally {
        setAuthChecked(true)
      }
    }

    loadSession()
  }, [])

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [categoriesData, reportsData] = await Promise.all([
          getCategories(),
          getReports(),
        ])

        setCategories(categoriesData)
        setYears(uniqueYears(reportsData))
      } catch {
        setError('Začetnih podatkov ni bilo mogoče naložiti.')
      }
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    async function loadReports() {
      setLoadingReports(true)
      setError('')

      try {
        const data = await getReports(filters)
        setReports(data)
        setSelectedReport((current) => (
          current && data.some((report) => report.id === current.id) ? current : null
        ))
      } catch {
        setError('Poročil ni bilo mogoče naložiti.')
      } finally {
        setLoadingReports(false)
      }
    }

    loadReports()
  }, [filters])

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
      setSelectedReport(await getReport(id))
    } catch {
      setError('Podrobnosti poročila ni bilo mogoče naložiti.')
    } finally {
      setLoadingDetails(false)
    }
  }

  async function handleLogin(credentials) {
    const loggedInUser = await login(credentials)
    setUser(loggedInUser)
    setLoginOpen(false)
  }

  async function handleLogout() {
    setError('')

    try {
      await logout()
      setUser(null)
    } catch (logoutError) {
      setError(logoutError.message)
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Arhiv in administracija</p>
            <h2>Arhiv poročil</h2>
          </div>
          {authChecked && (
            user ? (
              <div className="auth-area">
                <div className="user-summary">
                  <strong>{user.ime} {user.priimek}</strong>
                  <span>{user.vloge.join(', ') || 'član'}</span>
                </div>
                <button className="button secondary" onClick={handleLogout} type="button">
                  Odjava
                </button>
              </div>
            ) : (
              <button
                className="button primary"
                onClick={() => setLoginOpen(true)}
                type="button"
              >
                Prijava
              </button>
            )
          )}
        </header>

        {error && <div className="notice">{error}</div>}

        <section className="archive-panel" id="arhiv">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Brskanje po arhivu</p>
              <h3>Odpri leto, nato kategorijo</h3>
            </div>
            <button className="button primary" type="button">Novo poročilo</button>
          </div>

          <ArchiveFilters
            categories={categories}
            filters={filters}
            onChange={updateFilter}
            onClear={clearFilters}
            years={years}
          />

          <div className="archive-layout">
            <ArchiveTree
              loading={loadingReports}
              onSelectReport={selectReport}
              reports={reports}
              selectedReportId={selectedReport?.id}
            />

            <aside className="details-panel" aria-label="Podrobnosti poročila">
              <ReportDetails loading={loadingDetails} report={selectedReport} />
            </aside>
          </div>
        </section>
      </main>

      {loginOpen && (
        <LoginDialog
          onClose={() => setLoginOpen(false)}
          onLogin={handleLogin}
        />
      )}
    </div>
  )
}

export default App
