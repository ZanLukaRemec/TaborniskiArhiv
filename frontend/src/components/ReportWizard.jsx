import { useEffect, useMemo, useState } from 'react'
import {
  createReport,
  getReport,
  getReportOptions,
  submitReport,
  updateReport,
} from '../api'
import { formatValue, parseJson } from '../reportUtils'

const STEPS = ['Kategorija', 'Podrobnosti', 'Vsebina', 'Pregled']

function contentFromReport(report) {
  const template = parseJson(report.struktura_obrazca)
  const savedContent = parseJson(report.vsebina_obrazca)
  const fields = Array.isArray(template.polja) ? template.polja : []

  return fields.reduce((values, field) => ({
    ...values,
    [field.ime]: savedContent[field.ime] ?? (field.tip === 'checkbox' ? false : ''),
  }), {})
}

function DynamicFields({ content, fields, onChange }) {
  return (
    <div className="dynamic-fields">
      {fields.map((field) => {
        if (field.tip === 'textarea') {
          return (
            <label key={field.ime}>
              <span>
                {field.oznaka}
                {field.obvezno && <b aria-hidden="true"> *</b>}
              </span>
              <textarea
                aria-required={field.obvezno}
                name={field.ime}
                onChange={onChange}
                rows="5"
                value={content[field.ime] ?? ''}
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
                onChange={onChange}
                type="checkbox"
              />
              <span>{field.oznaka}</span>
            </label>
          )
        }

        return (
          <label key={field.ime}>
            <span>
              {field.oznaka}
              {field.obvezno && <b aria-hidden="true"> *</b>}
            </span>
            <input
              aria-required={field.obvezno}
              name={field.ime}
              onChange={onChange}
              step={field.tip === 'number' ? 'any' : undefined}
              type={['date', 'number'].includes(field.tip) ? field.tip : 'text'}
              value={content[field.ime] ?? ''}
            />
          </label>
        )
      })}
    </div>
  )
}

function ReportWizard({ initialReportId, onCancel, onOpenReport, onSubmitted }) {
  const [step, setStep] = useState(initialReportId ? 3 : 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [options, setOptions] = useState({ kategorije: [], vodi: [], vloge: [] })
  const [categoryId, setCategoryId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [roleIds, setRoleIds] = useState([])
  const [report, setReport] = useState(null)
  const [content, setContent] = useState({})
  const [loading, setLoading] = useState(Boolean(initialReportId))
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState('Shranjeno')
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const selectedCategory = options.kategorije.find(
    (category) => category.id === Number(categoryId),
  )
  const activeTemplate = report
    ? parseJson(report.struktura_obrazca)
    : parseJson(selectedCategory?.struktura_obrazca)
  const fields = Array.isArray(activeTemplate.polja) ? activeTemplate.polja : []
  const reportMetadata = parseJson(report?.vsebina_obrazca)._meta
  const selectedRoles = useMemo(
    () => options.vloge.filter((role) => roleIds.includes(role.id)),
    [options.vloge, roleIds],
  )
  const reviewRoleNames = reportMetadata?.vloge_nazivi
    || selectedRoles.map((role) => role.naziv)

  useEffect(() => {
    if (initialReportId) return undefined

    let active = true

    async function loadOptions() {
      setLoading(true)
      setError('')

      try {
        const data = await getReportOptions(year)

        if (active) {
          setOptions(data)
          setCategoryId('')
          setGroupId('')
          setRoleIds([])
        }
      } catch (loadError) {
        if (active) setError(loadError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadOptions()
    return () => {
      active = false
    }
  }, [initialReportId, year])

  useEffect(() => {
    if (!initialReportId) return undefined

    let active = true

    async function loadDraft() {
      try {
        const draft = await getReport(initialReportId)

        if (draft.status !== 'osnutek') {
          onOpenReport(draft.id, 'Poročilo je že arhivirano in ga ni mogoče urejati.')
          return
        }

        if (active) {
          setReport(draft)
          setYear(draft.arhivirno_leto)
          setCategoryId(String(draft.kategorija_id))
          setContent(contentFromReport(draft))
        }
      } catch (loadError) {
        if (active) setError(loadError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDraft()
    return () => {
      active = false
    }
  }, [initialReportId, onOpenReport])

  useEffect(() => {
    if (!report || !dirty || step !== 3) return undefined

    let active = true
    setSaveState('Neshranjene spremembe')

    const timer = window.setTimeout(async () => {
      setSaving(true)
      setSaveState('Shranjujem ...')

      try {
        await updateReport(report.id, content)

        if (active) {
          setDirty(false)
          setSaveState('Samodejno shranjeno')
        }
      } catch (saveError) {
        if (active) {
          setError(saveError.message)
          setSaveState('Shranjevanje ni uspelo')
        }
      } finally {
        if (active) setSaving(false)
      }
    }, 900)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [content, dirty, report, step])

  function selectCategory(id) {
    setCategoryId(String(id))
    setGroupId('')
    setRoleIds([])
    setError('')
  }

  function toggleRole(roleId) {
    setRoleIds((current) => (
      current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId]
    ))
  }

  function updateContent(event) {
    const { checked, name, type, value } = event.target

    setContent((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
    setDirty(true)
    setError('')
  }

  function canContinueDetails() {
    if (!selectedCategory?.ima_predlogo) return false
    if (selectedCategory.kontekst === 'vod') return Boolean(groupId)
    if (selectedCategory.kontekst === 'vloga') return roleIds.length > 0
    return true
  }

  async function continueToContent() {
    if (!canContinueDetails()) return

    setLoading(true)
    setError('')
    setInfo('')

    try {
      const created = await createReport({
        arhivirno_leto: year,
        kategorija_id: Number(categoryId),
        vod_id: groupId ? Number(groupId) : null,
        vloga_ids: roleIds,
      })
      const draft = await getReport(created.id)

      setReport(draft)
      setContent(contentFromReport(draft))
      setStep(3)
      setInfo('Osnutek je ustvarjen. Med pisanjem se bo samodejno shranjeval.')
    } catch (createError) {
      const existing = createError.data?.porocilo

      if (!existing?.id) {
        setError(createError.message)
        return
      }

      if (existing.status === 'arhivirano') {
        onOpenReport(existing.id, createError.message)
        return
      }

      try {
        const draft = await getReport(existing.id)
        setReport(draft)
        setContent(contentFromReport(draft))
        setStep(3)
        setInfo('Obstoječi osnutek je odprt za nadaljevanje.')
      } catch {
        setError(`${createError.message} Osnutek pripada drugemu uporabniku.`)
      }
    } finally {
      setLoading(false)
    }
  }

  async function saveDraft() {
    if (!report) return false

    setSaving(true)
    setError('')
    setSaveState('Shranjujem ...')

    try {
      await updateReport(report.id, content)
      setDirty(false)
      setSaveState('Shranjeno')
      return true
    } catch (saveError) {
      setError(saveError.message)
      setSaveState('Shranjevanje ni uspelo')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function openReview() {
    if (await saveDraft()) {
      setStep(4)
      window.scrollTo(0, 0)
    }
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')

    try {
      await submitReport(report.id)
      onSubmitted(report.id)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading && initialReportId && !report) {
    return <div className="empty-state page-state">Odpiram osnutek ...</div>
  }

  return (
    <section className="wizard-page">
      <button className="back-button" onClick={onCancel} type="button">← Prekliči in zapri</button>

      <header className="page-heading wizard-heading">
        <div>
          <p className="eyebrow">{report ? 'Urejanje osnutka' : 'Novo poročilo'}</p>
          <h2>{report?.naslov || 'Pripravi novo poročilo'}</h2>
          <p>Sledi korakom od izbire vrste do končne oddaje.</p>
        </div>
      </header>

      <ol className="stepper" aria-label="Koraki poročila">
        {STEPS.map((label, index) => {
          const number = index + 1
          const state = number < step ? 'done' : number === step ? 'active' : ''

          return (
            <li className={state} key={label}>
              <span>{number < step ? '✓' : number}</span>
              <strong>{label}</strong>
            </li>
          )
        })}
      </ol>

      {error && <div className="notice" role="alert">{error}</div>}
      {info && <div className="notice info" role="status">{info}</div>}

      {step === 1 && (
        <section className="wizard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">1. korak</p>
              <h2>Izberi leto in kategorijo</h2>
            </div>
          </div>

          <label className="year-picker">
            <span>Arhivsko leto</span>
            <input
              max={new Date().getFullYear() + 1}
              min="2000"
              onChange={(event) => setYear(Number(event.target.value))}
              type="number"
              value={year}
            />
          </label>

          <div className="category-grid">
            {options.kategorije.map((category) => (
              <button
                className={`category-card ${Number(categoryId) === category.id ? 'selected' : ''}`}
                disabled={!category.ima_predlogo}
                key={category.id}
                onClick={() => selectCategory(category.id)}
                type="button"
              >
                <strong>{category.naziv}</strong>
                <span>{category.opis || 'Standardizirano poročilo rodu.'}</span>
                {!category.ima_predlogo && <small>Aktivna predloga še ni pripravljena</small>}
              </button>
            ))}
          </div>

          <div className="wizard-actions end">
            <button
              className="button primary"
              disabled={!selectedCategory?.ima_predlogo || loading}
              onClick={() => setStep(2)}
              type="button"
            >
              Nadaljuj →
            </button>
          </div>
        </section>
      )}

      {step === 2 && selectedCategory && (
        <section className="wizard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">2. korak</p>
              <h2>Določi podrobnosti</h2>
            </div>
          </div>

          <div className="selection-summary">
            <span>{year}</span>
            <strong>{selectedCategory.naziv}</strong>
          </div>

          {selectedCategory.kontekst === 'vod' && (
            <label className="form-field">
              <span>Vod</span>
              <select onChange={(event) => setGroupId(event.target.value)} value={groupId}>
                <option value="">Izberi vod</option>
                {options.vodi.map((group) => (
                  <option key={group.id} value={group.id}>{group.ime_voda}</option>
                ))}
              </select>
            </label>
          )}

          {selectedCategory.kontekst === 'vloga' && (
            <fieldset className="role-picker">
              <legend>Funkcije, ki jih poročilo pokriva</legend>
              {options.vloge.map((role) => (
                <label className={roleIds.includes(role.id) ? 'selected' : ''} key={role.id}>
                  <input
                    checked={roleIds.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                    type="checkbox"
                  />
                  <span>{role.naziv}</span>
                </label>
              ))}
            </fieldset>
          )}

          {selectedCategory.kontekst === 'osnovno' && (
            <div className="context-note">
              Za to kategorijo dodatna izbira voda ali funkcije ni potrebna.
            </div>
          )}

          <div className="template-preview">
            <p className="eyebrow">Uporabljena predloga</p>
            <h3>{activeTemplate.naziv}</h3>
            <p>{fields.length} polj · {fields.filter((field) => field.obvezno).length} obveznih</p>
          </div>

          <div className="wizard-actions">
            <button className="button ghost" onClick={() => setStep(1)} type="button">
              ← Nazaj
            </button>
            <button
              className="button primary"
              disabled={!canContinueDetails() || loading}
              onClick={continueToContent}
              type="button"
            >
              {loading ? 'Ustvarjam ...' : 'Ustvari osnutek →'}
            </button>
          </div>
        </section>
      )}

      {step === 3 && report && (
        <section className="wizard-section">
          <div className="draft-toolbar">
            <span className={`save-dot ${saving ? 'saving' : ''}`} aria-hidden="true" />
            <span>{saveState}</span>
          </div>

          <div className="section-heading">
            <div>
              <p className="eyebrow">3. korak</p>
              <h2>Izpolni vsebino</h2>
              <p>Polja z zvezdico so obvezna ob končni oddaji.</p>
            </div>
          </div>

          <DynamicFields content={content} fields={fields} onChange={updateContent} />

          <div className="wizard-actions">
            <button className="button ghost" onClick={onCancel} type="button">
              Zapri
            </button>
            <div>
              <button
                className="button secondary"
                disabled={saving}
                onClick={saveDraft}
                type="button"
              >
                Shrani osnutek
              </button>
              <button
                className="button primary"
                disabled={saving}
                onClick={openReview}
                type="button"
              >
                Pregled →
              </button>
            </div>
          </div>
        </section>
      )}

      {step === 4 && report && (
        <section className="wizard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">4. korak</p>
              <h2>Pregled in oddaja</h2>
              <p>Po oddaji poročila vsebine ne bo več mogoče spreminjati.</p>
            </div>
          </div>

          <div className="review-summary">
            <div>
              <span>Kategorija</span>
              <strong>{report.kategorija_naziv}</strong>
            </div>
            <div>
              <span>Arhivsko leto</span>
              <strong>{report.arhivirno_leto}</strong>
            </div>
            {report.ime_voda && (
              <div>
                <span>Vod</span>
                <strong>{report.ime_voda}</strong>
              </div>
            )}
            {reviewRoleNames.length > 0 && (
              <div>
                <span>Funkcije</span>
                <strong>{reviewRoleNames.join(', ')}</strong>
              </div>
            )}
          </div>

          <dl className="review-fields">
            {fields.map((field) => {
              const value = content[field.ime]
              const isEmpty = value === '' || value === null || value === undefined

              return (
                <div className={isEmpty ? 'empty' : ''} key={field.ime}>
                  <dt>{field.oznaka}</dt>
                  <dd>{isEmpty ? 'Ni izpolnjeno' : formatValue(value)}</dd>
                </div>
              )
            })}
          </dl>

          <div className="submission-warning">
            Končna oddaja poročilo premakne v arhiv in zaklene urejanje.
          </div>

          <div className="wizard-actions">
            <button className="button ghost" onClick={() => setStep(3)} type="button">
              ← Nazaj na urejanje
            </button>
            <button
              className="button primary"
              disabled={loading}
              onClick={handleSubmit}
              type="button"
            >
              {loading ? 'Oddajam ...' : 'Oddaj poročilo'}
            </button>
          </div>
        </section>
      )}
    </section>
  )
}

export default ReportWizard
