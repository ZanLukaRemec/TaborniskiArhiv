import { useState } from 'react'

function LoginPage({ onLogin }) {
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
    <main className="login-page">
      <section className="login-intro">
        <div className="brand-seal">TA</div>
        <p className="eyebrow">Rod Puntarjev Tolmin</p>
        <h1>Taborniški arhiv</h1>
        <p>Urejena poročila, skupen spomin rodu.</p>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div>
          <p className="eyebrow">Dostop za člane</p>
          <h2 id="login-title">Prijava</h2>
          <p className="muted">Za nadaljevanje se prijavi s svojim računom.</p>
        </div>

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

          {error && <div className="form-error" role="alert">{error}</div>}

          <button className="button primary wide" disabled={loading} type="submit">
            {loading ? 'Prijavljam ...' : 'Prijava'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default LoginPage
