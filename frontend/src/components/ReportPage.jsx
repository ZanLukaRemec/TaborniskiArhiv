import { useEffect, useState } from 'react'
import { deleteReport, getReport, reopenReport } from '../api'
import ReportAdminActions from './ReportAdminActions'
import ReportDetails from './ReportDetails'

function ReportPage({ onBack, onDeleted, onEdit, reportId, user }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [adminLoading, setAdminLoading] = useState(false)
  const [error, setError] = useState('')
  const [notification, setNotification] = useState('')

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
  const isAdministrator = user.vloge.includes('administrator')

  async function handleReopen() {
    setAdminLoading(true)
    setError('')

    try {
      await reopenReport(report.id)
      setReport(await getReport(report.id))
      setNotification('Poročilo je vrnjeno v osnutek.')
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setAdminLoading(false)
    }
  }

  async function handleDelete() {
    setAdminLoading(true)
    setError('')

    try {
      await deleteReport(report.id)
      onDeleted('Poročilo je trajno izbrisano.')
    } catch (actionError) {
      setError(actionError.message)
      setAdminLoading(false)
    }
  }

  return (
    <section className="report-page">
      <button className="back-button" onClick={onBack} type="button">← Nazaj na arhiv</button>
      {error && <div className="notice" role="alert">{error}</div>}
      {notification && <div className="notice info" role="status">{notification}</div>}
      <ReportDetails
        actions={isAdministrator ? (
          <ReportAdminActions
            loading={adminLoading}
            onDelete={handleDelete}
            onReopen={handleReopen}
            report={report}
          />
        ) : null}
        onEdit={canEdit ? () => onEdit(report.id) : null}
        report={report}
      />
    </section>
  )
}

export default ReportPage
