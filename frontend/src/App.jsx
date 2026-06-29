import { useEffect, useState } from 'react'
import { getCurrentUser, login, logout } from './api'
import AppShell from './components/AppShell'
import ArchivePage from './components/ArchivePage'
import DashboardPage from './components/DashboardPage'
import LoginPage from './components/LoginPage'
import ReportPage from './components/ReportPage'
import ReportWizard from './components/ReportWizard'
import TemplatesPage from './components/TemplatesPage'
import './App.css'

const PAGE_TITLES = {
  dashboard: 'Delovna plošča',
  archive: 'Arhiv poročil',
  report: 'Poročilo',
  wizard: 'Novo poročilo',
  templates: 'Predloge poročil',
}

function App() {
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [reportId, setReportId] = useState(null)
  const [wizardReportId, setWizardReportId] = useState(null)
  const [notification, setNotification] = useState('')

  useEffect(() => {
    async function restoreSession() {
      try {
        setUser(await getCurrentUser())
      } catch {
        setUser(null)
      } finally {
        setAuthChecked(true)
      }
    }

    restoreSession()
  }, [])

  function navigate(nextPage) {
    setNotification('')
    setPage(nextPage)
    window.scrollTo(0, 0)
  }

  function openReport(id, message = '') {
    setReportId(id)
    setNotification(message)
    setPage('report')
    window.scrollTo(0, 0)
  }

  function openWizard(id = null) {
    setWizardReportId(id)
    setNotification('')
    setPage('wizard')
    window.scrollTo(0, 0)
  }

  async function handleLogin(credentials) {
    const loggedInUser = await login(credentials)
    setUser(loggedInUser)
    setPage('dashboard')
  }

  async function handleLogout() {
    await logout()
    setUser(null)
    setPage('dashboard')
    setReportId(null)
    setWizardReportId(null)
    setNotification('')
  }

  if (!authChecked) {
    return (
      <main className="session-loading">
        <div className="brand-seal">TA</div>
        <p>Odpiram taborniški arhiv ...</p>
      </main>
    )
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <AppShell
      activePage={page}
      onLogout={handleLogout}
      onNavigate={navigate}
      onNewReport={() => openWizard()}
      pageTitle={PAGE_TITLES[page]}
      user={user}
    >
      {notification && (
        <div className="notice info" role="status">{notification}</div>
      )}

      {page === 'dashboard' && (
        <DashboardPage
          onNavigate={navigate}
          onNewReport={() => openWizard()}
          onOpenReport={openReport}
          user={user}
        />
      )}

      {page === 'archive' && (
        <ArchivePage
          onNewReport={() => openWizard()}
          onOpenReport={openReport}
        />
      )}

      {page === 'report' && reportId && (
        <ReportPage
          onBack={() => navigate('archive')}
          onEdit={(id) => openWizard(id)}
          reportId={reportId}
          user={user}
        />
      )}

      {page === 'wizard' && (
        <ReportWizard
          initialReportId={wizardReportId}
          key={wizardReportId || 'new-report'}
          onCancel={() => navigate(wizardReportId ? 'report' : 'dashboard')}
          onOpenReport={openReport}
          onSubmitted={(id) => openReport(id, 'Poročilo je uspešno oddano in arhivirano.')}
        />
      )}

      {page === 'templates' && user.vloge.includes('administrator') && (
        <TemplatesPage />
      )}
    </AppShell>
  )
}

export default App
