import { useEffect, useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bell, CalendarDays, ChevronDown, Heart, MapPin, MessageCircle, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { endpoints, type MarketplaceAd, type MarketplaceAdInput } from './api'
import { useAuth, useWishlist } from './state'
import { getDealCategory, nextDealCategories, type DealField } from './nextDealTaxonomy'

const money = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`
const currentCity = () => { try { return JSON.parse(localStorage.getItem('plutonea.city') || localStorage.getItem('haven.city') || 'null') as { id: string; name: string } | null } catch { return null } }

export function normalizeDriveImageUrl(value: string) {
  const input = value.trim()
  try {
    const url = new URL(input)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    if (!/(^|\.)drive\.google\.com$/i.test(url.hostname)) return input
    const pathId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.pathname.match(/\/d\/([^/]+)/)?.[1]
    const id = pathId || url.searchParams.get('id')
    if (!id) return input
    const resourceKey = [...url.searchParams.entries()].find(([key]) => key.toLowerCase() === 'resourcekey')?.[1]
    const keyQuery = resourceKey ? `&resourcekey=${encodeURIComponent(resourceKey)}` : ''
    return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}${keyQuery}`
  } catch { return '' }
}

function getImageCandidates(value: string) {
  const primary = normalizeDriveImageUrl(value)
  if (!primary) return []
  try {
    const url = new URL(primary)
    if (url.hostname.toLowerCase() !== 'drive.google.com') return [primary]
    const id = url.searchParams.get('id')
    if (!id) return [primary]
    const resourceKey = url.searchParams.get('resourcekey')
    const fallback = new URL('https://drive.google.com/thumbnail')
    fallback.searchParams.set('id', id)
    fallback.searchParams.set('sz', 'w1600')
    if (resourceKey) fallback.searchParams.set('resourcekey', resourceKey)
    return [primary, fallback.toString()]
  } catch { return [primary] }
}

function isGenericPlaceholderImage(value: string) {
  try {
    const url = new URL(value)
    return /(^|\.)(placehold\.co|via\.placeholder\.com|dummyimage\.com|placeholder\.com)$/i.test(url.hostname)
      || /(?:^|[/?&=_-])placeholder(?:[/?&=_-]|$)/i.test(`${url.pathname}${url.search}`)
  } catch { return false }
}

export function DriveImage({ src, alt, placeholder = '🛍️', className = '' }: { src?: string | null; alt: string; placeholder?: string; className?: string }) {
  const [attempt, setAttempt] = useState({ src, index: 0, failed: false })
  useEffect(() => setAttempt({ src, index: 0, failed: false }), [src])
  const candidates = src ? getImageCandidates(src) : []
  const index = attempt.src === src ? attempt.index : 0
  const failed = attempt.src === src && attempt.failed
  const url = candidates[index] || ''
  return url && !failed && !isGenericPlaceholderImage(url)
    ? <img className={className} src={url} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setAttempt(current => current.src !== src ? { src, index: 0, failed: false } : current.index + 1 < candidates.length ? { ...current, index: current.index + 1 } : { ...current, failed: true })} />
    : <span className={`${className} nextdeal-image-placeholder`} role="img" aria-label={alt}>{placeholder}</span>
}

type DrivePickerDoc = { id: string; name?: string; url?: string; resourceKey?: string }
type GoogleApi = { load: (name: string, options: { callback: () => void }) => void }
type GooglePickerApi = {
  Action: { PICKED: string; CANCEL: string }
  ViewId: { DOCS_IMAGES: string }
  Feature: { MULTISELECT_ENABLED: string }
  PickerBuilder: new () => {
    addView: (view: string) => GooglePickerBuilder
    enableFeature: (feature: string) => GooglePickerBuilder
    setOAuthToken: (token: string) => GooglePickerBuilder
    setDeveloperKey: (key: string) => GooglePickerBuilder
    setAppId: (id: string) => GooglePickerBuilder
    setCallback: (callback: (data: { action: string; docs?: DrivePickerDoc[] }) => void) => GooglePickerBuilder
    build: () => { setVisible: (visible: boolean) => void }
  }
}
type GooglePickerBuilder = {
  addView: (view: string) => GooglePickerBuilder
  enableFeature: (feature: string) => GooglePickerBuilder
  setOAuthToken: (token: string) => GooglePickerBuilder
  setDeveloperKey: (key: string) => GooglePickerBuilder
  setAppId: (id: string) => GooglePickerBuilder
  setCallback: (callback: (data: { action: string; docs?: DrivePickerDoc[] }) => void) => GooglePickerBuilder
  build: () => { setVisible: (visible: boolean) => void }
}
type GoogleIdentityApi = { oauth2: { initTokenClient: (options: { client_id: string; scope: string; callback: (response: { access_token?: string; error?: string }) => void }) => { requestAccessToken: (options?: { prompt?: string }) => void } } }
declare global { interface Window { gapi?: GoogleApi; google?: { picker?: GooglePickerApi; accounts?: GoogleIdentityApi } } }

function loadGoogleScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing?.dataset.loaded === 'true') { resolve(); return }
    const script = existing || document.createElement('script')
    const fail = () => reject(new Error('Google Drive picker could not load. Check your network and try again.'))
    script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve() }, { once: true })
    script.addEventListener('error', fail, { once: true })
    if (!existing) { script.src = src; script.async = true; script.defer = true; document.head.appendChild(script) }
  })
}

export function PhotoLinksInput({ values, onChange, idPrefix = 'ad-photo' }: { values: string[]; onChange: (values: string[]) => void; idPrefix?: string }) {
  const [pickerError, setPickerError] = useState('')
  const [pickerBusy, setPickerBusy] = useState(false)
  const update = (index: number, value: string) => onChange(values.map((item, i) => i === index ? value : item))
  const remove = (index: number) => onChange(values.length > 1 ? values.filter((_, i) => i !== index) : [''])
  const previews = values.map(normalizeDriveImageUrl).filter(Boolean)
  const openDrivePicker = async (targetIndex: number) => {
    const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined
    const apiKey = import.meta.env.VITE_GOOGLE_PICKER_API_KEY as string | undefined
    // Google OAuth web client IDs begin with their Cloud project number, which
    // Google Picker uses as its App ID. Allow an explicit override if needed.
    const appId = (import.meta.env.VITE_GOOGLE_PICKER_APP_ID as string | undefined) || clientId?.split('-')[0]
    if (!clientId || !apiKey || !appId) { setPickerError('Google Drive Picker needs VITE_GOOGLE_PICKER_API_KEY. Create a key in the same Google Cloud project, enable Google Picker API, then add the key to .env.local and restart Vite.'); return }
    setPickerBusy(true); setPickerError('')
    try {
      await Promise.all([loadGoogleScript('https://accounts.google.com/gsi/client'), loadGoogleScript('https://apis.google.com/js/api.js')])
      if (!window.google?.accounts || !window.gapi) throw new Error('Google Drive picker did not initialize. Reload and try again.')
      await new Promise<void>((resolve, reject) => window.gapi!.load('picker', { callback: () => window.google?.picker ? resolve() : reject(new Error('Google Drive picker could not initialize.')) }))
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: response => {
          if (!response.access_token) { setPickerError(response.error || 'Google Drive access was not granted.'); setPickerBusy(false); return }
          const pickerApi = window.google?.picker
          if (!pickerApi) { setPickerError('Google Drive picker could not initialize.'); setPickerBusy(false); return }
          const picker = new pickerApi.PickerBuilder()
            .addView(pickerApi.ViewId.DOCS_IMAGES)
            .enableFeature(pickerApi.Feature.MULTISELECT_ENABLED)
            .setOAuthToken(response.access_token!)
            .setDeveloperKey(apiKey)
            .setAppId(appId)
            .setCallback(data => {
              if (data.action === pickerApi.Action.PICKED && data.docs?.length) {
                const selected = data.docs.map(doc => {
                  const fileUrl = new URL(doc.url || `https://drive.google.com/file/d/${encodeURIComponent(doc.id)}/view`)
                  if (doc.resourceKey) fileUrl.searchParams.set('resourcekey', doc.resourceKey)
                  return fileUrl.toString()
                })
                const next = [...values]
                next[targetIndex] = selected[0]
                next.splice(targetIndex + 1, 0, ...selected.slice(1))
                onChange(next.slice(0, 20))
              }
              setPickerBusy(false)
            })
            .build()
          picker.setVisible(true)
        },
      })
      tokenClient.requestAccessToken({ prompt: '' })
    } catch (error) { setPickerError((error as Error).message); setPickerBusy(false) }
  }
  return <div className="nextdeal-photo-link-editor">
    {values.map((value, index) => <div className="nextdeal-photo-link-row" key={`${idPrefix}-${index}`}>
      <label htmlFor={`${idPrefix}-${index}`}>Photo link {index + 1}<input id={`${idPrefix}-${index}`} type="url" value={value} onChange={event => update(index, event.target.value)} placeholder="Paste a Google Drive share link or direct image URL" /></label>
      <button type="button" className="button button-outline nextdeal-drive-browse" onClick={() => void openDrivePicker(index)} disabled={pickerBusy} aria-label={`Browse Google Drive for photo ${index + 1}`}>{pickerBusy ? 'Opening…' : 'Browse Drive'}</button>
      {values.length > 1 && <button type="button" className="button button-outline nextdeal-photo-remove" onClick={() => remove(index)} aria-label={`Remove photo link ${index + 1}`}><X size={15} /> Remove</button>}
    </div>)}
    <button type="button" className="button button-outline nextdeal-photo-add" onClick={() => onChange([...values, ''])} disabled={values.length >= 20}><Plus size={15} /> Add another photo link <span>{values.filter(value => value.trim()).length}/20</span></button>
    <small className="nextdeal-drive-note">Use <strong>Browse Drive</strong> to select images from Google Drive, or paste a direct image URL. Selected Drive files must be shared as <strong>Anyone with the link · Viewer</strong> so other users can view them.</small>
    {pickerError && <small className="nextdeal-picker-error" role="alert">{pickerError}</small>}
    {previews.length > 0 && <div className="nextdeal-image-preview">{previews.slice(0, 8).map((src, index) => <DriveImage key={`${src}-${index}`} src={src} alt={`Photo preview ${index + 1}`} placeholder="📷" />)}</div>}
  </div>
}

export function DriveGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState<number | null>(null)
  const goodImages = images.map(normalizeDriveImageUrl).filter(Boolean)
  useEffect(() => {
    if (active === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(null)
      if (event.key === 'ArrowRight') setActive(index => index === null ? null : (index + 1) % goodImages.length)
      if (event.key === 'ArrowLeft') setActive(index => index === null ? null : (index + goodImages.length - 1) % goodImages.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, goodImages.length])
  if (!goodImages.length) return <div className="nextdeal-gallery-empty"><span>📦</span><small>No photos added</small></div>
  return <>
    <div className="nextdeal-gallery-grid">{goodImages.map((src, index) => <button type="button" key={`${src}-${index}`} onClick={() => setActive(index)} aria-label={`View photo ${index + 1} of ${goodImages.length}`}><DriveImage src={src} alt={`${title}, photo ${index + 1}`} placeholder="📷" /></button>)}</div>
    {active !== null && <div className="nextdeal-lightbox" role="dialog" aria-modal="true" aria-label={`${title} photos`} onMouseDown={event => event.target === event.currentTarget && setActive(null)}>
      <button className="nextdeal-lightbox-close" onClick={() => setActive(null)} aria-label="Close photo viewer"><X /></button>
      {goodImages.length > 1 && <button className="nextdeal-lightbox-prev" onClick={() => setActive((active + goodImages.length - 1) % goodImages.length)} aria-label="Previous photo">‹</button>}
      <DriveImage className="nextdeal-lightbox-image" src={goodImages[active]} alt={`${title}, photo ${active + 1}`} placeholder="📷" />
      {goodImages.length > 1 && <button className="nextdeal-lightbox-next" onClick={() => setActive((active + 1) % goodImages.length)} aria-label="Next photo">›</button>}
      <span className="nextdeal-lightbox-count">{active + 1} / {goodImages.length}</span>
    </div>}
  </>
}

function DealCard({ ad }: { ad: MarketplaceAd }) {
  const { user } = useAuth(); const wishlist = useWishlist(); const navigate = useNavigate()
  const category = getDealCategory(ad.categorySlug)
  const extra = Object.entries(ad.attributes || {}).filter(([key, value]) => value && !['seedKey'].includes(key)).slice(0, 2).map(([, value]) => value)
  const metadata = ad.kind === 'Car'
    ? [ad.year, ad.kilometres ? `${ad.kilometres.toLocaleString('en-IN')} km` : '', ad.fuel].filter(Boolean).join(' · ')
    : extra.join(' · ')
  const [favoriteError, setFavoriteError] = useState('')
  const save = async (event: MouseEvent<HTMLButtonElement>) => { event.preventDefault(); event.stopPropagation(); if (!user) { navigate(`/login?return=${encodeURIComponent('/wishlist')}`); return }; setFavoriteError(''); try { await wishlist.toggle(ad.id) } catch (error) { setFavoriteError((error as Error).message) } }
  const saved = wishlist.isSaved(ad.id)
  return <article className="nextdeal-card-wrap"><Link className="marketplace-card nextdeal-card" to={`/marketplace/${ad.id}`}>
    <div className="marketplace-photo nextdeal-card-photo"><DriveImage className="nextdeal-card-ad-image" src={ad.images?.[0]} alt={ad.title} placeholder={category?.icon || '🛍️'} /></div>
    <div className="marketplace-card-body"><small className="nextdeal-card-category-text">{category?.label || 'Next Deal'}</small><strong>{ad.title}</strong><div className="marketplace-price">{ad.price > 0 ? money(ad.price) : 'Contact for price'}</div>
      {metadata && <p className="nextdeal-card-meta">{metadata}</p>}
      {ad.subcategorySlug && <small className="nextdeal-card-subcategory">{ad.subcategorySlug.replace(/-/g, ' ')}</small>}
      <small className="nextdeal-card-location"><MapPin size={13} /> {ad.locationText}, {ad.cityName}</small>
    </div>
  </Link><button type="button" className={`nextdeal-favorite-toggle ${saved ? 'is-saved' : ''}`} aria-label={saved ? `Remove ${ad.title} from wishlist` : `Save ${ad.title} to wishlist`} aria-pressed={saved} onClick={event => void save(event)}><Heart size={18} fill={saved ? 'currentColor' : 'none'} /></button>{favoriteError && <span className="nextdeal-favorite-error" role="alert">{favoriteError}</span>}</article>
}

export function MarketplaceFavoritesPage() {
  const wishlist = useWishlist()
  return <div className="page-container marketplace-page nextdeal-page"><div className="nextdeal-page-heading"><div><span className="eyebrow">YOUR NEXT DEAL SHORTLIST</span><h1>Wishlist</h1><p>Listings you’ve saved for later. Save an ad with the heart icon while browsing.</p></div><Link className="button button-outline" to="/classifieds">Browse Next Deal</Link></div>{wishlist.ads.length ? <div className="marketplace-grid nextdeal-listing-grid">{wishlist.ads.map(ad => <DealCard key={ad.id} ad={ad} />)}</div> : <div className="empty-state"><Heart size={30} /><h3>Your wishlist is empty</h3><p>Tap the heart on a listing to keep it here. Your saved ads are synced to your Plutonea account.</p><Link className="button button-dark" to="/classifieds">Explore listings <ArrowRight size={16} /></Link></div>}</div>
}

export function MarketplaceNotificationsPage() {
  const [conversations, setConversations] = useState<Awaited<ReturnType<typeof endpoints.marketplaceConversations>>>([])
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof endpoints.sellerTestDrives>>>([])
  const [error, setError] = useState('')
  useEffect(() => { let alive = true; Promise.all([endpoints.marketplaceConversations(), endpoints.sellerTestDrives()]).then(([chats, drives]) => { if (alive) { setConversations(chats); setRequests(drives) } }).catch(reason => { if (alive) setError((reason as Error).message) }); return () => { alive = false } }, [])
  const unreadChats = conversations.filter(item => item.unreadCount > 0)
  const pendingDrives = requests.filter(item => item.status === 'Pending')
  return <div className="page-container nextdeal-notifications"><div className="nextdeal-page-heading"><div><span className="eyebrow">NEXT DEAL ACTIVITY</span><h1>Notifications</h1><p>New seller messages and test-drive requests that need your attention.</p></div><Link className="button button-outline" to="/chats"><MessageCircle size={16} /> Open chats</Link></div>{error && <div className="error-banner" role="alert">{error}</div>}<section className="panel-card nextdeal-notification-section"><div className="panel-title-row"><div><span className="eyebrow">MESSAGES</span><h2>Unread chats <b>{unreadChats.reduce((sum, chat) => sum + chat.unreadCount, 0)}</b></h2></div></div>{unreadChats.length ? unreadChats.map(chat => <Link className="nextdeal-notification-row" to={`/chats/${chat.id}`} key={chat.id}><span className="nextdeal-notification-icon"><MessageCircle size={18} /></span><span><strong>New message from {chat.otherUserName}</strong><small>{chat.adTitle} · {chat.lastMessage}</small></span><ArrowRight size={17} /></Link>) : <p className="muted">You’re all caught up on messages.</p>}</section><section className="panel-card nextdeal-notification-section"><div className="panel-title-row"><div><span className="eyebrow">CAR TEST DRIVES</span><h2>Requests to review <b>{pendingDrives.length}</b></h2></div></div>{pendingDrives.length ? pendingDrives.map(request => <Link className="nextdeal-notification-row" to="/my-listings" key={request.id}><span className="nextdeal-notification-icon"><CalendarDays size={18} /></span><span><strong>Test-drive request · {request.adTitle}</strong><small>{request.buyerName} · {request.requestedAt ? new Date(request.requestedAt).toLocaleString('en-IN') : 'New request'}</small></span><ArrowRight size={17} /></Link>) : <p className="muted">No pending test-drive requests.</p>}</section><p className="nextdeal-notification-footnote"><Bell size={15} /> Counts update when you open the page and periodically while you browse Next Deal.</p></div>
}

function fieldValue(ad: MarketplaceAd, key: string): string {
  const base: Record<string, unknown> = { make: ad.make, model: ad.model, year: ad.year, kilometres: ad.kilometres, fuel: ad.fuel, transmission: ad.transmission }
  const value = base[key] ?? ad.attributes?.[key]
  return value === null || value === undefined ? '' : String(value)
}

function FieldControl({ field, value, onChange }: { field: DealField; value: string; onChange: (value: string) => void }) {
  if (field.type === 'select') return <label className="nextdeal-field">{field.label}<select value={value} onChange={event => onChange(event.target.value)}><option value="">Any</option>{field.options?.map(option => <option key={option}>{option}</option>)}</select></label>
  if (field.type === 'number') {
    const [minimum = '', maximum = ''] = value.split('|')
    return <fieldset className="nextdeal-field-range"><legend>{field.label}</legend><label><span>Min</span><input type="number" min="0" value={minimum} onChange={event => onChange(`${event.target.value}|${maximum}`)} placeholder="Any" /></label><label><span>Max</span><input type="number" min="0" value={maximum} onChange={event => onChange(`${minimum}|${event.target.value}`)} placeholder="Any" /></label></fieldset>
  }
  return <label className="nextdeal-field">{field.label}<input type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={field.placeholder || `Any ${field.label.toLowerCase()}`} /></label>
}

const selectedValues = (value: string) => { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as string[] : [] } catch { return [] } }
const saveSelectedValues = (values: string[]) => JSON.stringify(values)

function DualRange({ label, low, high, floor, ceiling, prefix = '', suffix = '', onChange }: {
  label: string; low: string; high: string; floor: number; ceiling: number; prefix?: string; suffix?: string
  onChange: (low: string, high: string) => void
}) {
  const safeCeiling = Math.max(floor + 1, ceiling)
  const currentLow = low ? Math.max(floor, Math.min(safeCeiling, Number(low))) : floor
  const currentHigh = high ? Math.max(floor, Math.min(safeCeiling, Number(high))) : safeCeiling
  const updateLow = (raw: string) => onChange(raw, high && Number(raw) > Number(high) ? raw : high)
  const updateHigh = (raw: string) => onChange(low && Number(raw) < Number(low) ? raw : low, raw)
  return <div className="nextdeal-dual-range"><div className="nextdeal-range-values"><strong>{low ? `${prefix}${Number(low).toLocaleString('en-IN')}${suffix}` : `${prefix}${floor.toLocaleString('en-IN')}${suffix}`}</strong><strong>{high ? `${prefix}${Number(high).toLocaleString('en-IN')}${suffix}` : `${prefix}${safeCeiling.toLocaleString('en-IN')}${suffix}`}</strong></div>
    <div className="nextdeal-range-sliders"><input aria-label={`${label} minimum slider`} type="range" min={floor} max={safeCeiling} value={currentLow} onChange={event => updateLow(event.target.value)} /><input aria-label={`${label} maximum slider`} type="range" min={floor} max={safeCeiling} value={currentHigh} onChange={event => updateHigh(event.target.value)} /></div>
    <div className="nextdeal-range-inputs"><label><span>Minimum</span><input aria-label={`${label} minimum`} type="number" min={floor} max={safeCeiling} value={low} placeholder="Any" onChange={event => updateLow(event.target.value)} /></label><label><span>Maximum</span><input aria-label={`${label} maximum`} type="number" min={floor} max={safeCeiling} value={high} placeholder="Any" onChange={event => updateHigh(event.target.value)} /></label></div>
  </div>
}

function FilterGroup({ title, children, initiallyOpen = false }: { title: string; children: ReactNode; initiallyOpen?: boolean }) {
  return <details className="nextdeal-filter-group" open={initiallyOpen}><summary>{title}<ChevronDown size={17} /></summary><div className="nextdeal-filter-group-body">{children}</div></details>
}

function CarFilterPanel({ ads, filters, setFilter, minPrice, maxPrice, setPriceRange }: { ads: MarketplaceAd[]; filters: Record<string, string>; setFilter: (key: string, value: string) => void; minPrice: string; maxPrice: string; setPriceRange: (low: string, high: string) => void }) {
  const [makeSearch, setMakeSearch] = useState('')
  const [rtoSearch, setRtoSearch] = useState('')
  const makes = useMemo(() => [...new Set(ads.map(ad => ad.make?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)), [ads])
  const selectedMakes = selectedValues(filters.make || '')
  const selectedModels = selectedValues(filters.model || '')
  const makeCounts = (make: string) => ads.filter(ad => ad.make?.toLowerCase() === make.toLowerCase()).length
  const visibleMakes = makes.filter(make => make.toLowerCase().includes(makeSearch.toLowerCase()) || ads.some(ad => ad.make?.toLowerCase() === make.toLowerCase() && ad.model?.toLowerCase().includes(makeSearch.toLowerCase())))
  const modelAds = ads.filter(ad => !selectedMakes.length || selectedMakes.some(make => make.toLowerCase() === (ad.make || '').toLowerCase()))
  const models = [...new Set(modelAds.map(ad => ad.model?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b))
  const toggle = (key: string, value: string) => {
    const current = selectedValues(filters[key] || '')
    setFilter(key, saveSelectedValues(current.includes(value) ? current.filter(item => item !== value) : [...current, value]))
  }
  const minCarPrice = Math.min(...ads.map(ad => ad.price), 0)
  const maxCarPrice = Math.max(...ads.map(ad => ad.price), 20000000)
  const years = ads.map(ad => ad.year).filter((value): value is number => Boolean(value))
  const kms = ads.map(ad => ad.kilometres).filter((value): value is number => value != null)
  const rtos = [...new Set(ads.map(ad => ad.attributes?.rtoState).filter((value): value is string => Boolean(value)))].sort()
  const setRange = (key: string, minimum: string, maximum: string) => setFilter(key, `${minimum}|${maximum}`)
  const budgetLow = minPrice
  const budgetHigh = maxPrice
  const [yearLow = '', yearHigh = ''] = (filters.year || '|').split('|')
  const [kmLow = '', kmHigh = ''] = (filters.kilometres || '|').split('|')
  const checkOptions = (key: string, options: string[], countFor: (option: string) => number, title: string) => <FilterGroup title={title}>
    <div className="nextdeal-check-options">{options.map(option => <label className="nextdeal-filter-check" key={option}><input type="checkbox" checked={selectedValues(filters[key] || '').includes(option)} onChange={() => toggle(key, option)} /><span>{option}</span><small>{countFor(option)}</small></label>)}</div>
  </FilterGroup>
  return <div className="nextdeal-car-filters">
    <FilterGroup title="Budget" initiallyOpen>
      <DualRange label="Budget" low={budgetLow} high={budgetHigh} floor={Math.max(0, minCarPrice)} ceiling={Math.max(maxCarPrice, Math.max(0, minCarPrice) + 1)} prefix="₹" onChange={setPriceRange} />
    </FilterGroup>
    <FilterGroup title="Make & Model" initiallyOpen>
      <label className="nextdeal-filter-search"><Search size={16} /><input type="search" value={makeSearch} onChange={event => setMakeSearch(event.target.value)} placeholder="Search a brand or model" /></label>
      {ads.length > 0 && <><small className="nextdeal-filter-hint">Popular models</small><div className="nextdeal-model-chips">{[...new Set(ads.map(ad => ad.model).filter((value): value is string => Boolean(value)))].filter(model => !makeSearch || model.toLowerCase().includes(makeSearch.toLowerCase())).slice(0, 6).map(model => <button type="button" className={selectedModels.includes(model) ? 'selected' : ''} key={model} onClick={() => toggle('model', model)}>{model}</button>)}</div></>}
      <div className="nextdeal-make-list">{visibleMakes.map(make => {
        const expanded = selectedMakes.includes(make) || make.toLowerCase().includes(makeSearch.toLowerCase()) && makeSearch.length > 0
        const makeModels = [...new Set(ads.filter(ad => ad.make?.toLowerCase() === make.toLowerCase()).map(ad => ad.model).filter((value): value is string => Boolean(value)))].sort()
        return <details key={make} className="nextdeal-make-item" open={expanded}><summary><label onClick={event => event.stopPropagation()}><input type="checkbox" checked={selectedMakes.includes(make)} onChange={() => toggle('make', make)} /><span>{make}</span><small>({makeCounts(make)})</small></label><ChevronDown size={15} /></summary><div>{makeModels.map(model => <label className="nextdeal-filter-check nextdeal-model-option" key={model}><input type="checkbox" checked={selectedModels.includes(model)} onChange={() => toggle('model', model)} /><span>{model}</span><small>({ads.filter(ad => ad.make?.toLowerCase() === make.toLowerCase() && ad.model === model).length})</small></label>)}</div></details>
      })}{!visibleMakes.length && <p className="muted">No matching make in current listings.</p>}</div>
      {models.length > 0 && <div className="nextdeal-selected-model-hint">Choose a make to narrow its models, or search above.</div>}
    </FilterGroup>
    <FilterGroup title="Seller Type"><div className="nextdeal-radio-options">{[['Individual seller', 'Individual'], ['Dealer', 'Dealer']].map(([label, value]) => <label className="nextdeal-filter-check" key={value}><input type="radio" name="sellerType" checked={(filters.sellerType || '') === value} onChange={() => setFilter('sellerType', value)} /><span>{label}</span><small>({ads.filter(ad => ad.attributes?.sellerType === value).length})</small></label>)}<button type="button" className="nextdeal-filter-reset-inline" onClick={() => setFilter('sellerType', '')}>Any seller</button></div></FilterGroup>
    <FilterGroup title="Model Year"><DualRange label="Model year" low={yearLow} high={yearHigh} floor={years.length ? Math.min(...years) : 2000} ceiling={years.length ? Math.max(...years) : new Date().getFullYear()} onChange={(low, high) => setRange('year', low, high)} /></FilterGroup>
    <FilterGroup title="Kms Driven"><DualRange label="Kilometres driven" low={kmLow} high={kmHigh} floor={0} ceiling={Math.max(100000, ...kms)} suffix=" km" onChange={(low, high) => setRange('kilometres', low, high)} /></FilterGroup>
    {checkOptions('fuel', ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'], option => ads.filter(ad => ad.fuel?.toLowerCase() === option.toLowerCase()).length, 'Fuel')}
    {checkOptions('bodyType', ['SUV', 'Hatchback', 'Sedan', 'MUV', 'Coupe', 'Pickup', 'Van'], option => ads.filter(ad => ad.attributes?.bodyType?.toLowerCase() === option.toLowerCase()).length, 'Body Type')}
    {checkOptions('transmission', ['Manual', 'Automatic'], option => ads.filter(ad => ad.transmission?.toLowerCase() === option.toLowerCase()).length, 'Transmission')}
    <FilterGroup title="Color"><div className="nextdeal-tile-options">{['White', 'Silver', 'Black', 'Grey', 'Red', 'Blue', 'Brown', 'Green', 'Other'].map(color => <button type="button" key={color} className={selectedValues(filters.color || '').includes(color) ? 'selected' : ''} onClick={() => toggle('color', color)}><i style={{ background: color.toLowerCase() }} /><strong>{color}</strong><small>{ads.filter(ad => ad.attributes?.color?.toLowerCase() === color.toLowerCase()).length}</small></button>)}</div></FilterGroup>
    {checkOptions('features', ['Infotainment System', 'Rear AC', 'Sunroof', 'Leather Upholstery', 'Alloy Wheels', 'ABS', 'EBD', 'Traction Control', 'Reverse Camera', 'Airbags'], option => ads.filter(ad => (ad.attributes?.features || '').toLowerCase().includes(option.toLowerCase())).length, 'Features')}
    {checkOptions('seats', ['4', '5', '6', '7', '8', '9+'], option => ads.filter(ad => ad.attributes?.seats === option).length, 'Seats')}
    {checkOptions('owners', ['First owner', 'Second owner', 'Third owner', 'Fourth owner', 'More than four'], option => ads.filter(ad => ad.attributes?.owners === option).length, 'Owners')}
    <FilterGroup title="RTO"><label className="nextdeal-filter-search"><Search size={16} /><input type="search" value={rtoSearch} onChange={event => setRtoSearch(event.target.value)} placeholder="Search for a RTO / state" /></label><div className="nextdeal-check-options">{rtos.filter(rto => rto.toLowerCase().includes(rtoSearch.toLowerCase())).map(rto => <label className="nextdeal-filter-check" key={rto}><input type="checkbox" checked={selectedValues(filters.rtoState || '').includes(rto)} onChange={() => toggle('rtoState', rto)} /><span>{rto}</span><small>({ads.filter(ad => ad.attributes?.rtoState === rto).length})</small></label>)}</div><small className="nextdeal-filter-hint">RTO values appear as sellers add them to listings.</small></FilterGroup>
    <FilterGroup title="Safety"><div className="nextdeal-safety-filter"><strong>NCAP Ratings</strong><div className="nextdeal-rating-options">{['5 star', '4 star', '3 star', '2 star', '1 star', 'Not rated'].map(rating => <button type="button" className={selectedValues(filters.ncapRating || '').includes(rating) ? 'selected' : ''} key={rating} onClick={() => toggle('ncapRating', rating)}>{rating === 'Not rated' ? rating : `${rating} ★`} <small>({ads.filter(ad => ad.attributes?.ncapRating === rating).length})</small></button>)}</div><strong>Airbags</strong><div className="nextdeal-rating-options">{['1', '2', '3', '4', '5', '6', '7', '8+'].map(value => <button type="button" className={selectedValues(filters.airbags || '').includes(value) ? 'selected' : ''} key={value} onClick={() => toggle('airbags', value)}>{value} {value === '1' ? 'Airbag' : 'Airbags'} <small>({ads.filter(ad => ad.attributes?.airbags === value).length})</small></button>)}</div><strong>Safety Features</strong><div className="nextdeal-check-options">{['ABS', 'EBD', 'Traction Control', 'Airbags'].map(option => <label className="nextdeal-filter-check" key={option}><input type="checkbox" checked={selectedValues(filters.features || '').includes(option)} onChange={() => toggle('features', option)} /><span>{option}</span><small>{ads.filter(ad => (ad.attributes?.features || '').toLowerCase().includes(option.toLowerCase())).length}</small></label>)}</div></div></FilterGroup>
  </div>
}

export function MarketplacePage() {
  const { categorySlug: routeSlug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const category = getDealCategory(routeSlug)
  const subcategorySlug = new URLSearchParams(location.search).get('sub') || ''
  const [ads, setAds] = useState<MarketplaceAd[]>([])
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({})
  const [sort, setSort] = useState('newest')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState(4)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const startedAt = performance.now()
    let progressTimer: ReturnType<typeof setInterval> | undefined
    let finishTimer: ReturnType<typeof setTimeout> | undefined
    setLoading(true); setLoadProgress(4); setError('')
    progressTimer = setInterval(() => setLoadProgress(current => Math.min(91, current + (current < 60 ? 3 : 1))), 95)
    endpoints.marketplaceAds(undefined, appliedSearch || undefined, category?.slug === 'cars' ? 'Car' : undefined, category?.slug, subcategorySlug || undefined)
      .then(rows => active && setAds(rows))
      .catch(reason => active && setError((reason as Error).message))
      .finally(() => {
        const finishLoading = () => {
          if (!active) return
          setLoadProgress(100)
          finishTimer = setTimeout(() => { if (active) setLoading(false) }, 160)
        }
        // Avoid a one-frame flash on very fast responses without delaying real data.
        const minimumVisibleMs = 350
        const remaining = Math.max(0, minimumVisibleMs - (performance.now() - startedAt))
        finishTimer = setTimeout(finishLoading, remaining)
      })
    return () => { active = false; if (progressTimer) clearInterval(progressTimer); if (finishTimer) clearTimeout(finishTimer) }
  }, [appliedSearch, category?.slug, subcategorySlug])

  useEffect(() => { setFieldFilters({}); setMinPrice(''); setMaxPrice('') }, [category?.slug, subcategorySlug])
  const activeFields = category?.fields || []
  const visible = useMemo(() => ads.filter(ad => {
    if (minPrice && ad.price < Number(minPrice)) return false
    if (maxPrice && ad.price > Number(maxPrice)) return false
    if (!category && fieldFilters.condition && ad.attributes?.condition !== fieldFilters.condition) return false
    for (const field of activeFields) {
      const expected = fieldFilters[field.key]?.trim()
      if (!expected) continue
      const actual = fieldValue(ad, field.key)
      if (field.type === 'number') {
        const amount = Number(actual); const [minimum, maximum] = expected.split('|')
        if (!Number.isFinite(amount)) return false
        if (minimum && amount < Number(minimum)) return false
        if (maximum && amount > Number(maximum)) return false
      } else if (selectedValues(expected).length) {
        const choices = selectedValues(expected)
        if (field.key === 'features') {
          if (!choices.some(choice => actual.toLowerCase().includes(choice.toLowerCase()))) return false
        } else if (!choices.some(choice => actual.toLowerCase() === choice.toLowerCase())) return false
      } else if (field.type === 'select') {
        if (actual.toLowerCase() !== expected.toLowerCase()) return false
      } else if (!actual.toLowerCase().includes(expected.toLowerCase())) return false
    }
    return true
  }).sort((a, b) => sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : sort === 'oldest' ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : Date.parse(b.createdAt) - Date.parse(a.createdAt)), [ads, activeFields, fieldFilters, minPrice, maxPrice, sort])
  const activeCount = Object.values(fieldFilters).reduce((count, value) => count + (selectedValues(value).length || value.split('|').filter(Boolean).length || Number(Boolean(value))), 0) + Number(Boolean(minPrice)) + Number(Boolean(maxPrice))
  const clearFilters = () => { setMinPrice(''); setMaxPrice(''); setFieldFilters({}); setSort('newest') }
  const setCategory = (slug?: string) => { setCategoriesOpen(false); navigate(slug ? `/classifieds/${slug}` : '/classifieds') }
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setAppliedSearch(search.trim()) }

  return <div className="page-container marketplace-page nextdeal-page">
    <section className="nextdeal-page-heading"><div><span className="eyebrow">NEXT DEAL · BUY, SELL, CHAT</span><h1>{category?.label || 'Find your next deal'}</h1><p>Browse cars, homes, electronics and everyday finds from people across India. Agree directly with the seller; Plutonea does not collect sale payments.</p></div><Link className="button button-dark" to={`/sell${category ? `?category=${category.slug}` : ''}`}><Plus size={16} /> Post an ad</Link></section>
    <form className="nextdeal-searchbar" onSubmit={submitSearch}><Search size={19} /><input id="marketplace-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search cars, old ACs, furniture, phones and more" /><button type="submit">Search <ArrowRight size={15} /></button></form>
    <div className="nextdeal-category-strip"><button className="nextdeal-all-categories" onClick={() => setCategoriesOpen(true)}><SlidersHorizontal size={16} /> All categories <ChevronDown size={14} /></button>{nextDealCategories.slice(0, 7).map(item => <button key={item.slug} className={category?.slug === item.slug ? 'selected' : ''} onClick={() => setCategory(item.slug)}>{item.icon} {item.label}</button>)}</div>
    {category && <div className="nextdeal-subcategory-strip"><button className={!subcategorySlug ? 'selected' : ''} onClick={() => navigate(`/classifieds/${category.slug}`)}>All {category.label}</button>{category.subcategories.map(child => <button key={child.slug} className={subcategorySlug === child.slug ? 'selected' : ''} onClick={() => navigate(`/classifieds/${category.slug}?sub=${child.slug}`)}>{child.label}</button>)}</div>}
    <div className="nextdeal-result-heading"><div><span className="eyebrow">{category ? `${category.icon} ${category.label.toUpperCase()}` : 'ALL INDIA'}</span><h2>{category ? `Find ${category.label.toLowerCase()}` : 'Explore listings'}</h2><small>{loading ? 'Loading listings…' : `${visible.length.toLocaleString('en-IN')} ${visible.length === 1 ? 'listing' : 'listings'}${subcategorySlug ? ` · ${subcategorySlug.replace(/-/g, ' ')}` : ''}`}</small></div><button className="nextdeal-mobile-filter-button" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16} /> Filters {activeCount > 0 && <b>{activeCount}</b>}</button></div>
    <div className="nextdeal-results-layout">
      <main className="nextdeal-results-main">
        <div className="nextdeal-sort-row"><span>{appliedSearch ? `Results for “${appliedSearch}”` : category ? `Browse ${category.label}` : 'Recent ads from across India'}</span><label>Sort<select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="oldest">Oldest</option></select></label></div>
        {loading && <div className="nextdeal-load-progress" role="progressbar" aria-label="Loading listings and photos" aria-valuemin={0} aria-valuemax={100} aria-valuenow={loadProgress}><div className="nextdeal-load-progress-copy"><span>Loading listings and photos</span><strong>{loadProgress}%</strong></div><div className="nextdeal-load-progress-track"><span style={{ width: `${loadProgress}%` }} /></div></div>}
        {error && <div className="error-banner" role="alert">{error}</div>}
        {loading ? <div className="marketplace-grid nextdeal-loading-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <article className="nextdeal-loading-card" key={index}><div className="nextdeal-loading-photo"><span className="nextdeal-loading-image-progress"><i style={{ animationDelay: `${index * 110}ms` }} /></span></div><div className="nextdeal-loading-copy"><i /><i /><i /><i /></div></article>)}</div> : visible.length ? <div className="marketplace-grid nextdeal-listing-grid">{visible.map(ad => <DealCard ad={ad} key={ad.id} />)}</div> : <div className="empty-state"><span className="nextdeal-empty-icon">{category?.icon || '🔎'}</span><h3>No matching ads yet</h3><p>Try another search or clear a filter. You can also post the first ad in this category.</p><button className="button button-outline" onClick={clearFilters}>Clear filters</button> <Link className="button button-dark" to={`/sell${category ? `?category=${category.slug}` : ''}`}>Post an ad</Link></div>}
        <p className="marketplace-disclaimer">Chat with sellers to ask questions and agree a safe local handover. For car ads, request a free test drive. No sale payment is collected in Plutonea.</p>
      </main>
      <aside className={`nextdeal-filter-sidebar ${filtersOpen ? 'nextdeal-filter-open' : ''}`} aria-label="Listing filters">
        <div className="nextdeal-filter-head"><div><span className="eyebrow">REFINE RESULTS</span><h3>Filters {activeCount > 0 && <b>{activeCount}</b>}</h3></div><button className="nextdeal-filter-close" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X /></button></div>
        <button className="nextdeal-clear-filter" onClick={clearFilters}>Clear all</button>
        {category?.slug === 'cars' ? <CarFilterPanel ads={ads} filters={fieldFilters} setFilter={(key, value) => setFieldFilters(current => ({ ...current, [key]: value }))} minPrice={minPrice} maxPrice={maxPrice} setPriceRange={(low, high) => { setMinPrice(low); setMaxPrice(high) }} /> : <>
          <section className="nextdeal-filter-section"><strong>Budget</strong><div className="nextdeal-price-fields"><label>Min ₹<input type="number" min="0" value={minPrice} onChange={event => setMinPrice(event.target.value)} placeholder="0" /></label><label>Max ₹<input type="number" min="0" value={maxPrice} onChange={event => setMaxPrice(event.target.value)} placeholder="Any" /></label></div></section>
          {!category && <section className="nextdeal-filter-section"><strong>Condition</strong><select className="nextdeal-general-condition" value={fieldFilters.condition || ''} onChange={event => setFieldFilters(current => ({ ...current, condition: event.target.value }))}><option value="">Any condition</option>{[...new Set(ads.map(ad => ad.attributes?.condition).filter((value): value is string => Boolean(value)))].sort().map(value => <option key={value}>{value}</option>)}</select></section>}
          {activeFields.map(field => <section className="nextdeal-filter-section" key={field.key}><FieldControl field={field} value={fieldFilters[field.key] || ''} onChange={value => setFieldFilters(current => ({ ...current, [field.key]: value }))} /></section>)}
          {!category && <p className="nextdeal-filter-category-hint">Choose a category from the header to see filters made for that kind of listing.</p>}
        </>}
        <button className="button button-dark button-full nextdeal-filter-apply" onClick={() => setFiltersOpen(false)}>Show {visible.length} listings</button>
      </aside>
    </div>
    {filtersOpen && <button className="nextdeal-filter-scrim" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />}
    {categoriesOpen && <div className="modal-scrim nextdeal-categories-scrim" onMouseDown={event => event.target === event.currentTarget && setCategoriesOpen(false)}><section className="modal-card nextdeal-categories-dialog" role="dialog" aria-modal="true" aria-labelledby="nextdeal-categories-title"><div className="modal-heading"><div><span className="eyebrow">BROWSE NEXT DEAL</span><h2 id="nextdeal-categories-title">All categories</h2></div><button className="icon-button" onClick={() => setCategoriesOpen(false)} aria-label="Close categories"><X /></button></div><div className="nextdeal-category-mega">{nextDealCategories.map(item => <section key={item.slug}><button className="nextdeal-category-mega-title" onClick={() => setCategory(item.slug)}><span>{item.icon}</span><strong>{item.label}</strong><ArrowRight size={15} /></button>{item.subcategories.map(child => <button key={child.slug} className="nextdeal-category-mega-link" onClick={() => { setCategoriesOpen(false); navigate(`/classifieds/${item.slug}?sub=${child.slug}`) }}>{child.label}</button>)}</section>)}</div></section></div>}
  </div>
}

const formFieldsFor = (categorySlug: string) => getDealCategory(categorySlug)?.fields || []
const carBaseFields = new Set(['make', 'model', 'year', 'kilometres', 'fuel', 'transmission'])

export function PostMarketplaceAdPage() {
  const { user } = useAuth(); const navigate = useNavigate(); const location = useLocation(); const city = currentCity()
  const params = new URLSearchParams(location.search)
  const initialCategory = params.get('category') || (params.get('kind') === 'Car' ? 'cars' : 'mobiles')
  const [categorySlug, setCategorySlug] = useState(getDealCategory(initialCategory) ? initialCategory : 'mobiles')
  const [subcategorySlug, setSubcategorySlug] = useState(params.get('sub') || '')
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [price, setPrice] = useState(''); const [locationText, setLocationText] = useState('')
  const [make, setMake] = useState(''); const [model, setModel] = useState(''); const [variant, setVariant] = useState(''); const [year, setYear] = useState(''); const [kilometres, setKilometres] = useState(''); const [fuel, setFuel] = useState(''); const [transmission, setTransmission] = useState('')
  const [attributes, setAttributes] = useState<Record<string, string>>({}); const [imageUrls, setImageUrls] = useState<string[]>(['']); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const category = getDealCategory(categorySlug)!
  const car = categorySlug === 'cars'
  const changeCategory = (value: string) => { setCategorySlug(value); setSubcategorySlug(''); setAttributes({}); if (value !== 'cars') { setMake(''); setModel(''); setVariant(''); setYear(''); setKilometres(''); setFuel(''); setTransmission('') } }
  const updateAttribute = (key: string, value: string) => setAttributes(current => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!city?.id) { setError('Select the city/area where the item is listed from the location control first.'); return }
    const rawImages = imageUrls.map(value => value.trim()).filter(Boolean)
    const images = rawImages.map(normalizeDriveImageUrl).filter(Boolean)
    if (images.length > 20) { setError('Add no more than 20 photos.'); return }
    setBusy(true); setError('')
    const listing: MarketplaceAdInput = {
      kind: car ? 'Car' : 'Classified', cityId: city.id, categorySlug, subcategorySlug: subcategorySlug || null,
      title: title.trim(), description: description.trim(), price: Number(price), locationText: locationText.trim(), images,
      attributes: Object.fromEntries(Object.entries(attributes).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])),
      ...(car ? { make, model, variant, year: Number(year), kilometres: Number(kilometres), fuel, transmission } : {}),
    }
    try { await endpoints.createMarketplaceAd(listing); navigate(`/my-listings?submitted=1${rawImages.length !== images.length ? `&photosSkipped=${rawImages.length - images.length}` : ''}`) }
    catch (reason) { setError((reason as Error).message) }
    finally { setBusy(false) }
  }

  if (!user) return <div className="page-container auth-required"><h2>Sign in to post an ad</h2><p>Your Plutonea account works across Next Deal and Home Services.</p><Link className="button button-dark" to={`/login?return=${encodeURIComponent(location.pathname + location.search)}`}>Continue with Google</Link></div>
  const formFields = formFieldsFor(categorySlug).filter(field => !car || !carBaseFields.has(field.key))
  return <div className="page-container nextdeal-post-page"><Link className="text-link" to={categorySlug ? `/classifieds/${categorySlug}` : '/classifieds'}><ArrowLeft size={15} /> Back to Next Deal</Link>
    <header className="nextdeal-post-heading"><span className="eyebrow">SELL SAFELY · NO POSTING FEE</span><h1>Post your ad</h1><p>Choose a category, add clear details and photos. Your listing appears after a quick review.</p></header>
    <form className="nextdeal-post-form" onSubmit={submit}>
      <section className="nextdeal-form-section"><span className="nextdeal-step">1</span><div className="nextdeal-form-section-body"><h2>What are you listing?</h2><label>Category<select value={categorySlug} onChange={event => changeCategory(event.target.value)}>{nextDealCategories.map(item => <option key={item.slug} value={item.slug}>{item.icon} {item.label}</option>)}</select></label>
        <label>Subcategory<select value={subcategorySlug} onChange={event => setSubcategorySlug(event.target.value)}><option value="">Choose a subcategory</option>{category.subcategories.map(item => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>
        {car && <div className="nextdeal-form-fields">{[["Make", make, setMake], ["Model", model, setModel], ["Variant (optional)", variant, setVariant], ["Year", year, setYear], ["Kilometres", kilometres, setKilometres]].map(([label, value, setter]) => <label key={String(label)}>{String(label)}<input required={!String(label).includes('optional')} type={['Year', 'Kilometres'].includes(String(label)) ? 'number' : 'text'} min={String(label) === 'Year' ? '1950' : '0'} max={String(label) === 'Year' ? String(new Date().getFullYear() + 1) : undefined} value={String(value)} onChange={event => (setter as (value: string) => void)(event.target.value)} /></label>)}<label>Fuel<select required value={fuel} onChange={event => setFuel(event.target.value)}><option value="">Choose fuel</option>{['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'].map(value => <option key={value}>{value}</option>)}</select></label><label>Transmission<select required value={transmission} onChange={event => setTransmission(event.target.value)}><option value="">Choose transmission</option><option>Manual</option><option>Automatic</option></select></label></div>}
        {formFields.length > 0 && <div className="nextdeal-form-fields">{formFields.map(field => field.key === 'features' ? <fieldset className="nextdeal-ad-feature-field" key={field.key}><legend>{field.label}</legend><div>{field.options?.map(option => { const chosen = (attributes.features || '').split(',').map(item => item.trim()).filter(Boolean); return <label key={option}><input type="checkbox" checked={chosen.includes(option)} onChange={() => updateAttribute('features', chosen.includes(option) ? chosen.filter(item => item !== option).join(', ') : [...chosen, option].join(', '))} /><span>{option}</span></label> })}</div></fieldset> : <label key={field.key}>{field.label}{field.type === 'select' ? <select value={attributes[field.key] || ''} onChange={event => updateAttribute(field.key, event.target.value)}><option value="">Select {field.label.toLowerCase()}</option>{field.options?.map(option => <option key={option}>{option}</option>)}</select> : <input type={field.type === 'number' ? 'number' : 'text'} min={field.type === 'number' ? 0 : undefined} value={attributes[field.key] || ''} placeholder={field.placeholder} onChange={event => updateAttribute(field.key, event.target.value)} />}</label>)}</div>}
      </div></section>
      <section className="nextdeal-form-section nextdeal-photo-links"><span className="nextdeal-step">2</span><div className="nextdeal-form-section-body"><h2>Add photos (optional)</h2><p className="muted">Add multiple photos for <strong>any category</strong>. Add a separate link for each image from Google Drive or another public image host.</p><PhotoLinksInput values={imageUrls} onChange={setImageUrls} idPrefix="new-ad-photo" /></div></section>
      <section className="nextdeal-form-section"><span className="nextdeal-step">3</span><div className="nextdeal-form-section-body"><h2>Describe your ad</h2><label>Ad title<input required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="Example: Whirlpool 1.5 ton split AC, good condition" /></label><label>Description<textarea required maxLength={4000} rows={5} value={description} onChange={event => setDescription(event.target.value)} placeholder="Mention condition, age, included accessories and anything a buyer should know." /></label><div className="nextdeal-form-fields"><label>Asking price (₹)<input required type="number" min="0" value={price} onChange={event => setPrice(event.target.value)} placeholder="Enter your price" /></label><label>Area / neighbourhood<input required maxLength={300} value={locationText} onChange={event => setLocationText(event.target.value)} placeholder="Example: Gomti Nagar, Lucknow" /></label></div></div></section>
      <aside className="nextdeal-publish-note"><MapPin size={17} /><span>Posting for <strong>{city?.name || 'no location selected'}</strong>. Buyers can find your ad from other locations too.</span></aside>
      <p className="marketplace-disclaimer">Meet in a safe public place, inspect items before paying, and never share OTPs or banking details in photos or chat.</p>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <button className="button button-dark nextdeal-submit" disabled={busy}>{busy ? 'Submitting for review…' : 'Submit ad for review'} <ArrowRight size={16} /></button>
    </form>
  </div>
}
