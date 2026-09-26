'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { MAX_ARTISTS, controlStyle, removeFolderFiles, removeFolderImages } from '../../lib/shared'
import { useLanguage } from '../../components/LanguageProvider'

function Msg({ msg }) {
  if (!msg) return null
  if (msg.type === 'error') return <div className="error-msg">{msg.text}</div>
  return <div style={{ color: '#4B5A3E', fontSize: 14, marginBottom: 12 }}>{msg.text}</div>
}

export default function Account() {
  const { t } = useLanguage()
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
      setProfileMsg({ type: 'error', text: t('account.nameEmpty') })
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
    setProfileMsg({ type: 'ok', text: t('account.profileSaved') })
  }

  async function savePassword(e) {
    e.preventDefault()
    setPasswordMsg(null)
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: t('signup.passwordTooShort') })
      return
    }
    if (newPassword !== repeatPassword) {
      setPasswordMsg({ type: 'error', text: t('account.passwordsDontMatch') })
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
    setPasswordMsg({ type: 'ok', text: t('account.passwordChanged') })
  }

  async function deleteAccount(e) {
    e.preventDefault()
    setDeleteMsg(null)
    if (confirmText.trim().toUpperCase() !== t('account.delete.confirmWord')) {
      setDeleteMsg({ type: 'error', text: t('account.delete.typeToConfirm', { word: t('account.delete.confirmWord') }) })
      return
    }
    setDeleting(true)
    try {
      // 1. Slet alle lyd- og billedfiler i din mappe (skal gøres før kontoen kan slettes)
      await removeFolderFiles(supabase, session.user.id, t)
      await removeFolderImages(supabase, session.user.id, t)

      // 2. Slet kontoen (profil, kunstnere, udgivelser og numre forsvinder automatisk med)
      const { error: rpcError } = await supabase.rpc('delete_my_account')
      if (rpcError) throw rpcError

      await supabase.auth.signOut({ scope: 'local' })
      router.replace('/login')
    } catch (err) {
      setDeleteMsg({ type: 'error', text: err.message || t('common.somethingWrong') })
      setDeleting(false)
    }
  }

  if (loading) return <p className="notice">{t('common.loading')}</p>
  if (!profile) return <p className="notice">{t('account.couldNotLoad')}</p>

  const roleLabel = t(`role.${profile.role}`) || profile.role
  const isPublisher = profile.role === 'publisher'
  const isAdmin = profile.role === 'admin'

  return (
    <section>
      <h2>{t('nav.account')}</h2>
      <p className="notice" style={{ marginTop: 8 }}>
        {session.user.email} · {roleLabel}
      </p>
      {isPublisher && (
        <p className="notice" style={{ marginTop: 4 }}>
          {t('account.publisherHint', { max: MAX_ARTISTS })}
        </p>
      )}

      <form onSubmit={saveProfile} className="panel" style={{ maxWidth: 520, marginTop: 20 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>{t('account.profile')}</h3>
        <div className="field">
          <label htmlFor="name">{t('signup.name')}</label>
          <input
            id="name"
            maxLength={60}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="bio">{t('account.aboutMe')}</label>
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
          {savingProfile ? t('common.saving') : t('common.save')}
        </button>
      </form>

      <form onSubmit={savePassword} className="panel" style={{ maxWidth: 520, marginTop: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>{t('account.changePassword')}</h3>
        <div className="field">
          <label htmlFor="newpw">{t('account.newPassword')}</label>
          <input
            id="newpw"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="repeatpw">{t('account.repeatPassword')}</label>
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
          {savingPassword ? t('common.saving') : t('account.changePassword')}
        </button>
      </form>

      {isAdmin ? (
        <div className="panel" style={{ maxWidth: 520, marginTop: 24, marginBottom: 40 }}>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>{t('account.delete.title')}</h3>
          <p className="notice">{t('account.delete.adminBlocked')}</p>
        </div>
      ) : (
        <form
          onSubmit={deleteAccount}
          className="panel"
          style={{ maxWidth: 520, marginTop: 24, marginBottom: 40, borderColor: '#B8452B' }}
        >
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>{t('account.delete.title')}</h3>
          <p className="notice" style={{ marginBottom: 16 }}>
            {isPublisher ? t('account.delete.warningPublisher') : t('account.delete.warning')}
          </p>
          <div className="field">
            <label htmlFor="confirm">{t('account.delete.typeToConfirm', { word: t('account.delete.confirmWord') })}</label>
            <input
              id="confirm"
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>
          <Msg msg={deleteMsg} />
          <button className="btn" type="submit" disabled={deleting}>
            {deleting ? t('account.delete.deleting') : t('account.delete.button')}
          </button>
        </form>
      )}
    </section>
  )
}
