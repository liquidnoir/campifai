'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import {
  MAX_ARTISTS,
  ROLE_LABELS,
  controlStyle,
  removeFolderFiles,
  removeFolderImages,
} from '../../lib/shared'

function Msg({ msg }) {
  if (!msg) return null
  if (msg.type === 'error') return <div className="error-msg">{msg.text}</div>
  return <div style={{ color: '#4B5A3E', fontSize: 14, marginBottom: 12 }}>{msg.text}</div>
}

export default function Account() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [profileMsg, setProfileMsg] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const [confirmText, setConfirmText] = useState('')
  const [deleteMsg, setDeleteMsg] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/login')
        return
      }
      setSession(data.session)
      loadProfile(data.session.user.id)
    })
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setDisplayName(data?.display_name || '')
    setBio(data?.bio || '')
    setLoading(false)
  }

  async function saveProfile(e) {
    e.preventDefault()
    setProfileMsg(null)
    if (!displayName.trim()) {
      setProfileMsg({ type: 'error', text: 'Navn må ikke være tomt.' })
      return
    }
    setSavingProfile(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), bio: bio.trim() || null })
      .eq('id', session.user.id)
    setSavingProfile(false)
    if (error) {
      setProfileMsg({ type: 'error', text: error.message })
      return
    }
    setProfileMsg({ type: 'ok', text: 'Dine ændringer er gemt.' })
  }

  async function savePassword(e) {
    e.preventDefault()
    setPasswordMsg(null)
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Adgangskoden skal være mindst 6 tegn.' })
      return
    }
    if (newPassword !== repeatPassword) {
      setPasswordMsg({ type: 'error', text: 'De to adgangskoder er ikke ens.' })
      return
    }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) {
      setPasswordMsg({ type: 'error', text: error.message })
      return
    }
    setNewPassword('')
    setRepeatPassword('')
    setPasswordMsg({ type: 'ok', text: 'Din adgangskode er ændret.' })
  }

  async function deleteAccount(e) {
    e.preventDefault()
    setDeleteMsg(null)
    if (confirmText.trim().toUpperCase() !== 'SLET') {
      setDeleteMsg({ type: 'error', text: 'Skriv SLET i feltet for at bekræfte.' })
      return
    }
    setDeleting(true)
    try {
      // 1. Slet alle lyd- og billedfiler i din mappe (skal gøres før kontoen kan slettes)
      await removeFolderFiles(supabase, session.user.id)
      await removeFolderImages(supabase, session.user.id)

      // 2. Slet kontoen (profil, kunstnere, udgivelser og numre forsvinder automatisk med)
      const { error: rpcError } = await supabase.rpc('delete_my_account')
      if (rpcError) throw rpcError

      await supabase.auth.signOut({ scope: 'local' })
      router.replace('/login')
    } catch (err) {
      setDeleteMsg({ type: 'error', text: err.message || 'Noget gik galt. Prøv igen.' })
      setDeleting(false)
    }
  }

  if (loading) return <p className="notice">Henter...</p>
  if (!profile) return <p className="notice">Kunne ikke hente din profil. Opdatér siden.</p>

  const roleLabel = ROLE_LABELS[profile.role] || profile.role
  const isPublisher = profile.role === 'publisher'
  const isAdmin = profile.role === 'admin'

  return (
    <section>
      <h2>Min konto</h2>
      <p className="notice" style={{ marginTop: 8 }}>
        {session.user.email} · {roleLabel}
      </p>
      {isPublisher && (
        <p className="notice" style={{ marginTop: 4 }}>
          Som publisher kan du oprette op til {MAX_ARTISTS} kunstnere under Udgivelser.
        </p>
      )}

      <form onSubmit={saveProfile} className="panel" style={{ maxWidth: 520, marginTop: 20 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Profil</h3>
        <div className="field">
          <label htmlFor="name">Navn</label>
          <input
            id="name"
            maxLength={60}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="bio">Om mig</label>
          <textarea
            id="bio"
            maxLength={500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            style={{ ...controlStyle, minHeight: 96, resize: 'vertical' }}
          />
        </div>
        <Msg msg={profileMsg} />
        <button className="btn" type="submit" disabled={savingProfile}>
          {savingProfile ? 'Gemmer...' : 'Gem ændringer'}
        </button>
      </form>

      <form onSubmit={savePassword} className="panel" style={{ maxWidth: 520, marginTop: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Skift adgangskode</h3>
        <div className="field">
          <label htmlFor="newpw">Ny adgangskode</label>
          <input
            id="newpw"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="repeatpw">Gentag ny adgangskode</label>
          <input
            id="repeatpw"
            type="password"
            autoComplete="new-password"
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
          />
        </div>
        <Msg msg={passwordMsg} />
        <button className="btn" type="submit" disabled={savingPassword}>
          {savingPassword ? 'Gemmer...' : 'Skift adgangskode'}
        </button>
      </form>

      {isAdmin ? (
        <div className="panel" style={{ maxWidth: 520, marginTop: 24, marginBottom: 40 }}>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Slet konto</h3>
          <p className="notice">
            Admin-konti kan ikke slettes her. Bed en anden admin om først at fjerne din adminrolle.
          </p>
        </div>
      ) : (
        <form
          onSubmit={deleteAccount}
          className="panel"
          style={{ maxWidth: 520, marginTop: 24, marginBottom: 40, borderColor: '#B8452B' }}
        >
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Slet konto</h3>
          <p className="notice" style={{ marginBottom: 16 }}>
            Din konto og din profil
            {isPublisher ? ', alle dine kunstnere, udgivelser, numre og billeder' : ''} slettes
            permanent. Det kan ikke fortrydes.
          </p>
          <div className="field">
            <label htmlFor="confirm">Skriv SLET for at bekræfte</label>
            <input
              id="confirm"
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>
          <Msg msg={deleteMsg} />
          <button className="btn" type="submit" disabled={deleting}>
            {deleting ? 'Sletter...' : 'Slet min konto'}
          </button>
        </form>
      )}
    </section>
  )
}
