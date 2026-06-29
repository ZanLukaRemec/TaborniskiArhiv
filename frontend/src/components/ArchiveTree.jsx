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

function ArchiveTree({ onOpenReport, reports }) {
  if (!reports.length) {
    return <div className="empty-state">V arhivu še ni poročil.</div>
  }

  const groupedReports = groupReports(reports)
  const sortedYears = Object.keys(groupedReports).sort((a, b) => Number(b) - Number(a))

  return (
    <div className="archive-tree">
      {sortedYears.map((year) => {
        const categoryGroups = groupedReports[year]
        const categories = Object.keys(categoryGroups).sort((a, b) => a.localeCompare(b, 'sl'))
        const yearCount = categories.reduce(
          (count, category) => count + categoryGroups[category].length,
          0,
        )

        return (
          <details className="year-group" key={year}>
            <summary className="year-heading">
              <span className="toggle-icon" aria-hidden="true" />
              <strong>{year}</strong>
              <small>{yearCount} poročil</small>
            </summary>

            <div className="category-stack">
              {categories.map((category) => (
                <details className="category-group" key={`${year}-${category}`}>
                  <summary className="category-heading">
                    <span className="toggle-icon" aria-hidden="true" />
                    <strong>{category}</strong>
                    <span className="count-pill">{categoryGroups[category].length}</span>
                  </summary>

                  <div className="tree-report-list">
                    {categoryGroups[category].map((report) => (
                      <button
                        className="tree-report-row"
                        key={report.id}
                        onClick={() => onOpenReport(report.id)}
                        type="button"
                      >
                        <span>
                          <strong>{report.naslov}</strong>
                          <small>{report.avtor_ime} {report.avtor_priimek}</small>
                        </span>
                        <StatusBadge status={report.status} />
                        <span aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        )
      })}
    </div>
  )
}

export default ArchiveTree
