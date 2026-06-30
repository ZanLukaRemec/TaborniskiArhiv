import { useEffect, useMemo, useState } from 'react'
import {
  assignUserRole,
  createUser,
  getUsers,
  revokeUserRole,
} from '../api'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value) {
  if (!value) return 'Brez zaključka'

  const [year, month, day] = value.split('-')
  return `${day}. ${month}. ${year}`
}

function assignmentStatus(assignment) {
  const currentDate = today()

  if (assignment.dodeljena_dne > currentDate) return 'future'
  if (assignment.odvzeta_dne && assignment.odvzeta_dne < currentDate) return 'ended'
  return 'active'
}

function emptyUserForm() {
  return {
    ime: '',
    priimek: '',
    uporabnisko_ime: '',
    e_posta: '',
    geslo: '',
    datum_rojstva: '',
    vod_id: '',
  }
}

function UsersPage({ currentUser }) {
  const [data, setData] = useState({ uporabniki: [], vloge: [], vodi: [] })
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [userForm, setUserForm] = useState(emptyUserForm())
  const [roleFormOpen, setRoleFormOpen] = useState(false)
  const [roleForm, setRoleForm] = useState({
    vloga_id: '',
    dodeljena_dne: today(),
    odvzeta_dne: '',
  })
  const [revokeAssignment, setRevokeAssignment] = useState(null)
  const [revokeDate, setRevokeDate] = useState(today())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notification, setNotification] = useState('')

  async function loadData(preferredUserId = selectedUserId) {
    const loaded = await getUsers()
    setData(loaded)

    const nextSelectedId = loaded.uporabniki.some((user) => user.id === preferredUserId)
      ? preferredUserId
      : loaded.uporabniki[0]?.id || null
    setSelectedUserId(nextSelectedId)
    return loaded
  }

  useEffect(() => {
    async function loadInitialData() {
      try {
        await loadData(null)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
  }, [])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('sl-SI')

    if (!query) return data.uporabniki

    return data.uporabniki.filter((user) => (
      `${user.ime} ${user.priimek}`.toLocaleLowerCase('sl-SI').includes(query)
      || user.uporabnisko_ime.toLowerCase().includes(query)
      || user.e_posta.toLowerCase().includes(query)
    ))
  }, [data.uporabniki, search])

  const selectedUser = data.uporabniki.find((user) => user.id === selectedUserId)
  const currentAssignments = selectedUser?.dodelitve.filter(
    (assignment) => assignmentStatus(assignment) === 'active',
  ) || []

  function selectUser(userId) {
    setSelectedUserId(userId)
    setCreating(false)
    setRoleFormOpen(false)
    setRevokeAssignment(null)
    setError('')
    setNotification('')
  }

  function updateUserForm(event) {
    const { name, value } = event.target
    setUserForm((current) => ({ ...current, [name]: value }))
  }

  async function handleCreateUser(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const created = await createUser({
        ...userForm,
        vod_id: userForm.vod_id ? Number(userForm.vod_id) : null,
        datum_rojstva: userForm.datum_rojstva || null,
      })
      await loadData(created.id)
      setUserForm(emptyUserForm())
      setCreating(false)
      setNotification('Uporabniški račun je ustvarjen.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAssignRole(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      await assignUserRole(selectedUser.id, {
        vloga_id: Number(roleForm.vloga_id),
        dodeljena_dne: roleForm.dodeljena_dne,
        odvzeta_dne: roleForm.odvzeta_dne || null,
      })
      await loadData(selectedUser.id)
      setRoleForm({
        vloga_id: '',
        dodeljena_dne: today(),
        odvzeta_dne: '',
      })
      setRoleFormOpen(false)
      setNotification('Vloga je dodeljena.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  function openRevoke(assignment) {
    setRevokeAssignment(assignment)
    setRevokeDate(
      assignment.dodeljena_dne > today() ? assignment.dodeljena_dne : today(),
    )
    setError('')
  }

  async function handleRevoke() {
    setSaving(true)
    setError('')

    try {
      await revokeUserRole(
        selectedUser.id,
        revokeAssignment.id,
        revokeDate,
      )
      await loadData(selectedUser.id)
      setRevokeAssignment(null)
      setNotification('Vloga je zaključena.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="empty-state page-state">Nalagam uporabnike ...</div>
  }

  return (
    <section className="users-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Administracija</p>
          <h2>Uporabniki in vloge</h2>
          <p>Ustvari račune in upravljaj obdobja njihovih odgovornosti.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setUserForm(emptyUserForm())
            setCreating(true)
            setError('')
            setNotification('')
          }}
          type="button"
        >
          Nov uporabnik
        </button>
      </header>

      {error && <div className="notice" role="alert">{error}</div>}
      {notification && <div className="notice info" role="status">{notification}</div>}

      <div className="users-layout">
        <aside className="users-list-panel">
          <label className="user-search">
            <span>Iskanje</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ime, račun ali e-pošta"
              type="search"
              value={search}
            />
          </label>

          <div className="users-list">
            {filteredUsers.map((user) => {
              const activeRoles = user.dodelitve.filter(
                (assignment) => assignmentStatus(assignment) === 'active',
              )

              return (
                <button
                  className={user.id === selectedUserId && !creating ? 'selected' : ''}
                  key={user.id}
                  onClick={() => selectUser(user.id)}
                  type="button"
                >
                  <span className="user-list-avatar">
                    {user.ime[0]}{user.priimek[0]}
                  </span>
                  <span>
                    <strong>{user.ime} {user.priimek}</strong>
                    <small>{activeRoles.map((role) => role.naziv).join(', ') || 'brez aktivne vloge'}</small>
                  </span>
                </button>
              )
            })}
            {!filteredUsers.length && (
              <div className="users-list-empty">Ni zadetkov.</div>
            )}
          </div>
        </aside>

        <div className="user-detail-panel">
          {creating ? (
            <form className="user-create-form" onSubmit={handleCreateUser}>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Nov račun</p>
                  <h2>Dodaj uporabnika</h2>
                </div>
              </div>

              <div className="user-form-grid">
                <label>
                  <span>Ime</span>
                  <input name="ime" onChange={updateUserForm} required value={userForm.ime} />
                </label>
                <label>
                  <span>Priimek</span>
                  <input name="priimek" onChange={updateUserForm} required value={userForm.priimek} />
                </label>
                <label>
                  <span>Uporabniško ime</span>
                  <input
                    autoComplete="off"
                    name="uporabnisko_ime"
                    onChange={updateUserForm}
                    required
                    value={userForm.uporabnisko_ime}
                  />
                </label>
                <label>
                  <span>E-pošta</span>
                  <input
                    name="e_posta"
                    onChange={updateUserForm}
                    required
                    type="email"
                    value={userForm.e_posta}
                  />
                </label>
                <label>
                  <span>Začetno geslo</span>
                  <input
                    autoComplete="new-password"
                    minLength="8"
                    name="geslo"
                    onChange={updateUserForm}
                    required
                    type="password"
                    value={userForm.geslo}
                  />
                </label>
                <label>
                  <span>Datum rojstva</span>
                  <input
                    max={today()}
                    name="datum_rojstva"
                    onChange={updateUserForm}
                    type="date"
                    value={userForm.datum_rojstva}
                  />
                </label>
                <label className="field-wide">
                  <span>Vod</span>
                  <select name="vod_id" onChange={updateUserForm} value={userForm.vod_id}>
                    <option value="">Ni dodeljen vodu</option>
                    {data.vodi.map((group) => (
                      <option key={group.id} value={group.id}>{group.ime_voda}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="wizard-actions">
                <button
                  className="button ghost"
                  onClick={() => {
                    setUserForm(emptyUserForm())
                    setCreating(false)
                  }}
                  type="button"
                >
                  Prekliči
                </button>
                <button className="button primary" disabled={saving} type="submit">
                  {saving ? 'Ustvarjam ...' : 'Ustvari račun'}
                </button>
              </div>
            </form>
          ) : selectedUser ? (
            <>
              <header className="user-detail-header">
                <div className="user-detail-avatar">
                  {selectedUser.ime[0]}{selectedUser.priimek[0]}
                </div>
                <div>
                  <p className="eyebrow">Uporabniški račun</p>
                  <h2>{selectedUser.ime} {selectedUser.priimek}</h2>
                  <p>@{selectedUser.uporabnisko_ime} · {selectedUser.e_posta}</p>
                </div>
              </header>

              <dl className="user-meta">
                <div>
                  <dt>Vod</dt>
                  <dd>{selectedUser.ime_voda || 'Ni dodeljen vodu'}</dd>
                </div>
                <div>
                  <dt>Datum rojstva</dt>
                  <dd>{selectedUser.datum_rojstva ? formatDate(selectedUser.datum_rojstva) : 'Ni podatka'}</dd>
                </div>
              </dl>

              <section className="user-roles-section">
                <div className="field-editor-heading">
                  <div>
                    <p className="eyebrow">Trenutne odgovornosti</p>
                    <h3>Vloge</h3>
                  </div>
                  <button
                    className="button secondary small"
                    onClick={() => {
                      setRoleFormOpen((current) => !current)
                      setRevokeAssignment(null)
                    }}
                    type="button"
                  >
                    Dodeli vlogo
                  </button>
                </div>

                {currentAssignments.length ? (
                  <div className="current-role-chips">
                    {currentAssignments.map((assignment) => (
                      <span key={assignment.id}>{assignment.naziv}</span>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Uporabnik trenutno nima aktivne vloge.</p>
                )}

                {roleFormOpen && (
                  <form className="role-assignment-form" onSubmit={handleAssignRole}>
                    <label>
                      <span>Vloga</span>
                      <select
                        onChange={(event) => setRoleForm((current) => ({
                          ...current,
                          vloga_id: event.target.value,
                        }))}
                        required
                        value={roleForm.vloga_id}
                      >
                        <option value="">Izberi vlogo</option>
                        {data.vloge.map((role) => (
                          <option key={role.id} value={role.id}>{role.naziv}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Velja od</span>
                      <input
                        onChange={(event) => setRoleForm((current) => ({
                          ...current,
                          dodeljena_dne: event.target.value,
                        }))}
                        required
                        type="date"
                        value={roleForm.dodeljena_dne}
                      />
                    </label>
                    <label>
                      <span>Velja do</span>
                      <input
                        min={roleForm.dodeljena_dne}
                        onChange={(event) => setRoleForm((current) => ({
                          ...current,
                          odvzeta_dne: event.target.value,
                        }))}
                        type="date"
                        value={roleForm.odvzeta_dne}
                      />
                    </label>
                    <button className="button primary small" disabled={saving} type="submit">
                      Shrani dodelitev
                    </button>
                  </form>
                )}

                <div className="role-history">
                  {selectedUser.dodelitve.map((assignment) => {
                    const status = assignmentStatus(assignment)
                    const isOwnActiveAdmin = selectedUser.id === currentUser.id
                      && assignment.naziv === 'administrator'
                      && status === 'active'

                    return (
                      <div className="role-history-row" key={assignment.id}>
                        <span>
                          <strong>{assignment.naziv}</strong>
                          <small>
                            {formatDate(assignment.dodeljena_dne)}
                            {' – '}
                            {formatDate(assignment.odvzeta_dne)}
                          </small>
                        </span>
                        <span className={`role-state ${status}`}>
                          {status === 'active' ? 'Aktivna' : status === 'future' ? 'Prihodnja' : 'Končana'}
                        </span>
                        {!assignment.odvzeta_dne && !isOwnActiveAdmin && (
                          <button
                            className="text-button danger-text"
                            onClick={() => openRevoke(assignment)}
                            type="button"
                          >
                            Zaključi
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {!selectedUser.dodelitve.length && (
                    <div className="role-history-empty">
                      Za tega uporabnika še ni zabeleženih vlog.
                    </div>
                  )}
                </div>

                {revokeAssignment && (
                  <div className="role-revoke-confirmation" role="alertdialog" aria-label="Potrdi zaključek vloge">
                    <div>
                      <strong>Zaključi vlogo »{revokeAssignment.naziv}«?</strong>
                      <p>Po izbranem datumu uporabnik te vloge ne bo več imel.</p>
                    </div>
                    <label>
                      <span>Datum zaključka</span>
                      <input
                        min={revokeAssignment.dodeljena_dne}
                        onChange={(event) => setRevokeDate(event.target.value)}
                        type="date"
                        value={revokeDate}
                      />
                    </label>
                    <div>
                      <button
                        className="button ghost small"
                        onClick={() => setRevokeAssignment(null)}
                        type="button"
                      >
                        Prekliči
                      </button>
                      <button
                        className="button danger small"
                        disabled={saving}
                        onClick={handleRevoke}
                        type="button"
                      >
                        Zaključi vlogo
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="empty-state">Izberi uporabnika.</div>
          )}
        </div>
      </div>
    </section>
  )
}

export default UsersPage
