import { useEffect, useState } from 'react'

function ReportAdminActions({ loading, onDelete, onReopen, report }) {
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    setConfirmation('')
  }, [report.status])

  if (confirmation) {
    const reopening = confirmation === 'reopen'

    return (
      <div
        aria-label={reopening ? 'Potrdi vrnitev v osnutek' : 'Potrdi izbris poročila'}
        className={`admin-confirmation ${reopening ? '' : 'danger'}`}
        role="alertdialog"
      >
        <strong>
          {reopening ? 'Vrni poročilo v osnutek?' : 'Trajno izbriši poročilo?'}
        </strong>
        <p>
          {reopening
            ? 'Datum oddaje bo odstranjen, avtor pa bo poročilo lahko ponovno urejal.'
            : `Poročilo »${report.naslov}« bo trajno odstranjeno iz arhiva.`}
        </p>
        <div>
          <button
            className="button ghost small"
            disabled={loading}
            onClick={() => setConfirmation('')}
            type="button"
          >
            Prekliči
          </button>
          <button
            className={`button small ${reopening ? 'secondary' : 'danger'}`}
            disabled={loading}
            onClick={reopening ? onReopen : onDelete}
            type="button"
          >
            {loading ? 'Izvajam ...' : reopening ? 'Vrni v osnutek' : 'Izbriši'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-report-actions">
      {report.status === 'arhivirano' && (
        <button
          className="button secondary"
          onClick={() => setConfirmation('reopen')}
          type="button"
        >
          Vrni v osnutek
        </button>
      )}
      <button
        className="button danger"
        onClick={() => setConfirmation('delete')}
        type="button"
      >
        Izbriši
      </button>
    </div>
  )
}

export default ReportAdminActions
