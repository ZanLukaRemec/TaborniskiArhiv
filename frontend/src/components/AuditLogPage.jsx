import { useEffect, useState } from 'react'
import { getAuditLog } from '../api'

const ACTION_LABELS = {
  CREATE: 'Ustvarjeno',
  UPDATE: 'Posodobljeno',
  REOPEN: 'Vrnjeno v osnutek',
  DELETE: 'Izbrisano',
  ASSIGN: 'Vloga dodeljena',
  REVOKE: 'Vloga zaključena',
  PASSWORD_CHANGE: 'Geslo spremenjeno',
  PASSWORD_RESET: 'Geslo ponastavljeno',
}

const TABLE_LABELS = {
  porocilo: 'Poročilo',
  predloga_obrazca: 'Predloga',
  clan: 'Uporabnik',
  dodelitev_vloge: 'Dodelitev vloge',
}

function formatAuditDate(value) {
  if (!value) return 'Ni podatka'

  const [date, time] = value.split(' ')
  const [year, month, day] = date.split('-')
  return `${day}. ${month}. ${year} ob ${time.slice(0, 5)}`
}

function AuditLogPage() {
  const [entries, setEntries] = useState([])
  const [table, setTable] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadEntries() {
      setLoading(true)
      setError('')

      try {
        const data = await getAuditLog({ tabela: table, limit: 100 })
        if (active) setEntries(data)
      } catch (loadError) {
        if (active) setError(loadError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadEntries()
    return () => {
      active = false
    }
  }, [table])

  return (
    <section className="audit-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Administracija</p>
          <h2>Revizijski dnevnik</h2>
          <p>Pregled ključnih sprememb poročil, predlog, uporabnikov in vlog.</p>
        </div>
        <label className="audit-filter">
          <span>Prikaži</span>
          <select onChange={(event) => setTable(event.target.value)} value={table}>
            <option value="">Vse spremembe</option>
            <option value="porocilo">Poročila</option>
            <option value="predloga_obrazca">Predloge</option>
            <option value="clan">Uporabniki</option>
            <option value="dodelitev_vloge">Dodelitve vlog</option>
          </select>
        </label>
      </header>

      {error && <div className="notice" role="alert">{error}</div>}

      {loading ? (
        <div className="empty-state page-state">Nalagam dnevnik ...</div>
      ) : entries.length ? (
        <div className="audit-list">
          <div className="audit-list-header" aria-hidden="true">
            <span>Dejanje</span>
            <span>Vrsta in zapis</span>
            <span>Izvajalec</span>
            <span>Čas</span>
          </div>
          {entries.map((entry) => (
            <div className="audit-row" key={entry.id}>
              <span className={`audit-action ${entry.akcija.toLowerCase()}`}>
                {ACTION_LABELS[entry.akcija] || entry.akcija}
              </span>
              <span>
                <strong>{TABLE_LABELS[entry.tabela] || entry.tabela}</strong>
                <small>#{entry.zapis_id}</small>
              </span>
              <span>
                {entry.avtor_ime
                  ? `${entry.avtor_ime} ${entry.avtor_priimek}`
                  : 'Sistemsko dejanje'}
              </span>
              <time dateTime={entry.datum}>{formatAuditDate(entry.datum)}</time>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">Za izbrani filter ni zabeleženih sprememb.</div>
      )}
    </section>
  )
}

export default AuditLogPage
