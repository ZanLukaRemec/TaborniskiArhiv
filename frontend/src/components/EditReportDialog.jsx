import { useState } from 'react'

function parseJson(value) {
  if (!value) return {}
  if (typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

function EditReportDialog({ onClose, onSave, report }) {
  const template = parseJson(report.struktura_obrazca)
  const fields = Array.isArray(template.polja) ? template.polja : []
  const savedContent = parseJson(report.vsebina_obrazca)
  const [content, setContent] = useState(() => (
    fields.reduce((values, field) => ({
      ...values,
      [field.ime]: savedContent[field.ime] ?? '',
    }), {})
  ))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(event) {
    const { checked, name, type, value } = event.target
    setContent((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onSave(report.id, content)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="edit-report-title"
        aria-modal="true"
        className="login-dialog edit-dialog"
        role="dialog"
      >
        <header className="login-header">
          <div>
            <p className="eyebrow">{report.kategorija_naziv} · {report.arhivirno_leto}</p>
            <h3 id="edit-report-title">Uredi osnutek</h3>
          </div>
          <button
            aria-label="Zapri urejanje osnutka"
            className="icon-button"
            onClick={onClose}
            title="Zapri"
            type="button"
          >
            ×
          </button>
        </header>

        <form className="edit-form" onSubmit={handleSubmit}>
          <div className="dynamic-fields">
            {fields.map((field) => {
              if (field.tip === 'textarea') {
                return (
                  <label key={field.ime}>
                    <span>{field.oznaka}</span>
                    <textarea
                      name={field.ime}
                      onChange={updateField}
                      required={field.obvezno}
                      rows="4"
                      value={content[field.ime]}
                    />
                  </label>
                )
              }

              if (field.tip === 'checkbox') {
                return (
                  <label className="checkbox-field" key={field.ime}>
                    <input
                      checked={Boolean(content[field.ime])}
                      name={field.ime}
                      onChange={updateField}
                      type="checkbox"
                    />
                    <span>{field.oznaka}</span>
                  </label>
                )
              }

              return (
                <label key={field.ime}>
                  <span>{field.oznaka}</span>
                  <input
                    name={field.ime}
                    onChange={updateField}
                    required={field.obvezno}
                    step={field.tip === 'number' ? 'any' : undefined}
                    type={['date', 'number'].includes(field.tip) ? field.tip : 'text'}
                    value={content[field.ime]}
                  />
                </label>
              )
            })}
          </div>

          {error && <div className="login-error" role="alert">{error}</div>}

          <div className="login-actions">
            <button className="button secondary" onClick={onClose} type="button">
              Prekliči
            </button>
            <button className="button primary" disabled={loading} type="submit">
              {loading ? 'Shranjujem ...' : 'Shrani osnutek'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default EditReportDialog
