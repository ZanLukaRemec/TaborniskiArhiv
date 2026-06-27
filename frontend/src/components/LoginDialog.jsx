import { useState } from 'react'

function LoginDialog({ onClose, onLogin }) {
  const [prijava, setPrijava] = useState('')
  const [geslo, setGeslo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onLogin({ prijava, geslo })
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="login-title"
        aria-modal="true"
        className="login-dialog"
        role="dialog"
      >
        <header className="login-header">
          <div>
            <p className="eyebrow">Dostop za člane</p>
            <h3 id="login-title">Prijava</h3>
          </div>
          <button
            aria-label="Zapri prijavo"
            className="icon-button"
            onClick={onClose}
            title="Zapri"
            type="button"
          >
            ×
          </button>
        </header>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Uporabniško ime ali e-pošta</span>
            <input
              autoComplete="username"
              autoFocus
              name="prijava"
              onChange={(event) => setPrijava(event.target.value)}
              required
              value={prijava}
            />
          </label>

          <label>
            <span>Geslo</span>
            <input
              autoComplete="current-password"
              name="geslo"
              onChange={(event) => setGeslo(event.target.value)}
              required
              type="password"
              value={geslo}
            />
          </label>

          {error && <div className="login-error" role="alert">{error}</div>}

          <div className="login-actions">
            <button className="button secondary" onClick={onClose} type="button">
              Prekliči
            </button>
            <button className="button primary" disabled={loading} type="submit">
              {loading ? 'Prijavljam ...' : 'Prijava'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default LoginDialog
