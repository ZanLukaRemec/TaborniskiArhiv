import { useEffect, useState } from 'react'
import { getReport } from '../api'
import ReportDetails from './ReportDetails'

function ReportPage({ onBack, onEdit, reportId, user }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadReport() {
      setLoading(true)

      try {
        setReport(await getReport(reportId))
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadReport()
  }, [reportId])

  if (loading) {
    return <div className="empty-state page-state">Nalagam poročilo ...</div>
  }

  if (error || !report) {
    return (
      <section className="report-page">
        <button className="back-button" onClick={onBack} type="button">← Nazaj na arhiv</button>
        <div className="notice" role="alert">{error || 'Poročilo ni bilo najdeno.'}</div>
      </section>
    )
  }

  const canEdit = report.status === 'osnutek'
    && report.struktura_obrazca
    && (report.avtor_id === user.id || user.vloge.includes('administrator'))

  return (
    <section className="report-page">
      <button className="back-button" onClick={onBack} type="button">← Nazaj na arhiv</button>
      <ReportDetails
        onEdit={canEdit ? () => onEdit(report.id) : null}
        report={report}
      />
    </section>
  )
}

export default ReportPage
