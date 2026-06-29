import { useEffect, useState } from 'react'
import {
  createReport,
  getCategories,
  getCurrentUser,
  getReport,
  getReportOptions,
  getReports,
  login,
  logout,
  updateReport,
} from './api'
import ArchiveFilters from './components/ArchiveFilters'
import ArchiveTree from './components/ArchiveTree'
import EditReportDialog from './components/EditReportDialog'
import LoginDialog from './components/LoginDialog'
import NewReportDialog from './components/NewReportDialog'
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
  const [newReportOpen, setNewReportOpen] = useState(false)
  const [editReportOpen, setEditReportOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [notification, setNotification] = useState('')

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
      setNewReportOpen(false)
      setEditReportOpen(false)
    } catch (logoutError) {
      setError(logoutError.message)
    }
  }

  function openNewReport() {
    setNotification('')

    if (user) {
      setNewReportOpen(true)
    } else {
      setLoginOpen(true)
    }
  }

  async function handleCreateReport(report) {
    try {
      const created = await createReport(report)
      const [reportsData, reportData] = await Promise.all([
        getReports(),
        getReport(created.id),
      ])

      setFilters({ leto: '', kategorija: '', q: '' })
      setReports(reportsData)
      setYears(uniqueYears(reportsData))
      setSelectedReport(reportData)
      setNotification('Osnutek je ustvarjen.')
      setNewReportOpen(false)
    } catch (createError) {
      const existingReportId = createError.data?.porocilo?.id

      if (createError.status === 409 && existingReportId) {
        setSelectedReport(await getReport(existingReportId))
        setNotification(createError.message)
        setNewReportOpen(false)
        return
      }

      throw createError
    }
  }

  async function handleSaveReport(id, content) {
    await updateReport(id, content)
    const [reportsData, reportData] = await Promise.all([
      getReports(filters),
      getReport(id),
    ])

    setReports(reportsData)
    setSelectedReport(reportData)
    setNotification('Osnutek je shranjen.')
    setEditReportOpen(false)
  }

  const canEditSelectedReport = Boolean(
    user
    && selectedReport
    && selectedReport.status === 'osnutek'
    && selectedReport.struktura_obrazca
    && (
      selectedReport.avtor_id === user.id
      || user.vloge.includes('administrator')
    ),
  )

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
        {notification && (
          <div className="notice info" role="status">{notification}</div>
        )}

        <section className="archive-panel" id="arhiv">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Brskanje po arhivu</p>
              <h3>Odpri leto, nato kategorijo</h3>
            </div>
            <button
              className="button primary"
              disabled={!authChecked}
              onClick={openNewReport}
              type="button"
            >
              Novo poročilo
            </button>
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
              <ReportDetails
                loading={loadingDetails}
                onEdit={canEditSelectedReport ? () => setEditReportOpen(true) : null}
                report={selectedReport}
              />
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

      {newReportOpen && user && (
        <NewReportDialog
          loadOptions={getReportOptions}
          onClose={() => setNewReportOpen(false)}
          onCreate={handleCreateReport}
        />
      )}

      {editReportOpen && selectedReport && (
        <EditReportDialog
          onClose={() => setEditReportOpen(false)}
          onSave={handleSaveReport}
          report={selectedReport}
        />
      )}
    </div>
  )
}

export default App
