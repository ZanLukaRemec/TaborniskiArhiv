import { useState } from 'react'
import { changePassword } from '../api'

const EMPTY_FORM = {
  trenutno_geslo: '',
  novo_geslo: '',
  potrditev_gesla: '',
}

function AccountPage({ user }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notification, setNotification] = useState('')

  function updateForm(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotification('')

    if (form.novo_geslo !== form.potrditev_gesla) {
      setError('Novi gesli se ne ujemata.')
      return
    }

    setSaving(true)

    try {
      await changePassword({
        trenutno_geslo: form.trenutno_geslo,
        novo_geslo: form.novo_geslo,
      })
      setForm(EMPTY_FORM)
      setNotification('Geslo je uspešno spremenjeno.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="account-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Osebne nastavitve</p>
          <h2>Moj račun</h2>
          <p>Preglej prijavne podatke in spremeni svoje geslo.</p>
        </div>
      </header>

      <div className="account-layout">
        <section className="account-summary">
          <div className="account-avatar" aria-hidden="true">
            {user.ime[0]}{user.priimek[0]}
          </div>
          <div>
            <p className="eyebrow">Prijavljen uporabnik</p>
            <h3>{user.ime} {user.priimek}</h3>
            <p>@{user.uporabnisko_ime}</p>
            <p>{user.e_posta}</p>
          </div>
        </section>

        <form className="password-form" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Varnost računa</p>
            <h3>Spremeni geslo</h3>
          </div>

          {error && <div className="notice" role="alert">{error}</div>}
          {notification && <div className="notice info" role="status">{notification}</div>}

          <label>
            <span>Trenutno geslo</span>
            <input
              autoComplete="current-password"
              name="trenutno_geslo"
              onChange={updateForm}
              required
              type="password"
              value={form.trenutno_geslo}
            />
          </label>
          <label>
            <span>Novo geslo</span>
            <input
              autoComplete="new-password"
              minLength="8"
              name="novo_geslo"
              onChange={updateForm}
              required
              type="password"
              value={form.novo_geslo}
            />
          </label>
          <label>
            <span>Ponovi novo geslo</span>
            <input
              autoComplete="new-password"
              minLength="8"
              name="potrditev_gesla"
              onChange={updateForm}
              required
              type="password"
              value={form.potrditev_gesla}
            />
          </label>

          <button className="button primary" disabled={saving} type="submit">
            {saving ? 'Spreminjam ...' : 'Spremeni geslo'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default AccountPage
