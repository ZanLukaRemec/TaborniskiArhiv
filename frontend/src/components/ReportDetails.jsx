import StatusBadge from './StatusBadge'

function formatDate(value) {
  if (!value) return 'Ni datuma'

  return new Intl.DateTimeFormat('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function parseJson(value) {
  if (!value) return null
  if (typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function formatValue(value) {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Da' : 'Ne'
  return String(value)
}

function ReportDetails({ loading, onEdit, report }) {
  if (loading) {
    return <div className="empty-state compact">Nalagam podrobnosti.</div>
  }

  if (!report) {
    return <div className="empty-state compact">Izberi poročilo za podrobnosti.</div>
  }

  const content = parseJson(report.vsebina_obrazca)
  const template = parseJson(report.struktura_obrazca)
  const metadata = content?._meta
  const fieldLabels = new Map(
    (template?.polja || []).map((field) => [field.ime, field.oznaka]),
  )
  const contentEntries = content
    ? Object.entries(content).filter(([key, value]) => (
        key !== '_meta' && value !== null && value !== ''
      ))
    : []

  return (
    <>
      <div className="details-header">
        <StatusBadge status={report.status} />
        <h3>{report.naslov}</h3>
        {onEdit && (
          <button className="button secondary small" onClick={onEdit} type="button">
            Uredi osnutek
          </button>
        )}
      </div>

      <dl className="details-list">
        <div>
          <dt>Kategorija</dt>
          <dd>{report.kategorija_naziv}</dd>
        </div>
        <div>
          <dt>Arhivsko leto</dt>
          <dd>{report.arhivirno_leto}</dd>
        </div>
        <div>
          <dt>Avtor</dt>
          <dd>{report.avtor_ime} {report.avtor_priimek}</dd>
        </div>
        <div>
          <dt>Vod</dt>
          <dd>{report.ime_voda || 'Ni vezan na vod'}</dd>
        </div>
        {metadata?.vloge_nazivi?.length > 0 && (
          <div>
            <dt>Funkcije</dt>
            <dd>{metadata.vloge_nazivi.join(', ')}</dd>
          </div>
        )}
        <div>
          <dt>Oddano</dt>
          <dd>{formatDate(report.oddano_dne)}</dd>
        </div>
      </dl>

      <div className="content-preview">
        <h4>Vsebina</h4>
        {contentEntries.length > 0 ? (
          <dl className="content-fields">
            {contentEntries.map(([key, value]) => (
              <div key={key}>
                <dt>{fieldLabels.get(key) || key}</dt>
                <dd>{formatValue(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Ni strukturirane vsebine.</p>
        )}
      </div>
    </>
  )
}

export default ReportDetails
