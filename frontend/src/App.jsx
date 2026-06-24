import './App.css'

function App() {
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

        <section className="summary-grid" aria-label="Pregled sistema">
          <article>
            <span className="metric">0</span>
            <p>Poročila</p>
          </article>
          <article>
            <span className="metric">0</span>
            <p>Osnutki</p>
          </article>
          <article>
            <span className="metric">0</span>
            <p>Uporabniki</p>
          </article>
        </section>

        <section className="panel" id="arhiv">
          <div className="panel-header">
            <h3>Arhiv poročil</h3>
            <button type="button">Novo poročilo</button>
          </div>
          <div className="empty-state">Arhiv še nima prikazanih poročil.</div>
        </section>
      </main>
    </div>
  )
}

export default App
