function ArchiveFilters({ categories, filters, onChange, onClear, years }) {
  return (
    <form className="filters" onSubmit={(event) => event.preventDefault()}>
      <label>
        <span>Iskanje</span>
        <input
          type="search"
          value={filters.q}
          onChange={(event) => onChange('q', event.target.value)}
          placeholder="Naslov, avtor ali vsebina"
        />
      </label>

      <label>
        <span>Leto</span>
        <select value={filters.leto} onChange={(event) => onChange('leto', event.target.value)}>
          <option value="">Vsa leta</option>
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </label>

      <label>
        <span>Kategorija</span>
        <select value={filters.kategorija} onChange={(event) => onChange('kategorija', event.target.value)}>
          <option value="">Vse kategorije</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.naziv}</option>
          ))}
        </select>
      </label>

      <button className="button secondary" type="button" onClick={onClear}>Počisti</button>
    </form>
  )
}

export default ArchiveFilters
