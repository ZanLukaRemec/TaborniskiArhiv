import Sidebar from './Sidebar'

function AppShell({
  activePage,
  children,
  onLogout,
  onNavigate,
  onNewReport,
  pageTitle,
  user,
}) {
  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        isAdministrator={user.vloge.includes('administrator')}
        onNavigate={onNavigate}
        onNewReport={onNewReport}
      />

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-title">
            <p className="eyebrow">Taborniški arhiv</p>
            <h1>{pageTitle}</h1>
          </div>

          <div className="user-area">
            <div className="user-avatar" aria-hidden="true">
              {user.ime[0]}{user.priimek[0]}
            </div>
            <div className="user-summary">
              <strong>{user.ime} {user.priimek}</strong>
              <span>{user.vloge.join(', ') || 'član'}</span>
            </div>
            <button className="button ghost small" onClick={onLogout} type="button">
              Odjava
            </button>
          </div>
        </header>

        <div className="page-content">{children}</div>
      </main>
    </div>
  )
}

export default AppShell
