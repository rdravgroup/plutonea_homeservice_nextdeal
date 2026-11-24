import { useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, Check, CircleAlert, Clock3, MessageCircle, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import { endpoints, type MobileVerificationSettings, type MobileVerificationStatus } from './api'
import { useAuth } from './state'

export function ProfileMobileVerification() {
  const { user, refreshUser } = useAuth()
  const [phone, setPhone] = useState(user?.phone || '')
  const [status, setStatus] = useState<MobileVerificationStatus | null>(null)
  const [code, setCode] = useState('')
  const [whatsAppLink, setWhatsAppLink] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadStatus = async () => {
    const current = await endpoints.mobileVerificationStatus()
    setStatus(current)
    if (current.mobileNumber) setPhone(`+${current.mobileNumber}`)
    if (current.isVerified) { setWaiting(false); setCode(''); setWhatsAppLink('') }
    return current
  }
  useEffect(() => {
    if (user?.phone) setPhone(user.phone)
    if (user?.id) void loadStatus().catch(() => undefined)
  }, [user?.id, user?.phone, user?.phoneVerified])
  useEffect(() => {
    if (!waiting) return
    const deadline = Date.now() + 2 * 60 * 1000
    let inFlight = false
    const poll = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const current = await endpoints.mobileVerificationStatus()
        setStatus(current)
        if (current.isVerified) {
          setWaiting(false); setCode(''); setWhatsAppLink('')
          setMessage('WhatsApp verification received. Your mobile number is verified.')
          await refreshUser()
        } else if (current.verificationStatus === 'Expired' || current.verificationStatus === 'Locked' || current.verificationStatus === 'Cancelled') {
          setWaiting(false); setCode(''); setWhatsAppLink('')
          setError(current.verificationStatus === 'Locked' ? 'Too many incorrect codes were sent. Generate a new code and try again.' : 'This verification code expired or was cancelled. Generate a new code to continue.')
        } else if (Date.now() >= deadline) {
          setWaiting(false)
          setMessage('We have not received the WhatsApp message yet. If you already sent it, refresh status; otherwise open WhatsApp and send the code before it expires.')
        }
      } catch (e) { setError((e as Error).message) }
      finally { inFlight = false }
    }
    void poll()
    const timer = window.setInterval(() => void poll(), 3000)
    return () => window.clearInterval(timer)
  }, [waiting])

  const initiate = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = await endpoints.startMobileVerification(phone.trim())
      if (result.isVerified) {
        await loadStatus(); await refreshUser(); setMessage('This mobile number is already verified.'); return
      }
      setPhone(`+${result.mobileNumber}`); setCode(result.verificationCode); setWhatsAppLink(result.whatsappLink)
      setExpiresAt(result.codeExpiresAtUtc); setWaiting(true)
      await refreshUser()
      setMessage('Send the prefilled message from the WhatsApp account using this same mobile number. This code expires shortly.')
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  const checkStatus = async () => {
    setError('')
    try {
      const current = await loadStatus()
      if (current.isVerified) {
        setMessage('WhatsApp verification received. Your mobile number is verified.')
        await refreshUser()
      } else if (current.verificationStatus === 'Expired' || current.verificationStatus === 'Locked' || current.verificationStatus === 'Cancelled') {
        setWaiting(false); setCode(''); setWhatsAppLink('')
        setError(current.verificationStatus === 'Locked' ? 'Too many incorrect codes were sent. Generate a new code and try again.' : 'This verification code expired or was cancelled. Generate a new code to continue.')
      } else if (current.verificationStatus === 'Pending') {
        setWaiting(true)
        setMessage('The code is still active. Send it from WhatsApp, and we will keep checking for the verification message.')
      } else {
        setMessage('No active WhatsApp verification was found. Generate a new code to continue.')
      }
    } catch (e) { setError((e as Error).message) }
  }

  const verified = status?.isVerified || user?.phoneVerified
  const provider = status?.provider || 'Disabled'
  return <section className="panel-card phone-verification-card"><div className="panel-title-row"><div><span className="eyebrow">ACCOUNT SECURITY</span><h2>Mobile number verification</h2><p>Verify the mobile number you use for Partner applications, Next Deal ads, chats and Home Service bookings.</p></div><span className={`status-pill ${verified ? 'status-approved' : 'status-pending'}`}>{verified ? 'Verified' : 'Required'}</span></div>
    {verified ? <div className="phone-verified-state"><BadgeCheck /><strong>+{status?.mobileNumber || phone.replace(/\D/g, '')} is verified</strong><span>You can use Partner, Next Deal and Home Service restricted actions.</span></div> : <form className="phone-verification-form" onSubmit={initiate}>
      <label htmlFor="verify-mobile-number">Mobile number with country code</label>
      <input id="verify-mobile-number" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+919876543210" required maxLength={20} disabled={waiting} />
      <small>Use the same number registered on the WhatsApp account from which you will send the message.</small>
      <p className="phone-method-note"><Smartphone size={16} /> Active verification method: <strong>{provider === 'WhatsApp' ? 'WhatsApp Cloud API' : 'Disabled'}</strong>. Email sign-in remains unchanged.</p>
      {!user?.emailVerified && <p className="phone-method-note"><CircleAlert size={16} /> Verify your sign-in email before continuing.</p>}
      {error && <p className="error-banner" role="alert">{error}</p>}{message && <p className={verified ? 'success-note' : 'phone-method-note'} role="status">{message}</p>}
      {!code ? <button className="button button-dark" disabled={busy || waiting || provider !== 'WhatsApp' || !user?.emailVerified || !user?.fullName || !user?.gender || !user?.currentLocation}>{busy ? 'Preparing verification…' : 'Generate WhatsApp verification code'} <ShieldCheck size={16} /></button> : <div className="verification-followup"><div className="verification-code-display"><span>YOUR ONE-TIME CODE</span><strong>{code}</strong></div><p>Tap below to open WhatsApp and send <b>VERIFY {code}</b> to Plutonea. Send it from the same number shown above.</p><a className="button button-dark" href={whatsAppLink} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> Verify via WhatsApp</a><small><Clock3 size={14} /> Expires {expiresAt ? new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'in 10 minutes'}. The verification status checks automatically for up to 2 minutes.</small></div>}
      {waiting && <p className="verification-poll-state" role="status"><span className="verification-pulse" /><span>Waiting for your incoming WhatsApp message…</span><button type="button" className="text-button" onClick={() => void checkStatus()}><RefreshCw size={14} /> Check now</button></p>}
      {code && !waiting && <button type="button" className="text-button verification-check-again" onClick={() => void checkStatus()}><RefreshCw size={14} /> Check verification status</button>}
    </form>}</section>
}

export function AdminMobileVerificationPanel() {
  const [settings, setSettings] = useState<MobileVerificationSettings | null>(null)
  const [provider, setProvider] = useState<'Disabled' | 'WhatsApp'>('Disabled')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const reload = async () => {
    setError('')
    try { const result = await endpoints.adminMobileVerificationSettings(); setSettings(result); setProvider(result.provider) }
    catch (e) { setError((e as Error).message) }
  }
  useEffect(() => { void reload() }, [])
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try { const result = await endpoints.saveAdminMobileVerificationSettings({ provider }); setSettings(result); setMessage(provider === 'WhatsApp' ? 'WhatsApp Cloud API verification is enabled.' : 'Mobile verification is disabled.'); }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const ready = !!settings?.businessWhatsAppNumber && settings.webhookVerifyTokenConfigured
  return <section className="panel-card dashboard-panel mobile-verification-admin"><div className="panel-title-row"><div><span className="eyebrow">ACCOUNT SECURITY</span><h2>WhatsApp mobile verification</h2><p>Incoming messages verify the sender automatically. Admins configure the method here; they do not review or approve individual users.</p></div><button className="text-button" onClick={() => void reload()}>Refresh</button></div>
    {error && <p className="error-banner" role="alert">{error}</p>}{message && <p className="success-note" role="status">{message}</p>}
    <form className="verification-settings-form" onSubmit={save}>
      <label className="verification-method-card"><span className="verification-method-card-title"><input type="radio" name="verification-provider" checked={provider === 'Disabled'} onChange={() => setProvider('Disabled')} /><span><strong>Disabled</strong><small>Allow restricted actions without mobile verification.</small></span></span></label>
      <label className="verification-method-card"><span className="verification-method-card-title"><input type="radio" name="verification-provider" checked={provider === 'WhatsApp'} onChange={() => setProvider('WhatsApp')} /><span><strong>WhatsApp Cloud API</strong><small>Users send a short code to the Plutonea business number; webhook verifies it automatically.</small></span></span></label>
      <div className="verification-admin-guidance"><strong>Meta webhook configuration</strong>
        <p>Business WhatsApp number: <code>{settings?.businessWhatsAppNumber ? `+${settings.businessWhatsAppNumber}` : 'Not configured'}</code></p>
        <p>Callback path: <code>/api/webhooks/whatsapp</code> on the public HTTPS API domain.</p>
        <p>Code lifetime: <code>{settings?.codeExpiryMinutes ?? 10} minutes</code>. Status token: {settings?.webhookVerifyTokenConfigured ? 'configured' : 'missing'}. App signature secret: {settings?.appSecretConfigured ? 'configured' : 'missing'}.</p>
        <p>Set protected API configuration keys <code>WhatsAppVerification__BusinessWhatsAppNumber</code>, <code>WhatsAppVerification__WebhookVerifyToken</code>, <code>WhatsAppVerification__AppSecret</code>, and optionally <code>WhatsAppVerification__CodeExpiryMinutes</code>. App Secret validation is optional in local development and required in production to validate Meta’s <code>X-Hub-Signature-256</code>.</p>
        <p>This webhook processes inbound verification messages only. It does not send outbound WhatsApp messages or require manual admin approval.</p>
      </div>
      <button className="button button-dark" disabled={busy || (provider === 'WhatsApp' && !ready)}>{busy ? 'Saving…' : 'Save verification setting'} <Check size={15} /></button>
      {provider === 'WhatsApp' && !ready && <p className="verification-setup-state is-missing">Finish API webhook configuration before enabling.</p>}
    </form>
    <div className="verification-followup"><h3>What users do</h3><p>They open WhatsApp and send <code>VERIFY PV123456</code> from their registered number. Meta posts the message to the callback URL; the API verifies the sender, one-time code and expiry, then marks the saved mobile number verified. No admin review step.</p></div>
  </section>
}
