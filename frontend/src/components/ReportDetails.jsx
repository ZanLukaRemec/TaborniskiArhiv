import StatusBadge from './StatusBadge'
import { formatDate, formatValue, parseJson } from '../reportUtils'

function ReportDetails({ onEdit, report }) {
  const content = parseJson(report.vsebina_obrazca)
  const template = parseJson(report.struktura_obrazca)
  const fields = Array.isArray(template.polja) ? template.polja : []
  const metadata = content._meta
  const contentFields = fields.filter((field) => (
    content[field.ime] !== undefined
    && content[field.ime] !== null
    && content[field.ime] !== ''
  ))

  return (
    <>
      <header className="report-detail-header">
        <div>
          <div className="badge-row">
            <StatusBadge status={report.status} />
            <span className="soft-badge">{report.kategorija_naziv}</span>
            <span className="soft-badge">{report.arhivirno_leto}</span>
          </div>
          <h2>{report.naslov}</h2>
        </div>
        {onEdit && (
          <button className="button secondary" onClick={onEdit} type="button">
            Nadaljuj osnutek
          </button>
        )}
      </header>

      <section className="report-meta-grid" aria-label="Podatki poročila">
        <div>
          <span>Avtor</span>
          <strong>{report.avtor_ime} {report.avtor_priimek}</strong>
        </div>
        <div>
          <span>Datum oddaje</span>
          <strong>{formatDate(report.oddano_dne)}</strong>
        </div>
        <div>
          <span>Vod</span>
          <strong>{report.ime_voda || 'Ni vezano na vod'}</strong>
        </div>
        <div>
          <span>Številka</span>
          <strong>#{String(report.id).padStart(4, '0')}</strong>
        </div>
        {metadata?.vloge_nazivi?.length > 0 && (
          <div className="meta-wide">
            <span>Funkcije</span>
            <strong>{metadata.vloge_nazivi.join(', ')}</strong>
          </div>
        )}
      </section>

      <section className="report-body">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Vsebina dokumenta</p>
            <h2>{template.naziv || 'Poročilo'}</h2>
          </div>
        </div>

        {contentFields.length ? (
          <dl className="report-content">
            {contentFields.map((field) => (
              <div key={field.ime}>
                <dt>{field.oznaka}</dt>
                <dd>{formatValue(content[field.ime])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="empty-state">Osnutek še nima vnesene vsebine.</div>
        )}
      </section>
    </>
  )
}

export default ReportDetails
