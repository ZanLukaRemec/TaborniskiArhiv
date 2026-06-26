function Sidebar() {
  return (
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
  )
}

export default Sidebar
