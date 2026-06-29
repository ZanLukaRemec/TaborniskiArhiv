import { useEffect, useState } from 'react'
import { createTemplate, getTemplates } from '../api'
import { parseJson } from '../reportUtils'

const FIELD_TYPES = [
  { value: 'text', label: 'Kratko besedilo' },
  { value: 'textarea', label: 'Daljše besedilo' },
  { value: 'number', label: 'Število' },
  { value: 'date', label: 'Datum' },
  { value: 'checkbox', label: 'Potrditev' },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : null
}

function isActive(template) {
  const currentDate = today()
  return dateOnly(template.veljavno_od) <= currentDate
    && (!template.veljavno_do || dateOnly(template.veljavno_do) >= currentDate)
}

function emptyField() {
  return {
    key: `${Date.now()}-${Math.random()}`,
    oznaka: '',
    tip: 'text',
    obvezno: false,
  }
}

function TemplatesPage() {
  const [categories, setCategories] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    kategorija_id: '',
    naziv: '',
    veljavno_od: today(),
    veljavno_do: '',
    polja: [emptyField()],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notification, setNotification] = useState('')

  async function loadTemplates() {
    setLoading(true)

    try {
      setCategories(await getTemplates())
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  function resetForm() {
    setForm({
      kategorija_id: '',
      naziv: '',
      veljavno_od: today(),
      veljavno_do: '',
      polja: [emptyField()],
    })
    setError('')
  }

  function startEditing(categoryId = '') {
    resetForm()
    setForm((current) => ({
      ...current,
      kategorija_id: categoryId ? String(categoryId) : '',
    }))
    setEditing(true)
    setNotification('')
    window.scrollTo(0, 0)
  }

  function closeEditor() {
    resetForm()
    setEditing(false)
  }

  function updateForm(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function updateField(key, property, value) {
    setForm((current) => ({
      ...current,
      polja: current.polja.map((field) => (
        field.key === key ? { ...field, [property]: value } : field
      )),
    }))
  }

  function addField() {
    setForm((current) => ({
      ...current,
      polja: [...current.polja, emptyField()],
    }))
  }

  function removeField(key) {
    setForm((current) => ({
      ...current,
      polja: current.polja.filter((field) => field.key !== key),
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      await createTemplate({
        kategorija_id: Number(form.kategorija_id),
        naziv: form.naziv,
        veljavno_od: form.veljavno_od,
        veljavno_do: form.veljavno_do || null,
        polja: form.polja.map(({ oznaka, tip, obvezno }) => ({
          oznaka,
          tip,
          obvezno,
        })),
      })
      await loadTemplates()
      setEditing(false)
      resetForm()
      setNotification('Nova predloga je aktivirana.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !categories.length) {
    return <div className="empty-state page-state">Nalagam predloge ...</div>
  }

  return (
    <section className="templates-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Administracija</p>
          <h2>Predloge poročil</h2>
          <p>Upravljaj strukturo obrazcev, ki jih uporabniki izpolnijo pri oddaji.</p>
        </div>
        {!editing && (
          <button className="button primary" onClick={() => startEditing()} type="button">
            Nova predloga
          </button>
        )}
      </header>

      {error && <div className="notice" role="alert">{error}</div>}
      {notification && <div className="notice info" role="status">{notification}</div>}

      {editing ? (
        <form className="template-editor" onSubmit={handleSubmit}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Nova različica</p>
              <h2>Sestavi predlogo</h2>
              <p>Interna imena polj bo sistem ustvaril samodejno.</p>
            </div>
          </div>

          <div className="template-basics">
            <label>
              <span>Kategorija</span>
              <select
                name="kategorija_id"
                onChange={updateForm}
                required
                value={form.kategorija_id}
              >
                <option value="">Izberi kategorijo</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.naziv}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Naziv predloge</span>
              <input
                name="naziv"
                onChange={updateForm}
                placeholder="npr. Poročilo funkcije"
                required
                value={form.naziv}
              />
            </label>
            <label>
              <span>Velja od</span>
              <input
                name="veljavno_od"
                onChange={updateForm}
                required
                type="date"
                value={form.veljavno_od}
              />
            </label>
            <label>
              <span>Velja do</span>
              <input
                min={form.veljavno_od}
                name="veljavno_do"
                onChange={updateForm}
                type="date"
                value={form.veljavno_do}
              />
            </label>
          </div>

          <div className="field-editor-heading">
            <div>
              <p className="eyebrow">Polja obrazca</p>
              <h3>Vsebina predloge</h3>
            </div>
            <button
              className="button secondary small"
              disabled={form.polja.length >= 20}
              onClick={addField}
              type="button"
            >
              Dodaj polje
            </button>
          </div>

          <div className="template-fields">
            {form.polja.map((field, index) => (
              <div className="template-field-row" key={field.key}>
                <span className="field-number">{index + 1}</span>
                <label>
                  <span>Oznaka</span>
                  <input
                    onChange={(event) => updateField(field.key, 'oznaka', event.target.value)}
                    placeholder="Naziv polja"
                    required
                    value={field.oznaka}
                  />
                </label>
                <label>
                  <span>Tip</span>
                  <select
                    onChange={(event) => updateField(field.key, 'tip', event.target.value)}
                    value={field.tip}
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </label>
                <label className="required-toggle">
                  <input
                    checked={field.obvezno}
                    onChange={(event) => updateField(field.key, 'obvezno', event.target.checked)}
                    type="checkbox"
                  />
                  <span>Obvezno</span>
                </label>
                <button
                  aria-label={`Odstrani polje ${index + 1}`}
                  className="remove-field"
                  disabled={form.polja.length === 1}
                  onClick={() => removeField(field.key)}
                  title="Odstrani polje"
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="template-note">
            Če kategorija že ima aktivno predlogo, bo njena veljavnost zaključena dan pred
            začetkom nove različice.
          </div>

          <div className="wizard-actions">
            <button className="button ghost" onClick={closeEditor} type="button">
              Prekliči
            </button>
            <button className="button primary" disabled={saving} type="submit">
              {saving ? 'Ustvarjam ...' : 'Aktiviraj predlogo'}
            </button>
          </div>
        </form>
      ) : (
        <div className="template-catalog">
          {categories.map((category) => {
            const activeTemplate = category.predloge.find(isActive)

            return (
              <section className="template-category" key={category.id}>
                <header>
                  <div>
                    <h3>{category.naziv}</h3>
                    <p>{category.opis}</p>
                  </div>
                  <div className="template-category-actions">
                    <span className={`template-state ${activeTemplate ? 'active' : 'missing'}`}>
                      {activeTemplate ? 'Aktivna predloga' : 'Brez aktivne predloge'}
                    </span>
                    <button
                      className="button ghost small"
                      onClick={() => startEditing(category.id)}
                      type="button"
                    >
                      Nova različica
                    </button>
                  </div>
                </header>

                {category.predloge.length ? (
                  <div className="template-version-list">
                    {category.predloge.map((template) => {
                      const structure = parseJson(template.struktura_obrazca)

                      return (
                        <div className="template-version" key={template.id}>
                          <span>
                            <strong>{structure.naziv || 'Neimenovana predloga'}</strong>
                            <small>{structure.polja?.length || 0} polj</small>
                          </span>
                          <span>
                            {dateOnly(template.veljavno_od)}
                            {' – '}
                            {dateOnly(template.veljavno_do) || 'brez konca'}
                          </span>
                          {isActive(template) && <b>Aktivna</b>}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="template-empty">Za to kategorijo še ni pripravljene predloge.</p>
                )}
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default TemplatesPage
