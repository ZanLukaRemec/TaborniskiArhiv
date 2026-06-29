import StatusBadge from './StatusBadge'

function formatDate(value) {
  if (!value) return 'Še ni oddano'

  return new Intl.DateTimeFormat('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function ReportList({ emptyMessage, onOpenReport, reports }) {
  if (!reports.length) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className="report-list">
      {reports.map((report) => (
        <button
          className="report-list-row"
          key={report.id}
          onClick={() => onOpenReport(report.id)}
          type="button"
        >
          <span className="report-list-main">
            <strong>{report.naslov}</strong>
            <small>
              {report.kategorija_naziv} · {report.avtor_ime} {report.avtor_priimek}
            </small>
          </span>
          <span className="report-list-date">
            {report.status === 'osnutek'
              ? `Ustvarjeno ${formatDate(report.ustvarjeno_dne)}`
              : formatDate(report.oddano_dne)}
          </span>
          <StatusBadge status={report.status} />
          <span className="row-arrow" aria-hidden="true">→</span>
        </button>
      ))}
    </div>
  )
}

export default ReportList
