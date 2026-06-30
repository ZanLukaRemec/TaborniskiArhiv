function Sidebar({ activePage, isAdministrator, onNavigate, onNewReport }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onNavigate('dashboard')} type="button">
        <span className="brand-mark">TA</span>
        <span>
          <small>Rod Puntarjev Tolmin</small>
          <strong>Taborniški arhiv</strong>
        </span>
      </button>

      <nav className="nav-list" aria-label="Glavna navigacija">
        <button
          className={activePage === 'dashboard' ? 'active' : ''}
          onClick={() => onNavigate('dashboard')}
          type="button"
        >
          Začetek
        </button>
        <button
          className={activePage === 'archive' || activePage === 'report' ? 'active' : ''}
          onClick={() => onNavigate('archive')}
          type="button"
        >
          Arhiv
        </button>
        <button
          className={activePage === 'wizard' ? 'active' : ''}
          onClick={onNewReport}
          type="button"
        >
          Novo poročilo
        </button>
        <button
          className={activePage === 'account' ? 'active' : ''}
          onClick={() => onNavigate('account')}
          type="button"
        >
          Moj račun
        </button>
        {isAdministrator && (
          <>
            <button
              className={activePage === 'users' ? 'active' : ''}
              onClick={() => onNavigate('users')}
              type="button"
            >
              Uporabniki
            </button>
            <button
              className={activePage === 'templates' ? 'active' : ''}
              onClick={() => onNavigate('templates')}
              type="button"
            >
              Predloge
            </button>
            <button
              className={activePage === 'audit' ? 'active' : ''}
              onClick={() => onNavigate('audit')}
              type="button"
            >
              Dnevnik
            </button>
          </>
        )}
      </nav>

      <p className="sidebar-note">
        Interni arhiv poročil in dokumentacije rodu.
      </p>
    </aside>
  )
}

export default Sidebar
