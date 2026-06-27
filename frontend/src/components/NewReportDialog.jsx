import { useState } from 'react'

function NewReportDialog({ categories, groups, onClose, onCreate }) {
  const [form, setForm] = useState({
    naslov: '',
    kategorija_id: '',
    arhivirno_leto: new Date().getFullYear(),
    vod_id: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onCreate(form)
    } catch (createError) {
      setError(createError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="new-report-title"
        aria-modal="true"
        className="login-dialog report-dialog"
        role="dialog"
      >
        <header className="login-header">
          <div>
            <p className="eyebrow">Poročila</p>
            <h3 id="new-report-title">Nov osnutek</h3>
          </div>
          <button
            aria-label="Zapri nov osnutek"
            className="icon-button"
            onClick={onClose}
            title="Zapri"
            type="button"
          >
            ×
          </button>
        </header>

        <form className="report-form" onSubmit={handleSubmit}>
          <div className="report-form-grid">
            <label className="field-wide">
              <span>Naslov</span>
              <input
                autoFocus
                maxLength="200"
                name="naslov"
                onChange={updateField}
                required
                value={form.naslov}
              />
            </label>

            <label>
              <span>Kategorija</span>
              <select
                name="kategorija_id"
                onChange={updateField}
                required
                value={form.kategorija_id}
              >
                <option value="">Izberi kategorijo</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.naziv}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Arhivsko leto</span>
              <input
                max={new Date().getFullYear() + 1}
                min="2000"
                name="arhivirno_leto"
                onChange={updateField}
                required
                type="number"
                value={form.arhivirno_leto}
              />
            </label>

            <label className="field-wide">
              <span>Vod</span>
              <select name="vod_id" onChange={updateField} value={form.vod_id}>
                <option value="">Ni vezano na vod</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.ime_voda}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <div className="login-error" role="alert">{error}</div>}

          <div className="login-actions">
            <button className="button secondary" onClick={onClose} type="button">
              Prekliči
            </button>
            <button className="button primary" disabled={loading} type="submit">
              {loading ? 'Ustvarjam ...' : 'Ustvari osnutek'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default NewReportDialog
