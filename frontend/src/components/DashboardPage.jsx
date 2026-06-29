import { useEffect, useState } from 'react'
import { getReports } from '../api'
import ReportList from './ReportList'

function DashboardPage({ onNavigate, onNewReport, onOpenReport, user }) {
  const [drafts, setDrafts] = useState([])
  const [recentReports, setRecentReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [draftData, recentData] = await Promise.all([
          getReports({ status: 'osnutek', moji: true, limit: 6 }),
          getReports({ status: 'arhivirano', limit: 5 }),
        ])

        setDrafts(draftData)
        setRecentReports(recentData)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  return (
    <div className="dashboard-page">
      <section className="welcome-band">
        <div>
          <p className="eyebrow">Dobrodošel, {user.ime}</p>
          <h2>Kaj želiš urediti danes?</h2>
        </div>
        <div className="welcome-actions">
          <button className="button primary" onClick={onNewReport} type="button">
            Novo poročilo
          </button>
          <button className="button secondary" onClick={() => onNavigate('archive')} type="button">
            Odpri arhiv
          </button>
        </div>
      </section>

      {error && <div className="notice" role="alert">{error}</div>}

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Nadaljuj z delom</p>
            <h2>Moji osnutki</h2>
          </div>
          <button className="text-button" onClick={onNewReport} type="button">
            Ustvari novega →
          </button>
        </div>
        {loading
          ? <div className="empty-state">Nalagam osnutke ...</div>
          : (
            <ReportList
              emptyMessage="Trenutno nimaš odprtih osnutkov."
              onOpenReport={onOpenReport}
              reports={drafts}
            />
          )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Nazadnje oddano</p>
            <h2>Sveža poročila v arhivu</h2>
          </div>
          <button className="text-button" onClick={() => onNavigate('archive')} type="button">
            Celoten arhiv →
          </button>
        </div>
        {loading
          ? <div className="empty-state">Nalagam poročila ...</div>
          : (
            <ReportList
              emptyMessage="V arhivu še ni oddanih poročil."
              onOpenReport={onOpenReport}
              reports={recentReports}
            />
          )}
      </section>
    </div>
  )
}

export default DashboardPage
