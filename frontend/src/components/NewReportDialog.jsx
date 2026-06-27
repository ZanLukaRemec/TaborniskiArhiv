import { useEffect, useState } from 'react'

function NewReportDialog({ loadOptions, onClose, onCreate }) {
  const [form, setForm] = useState({
    kategorija_id: '',
    arhivirno_leto: new Date().getFullYear(),
    vod_id: '',
    vloga_ids: [],
  })
  const [options, setOptions] = useState({
    kategorije: [],
    vodi: [],
    vloge: [],
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)

  useEffect(() => {
    let active = true

    async function refreshOptions() {
      setLoadingOptions(true)
      setError('')

      try {
        const data = await loadOptions(form.arhivirno_leto)

        if (active) {
          setOptions(data)
          setForm((current) => ({
            ...current,
            kategorija_id: '',
            vod_id: '',
            vloga_ids: [],
          }))
        }
      } catch (loadError) {
        if (active) setError(loadError.message)
      } finally {
        if (active) setLoadingOptions(false)
      }
    }

    refreshOptions()
    return () => {
      active = false
    }
  }, [form.arhivirno_leto, loadOptions])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'kategorija_id' ? { vod_id: '', vloga_ids: [] } : {}),
    }))
  }

  function toggleRole(roleId) {
    setForm((current) => ({
      ...current,
      vloga_ids: current.vloga_ids.includes(roleId)
        ? current.vloga_ids.filter((id) => id !== roleId)
        : [...current.vloga_ids, roleId],
    }))
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

  const selectedCategory = options.kategorije.find(
    (category) => category.id === Number(form.kategorija_id),
  )

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
            <label>
              <span>Arhivsko leto</span>
              <input
                autoFocus
                max={new Date().getFullYear() + 1}
                min="2000"
                name="arhivirno_leto"
                onChange={updateField}
                required
                type="number"
                value={form.arhivirno_leto}
              />
            </label>

            <label>
              <span>Kategorija</span>
              <select
                disabled={loadingOptions}
                name="kategorija_id"
                onChange={updateField}
                required
                value={form.kategorija_id}
              >
                <option value="">
                  {loadingOptions ? 'Nalagam ...' : 'Izberi kategorijo'}
                </option>
                {options.kategorije.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.naziv}
                  </option>
                ))}
              </select>
            </label>

            {selectedCategory?.kontekst === 'vod' && (
              <label className="field-wide">
                <span>Vod</span>
                <select
                  name="vod_id"
                  onChange={updateField}
                  required
                  value={form.vod_id}
                >
                  <option value="">Izberi vod</option>
                  {options.vodi.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.ime_voda}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {selectedCategory?.kontekst === 'vloga' && (
              <fieldset className="role-picker field-wide">
                <legend>Funkcije</legend>
                {options.vloge.map((role) => (
                  <label className="role-option" key={role.id}>
                    <input
                      checked={form.vloga_ids.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                      type="checkbox"
                    />
                    <span>{role.naziv}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </div>

          {error && <div className="login-error" role="alert">{error}</div>}

          <div className="login-actions">
            <button className="button secondary" onClick={onClose} type="button">
              Prekliči
            </button>
            <button
              className="button primary"
              disabled={loading || loadingOptions}
              type="submit"
            >
              {loading ? 'Preverjam ...' : 'Nadaljuj'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default NewReportDialog
