import StatusBadge from './StatusBadge'

function groupReports(reports) {
  return reports.reduce((years, report) => {
    const yearKey = report.arhivirno_leto
    const categoryKey = report.kategorija_naziv

    if (!years[yearKey]) years[yearKey] = {}
    if (!years[yearKey][categoryKey]) years[yearKey][categoryKey] = []

    years[yearKey][categoryKey].push(report)
    return years
  }, {})
}

function ArchiveTree({ loading, onSelectReport, reports, selectedReportId }) {
  if (loading) {
    return <div className="empty-state">Nalagam poročila.</div>
  }

  if (reports.length === 0) {
    return <div className="empty-state">Ni poročil za izbrane filtre.</div>
  }

  const groupedReports = groupReports(reports)
  const sortedYears = Object.keys(groupedReports).sort((a, b) => Number(b) - Number(a))

  return (
    <div className="archive-tree" aria-live="polite">
      {sortedYears.map((year) => {
        const categoryGroups = groupedReports[year]
        const categories = Object.keys(categoryGroups).sort((a, b) => a.localeCompare(b, 'sl'))
        const yearCount = categories.reduce((count, category) => count + categoryGroups[category].length, 0)

        return (
          <section className="year-group" key={year}>
            <header className="year-heading">
              <span>{year}</span>
              <small>{yearCount} dokumentov</small>
            </header>

            <div className="category-stack">
              {categories.map((category) => (
                <section className="category-group" key={`${year}-${category}`}>
                  <div className="category-heading">
                    <h4>{category}</h4>
                    <span>{categoryGroups[category].length}</span>
                  </div>

                  <div className="report-stack">
                    {categoryGroups[category].map((report) => (
                      <button
                        className={`report-row ${selectedReportId === report.id ? 'selected' : ''}`}
                        key={report.id}
                        type="button"
                        onClick={() => onSelectReport(report.id)}
                      >
                        <StatusBadge status={report.status} />
                        <span className="report-title">{report.naslov}</span>
                        <span className="report-meta">{report.avtor_ime} {report.avtor_priimek}</span>
                        <span className="report-meta">{report.ime_voda || 'Splošni arhiv'}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default ArchiveTree
