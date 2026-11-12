import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowRight, BadgeCheck, Bell, CalendarDays, Check, ChevronDown, Clock3, CreditCard, Heart, House, Info, MapPin, Menu, MessageCircle, Minus, Palette, Plus, Search, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles, Star, Store, Trash2, TriangleAlert, UserRound, Wrench, X } from 'lucide-react'
import { endpoints, googleSignInUrl, type Address, type AdminCatalogCategory, type AdminCatalogService, type Booking, type Category, type City, type PartnerApplication, type PartnerListing, type PlaceSearchResult, type Service, type ServiceSummary, type Sku } from './api'
import { useAuth, useCart, useWishlist } from './state'
import { MarketplaceFavoritesPage, MarketplaceNotificationsPage, MarketplacePage, PostMarketplaceAdPage } from './NextDealPages'
import { MarketplaceDetailPage, MyMarketplaceAdsPage, MarketplaceAdminPanel, MarketplaceChatsPage, MarketplaceChatThreadPage } from './MarketplacePages'

const money = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`
const slugTitle = (value: string) => value.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
const isAdmin = (role?: string) => role === 'Admin'
const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => { const rad = (n: number) => n * Math.PI / 180; const dLat = rad(lat2 - lat1); const dLng = rad(lng2 - lng1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) }
const LocationContext = createContext<{ city: City | null; setCity: (city: City | null) => void; locationLabel: string; setLocationLabel: (value: string) => void; selectedPlace: PlaceSearchResult | null; setSelectedPlace: (place: PlaceSearchResult | null) => void } | null>(null)
function useLocationState() { const value = useContext(LocationContext); if (!value) throw new Error('Location state missing'); return value }
type ThemeName = 'grove' | 'sunrise' | 'lagoon'
const themeOptions: { id: ThemeName; name: string; detail: string; color: string }[] = [
  { id: 'grove', name: 'Grove', detail: 'Calm green · citrus', color: '#254d44' },
  { id: 'sunrise', name: 'Sunrise', detail: 'Warm clay · apricot', color: '#a94f3a' },
  { id: 'lagoon', name: 'Lagoon', detail: 'Deep teal · mint', color: '#146579' },
]
const ThemeContext = createContext<{ theme: ThemeName; setTheme: (theme: ThemeName) => void } | null>(null)
function useTheme() { const value = useContext(ThemeContext); if (!value) throw new Error('Theme state missing'); return value }
function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(() => {
    try { const saved = localStorage.getItem('plutonea.theme'); return themeOptions.some(x => x.id === saved) ? saved as ThemeName : 'grove' } catch { return 'grove' }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('plutonea.theme', theme) } catch { /* Keep the selected theme for this session. */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeOptions.find(x => x.id === theme)?.color || '#254d44')
  }, [theme])
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export default function App() {
  const auth = useAuth(); const navigate = useNavigate()
  useEffect(() => { if (!auth.ready || !auth.user) return; const target = sessionStorage.getItem('plutonea.post-oauth-path') || sessionStorage.getItem('haven.post-oauth-path'); if (target) { sessionStorage.removeItem('plutonea.post-oauth-path'); sessionStorage.removeItem('haven.post-oauth-path'); navigate(target, { replace: true }) } }, [auth.ready, auth.user, navigate])
  const [city, setCityState] = useState<City | null>(() => { try { return JSON.parse(localStorage.getItem('plutonea.city') || localStorage.getItem('haven.city') || 'null') } catch { return null } })
  const [locationLabel, setLocationLabelState] = useState(() => localStorage.getItem('plutonea.location') || localStorage.getItem('haven.location') || '')
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(() => { try { return JSON.parse(localStorage.getItem('plutonea.selected-place') || 'null') } catch { return null } })
  const setCity = (value: City | null) => { setCityState(value); if (value) localStorage.setItem('plutonea.city', JSON.stringify(value)); else localStorage.removeItem('plutonea.city'); localStorage.removeItem('haven.city') }
  const setLocationLabel = (value: string) => { setLocationLabelState(value); localStorage.setItem('plutonea.location', value); localStorage.removeItem('haven.location') }
  const savePlace = (place: PlaceSearchResult | null) => { setSelectedPlace(place); if (place) localStorage.setItem('plutonea.selected-place', JSON.stringify(place)); else localStorage.removeItem('plutonea.selected-place') }
  return <ThemeProvider><LocationContext.Provider value={{ city, setCity, locationLabel, setLocationLabel, selectedPlace, setSelectedPlace: savePlace }}><div className="app-shell"><Header /><LocationPermissionPrompt />{auth.user && auth.user.role !== 'Admin' && !auth.user.profileComplete && <ProfileCompletionBanner />}<main className="main-area"><Routes>
    <Route path="/" element={<Navigate to="/classifieds" replace />} /><Route path="/home-services" element={<HomePage />} /><Route path="/login" element={<AuthPage mode="login" />} /><Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/category/:categorySlug" element={<CategoryPage />} /><Route path="/service/:serviceSlug" element={<ServicePage />} />
    <Route path="/marketplace" element={<Navigate to="/classifieds" replace />} /><Route path="/classifieds" element={<MarketplacePage />} /><Route path="/classifieds/:categorySlug" element={<MarketplacePage />} /><Route path="/wishlist" element={<RequireUser><MarketplaceFavoritesPage /></RequireUser>} /><Route path="/notifications" element={<RequireUser><MarketplaceNotificationsPage /></RequireUser>} /><Route path="/chats" element={<RequireUser><MarketplaceChatsPage /></RequireUser>} /><Route path="/chats/:id" element={<RequireUser><MarketplaceChatThreadPage /></RequireUser>} />
    <Route path="/cars" element={<Navigate to="/classifieds" replace />} /><Route path="/buy-sell" element={<Navigate to="/classifieds" replace />} />
    <Route path="/marketplace/:adId" element={<MarketplaceDetailPage />} /><Route path="/sell" element={<RequireUser><PostMarketplaceAdPage /></RequireUser>} /><Route path="/my-listings" element={<RequireUser><MyMarketplaceAdsPage /></RequireUser>} />
    <Route path="/cart" element={<CartPage />} /><Route path="/checkout" element={<CheckoutPage />} /><Route path="/bookings" element={<BookingsPage />} />
    <Route path="/profile" element={<ProfilePage />} /><Route path="/partner" element={<RequireUser><PartnerPage /></RequireUser>} /><Route path="/admin" element={<AdminPage />} /><Route path="*" element={<NotFound />} />
  </Routes></main><MobileTabBar /><Footer /></div></LocationContext.Provider></ThemeProvider>
}

function Header() {
  const { user, ready, logout } = useAuth(); const { count } = useCart(); const { city, locationLabel } = useLocationState()
  const wishlist = useWishlist()
  const [locationOpen, setLocationOpen] = useState(false); const [menuOpen, setMenuOpen] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const navigate = useNavigate(); const location = useLocation()
  const [chatUnreadCount, setChatUnreadCount] = useState(0); const [notificationCount, setNotificationCount] = useState(0)
  const [switchingTo, setSwitchingTo] = useState<'next-deal' | 'home-services' | null>(null)
  const switchTimer = useRef<number | undefined>(undefined)
  const isHomeServices = ['/home-services', '/category/', '/service/', '/cart', '/checkout', '/bookings', '/partner'].some(path => location.pathname === path || location.pathname.startsWith(path))
  const activeApp = isHomeServices ? 'home-services' : 'next-deal'
  const displayedApp = switchingTo || activeApp
  useEffect(() => {
    let alive = true
    if (!user || activeApp !== 'next-deal') { setChatUnreadCount(0); setNotificationCount(0); return () => { alive = false } }
    const refreshCounts = async () => {
      const [conversationResult, requestResult] = await Promise.allSettled([endpoints.marketplaceConversations(), endpoints.sellerTestDrives()])
      if (!alive) return
      const conversations = conversationResult.status === 'fulfilled' ? conversationResult.value : []
      const requests = requestResult.status === 'fulfilled' ? requestResult.value : []
      const unreadMessages = conversations.reduce((total, item) => total + item.unreadCount, 0)
      const pendingRequests = requests.filter(item => item.status === 'Pending').length
      setChatUnreadCount(unreadMessages)
      setNotificationCount(unreadMessages + pendingRequests)
    }
    void refreshCounts()
    const timer = window.setInterval(() => void refreshCounts(), 45000)
    const refreshOnAction = () => void refreshCounts()
    window.addEventListener('plutonea:header-counts-refresh', refreshOnAction)
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('plutonea:header-counts-refresh', refreshOnAction) }
  }, [user?.id, activeApp, location.pathname])
  const switchApp = (target: 'next-deal' | 'home-services') => {
    if (switchingTo) return
    const path = location.pathname
    const alreadyInTarget = target === 'home-services'
      ? isHomeServices
      : ['/classifieds', '/marketplace', '/chats', '/wishlist', '/notifications', '/sell', '/my-listings'].some(route => path === route || path.startsWith(`${route}/`))
    // Shared pages (profile/admin/login) and the other app's pages should still
    // navigate to this app's landing page even when the switcher already marks it selected.
    if (target === activeApp && alreadyInTarget) return
    setSwitchingTo(target)
    switchTimer.current = window.setTimeout(() => {
      navigate(target === 'next-deal' ? '/classifieds' : '/home-services')
      setMobileOpen(false)
      setSwitchingTo(null)
    }, 460)
  }
  useEffect(() => () => { if (switchTimer.current !== undefined) window.clearTimeout(switchTimer.current) }, [])
  useEffect(() => { const openPicker = () => setLocationOpen(true); window.addEventListener('plutonea:open-location', openPicker); return () => window.removeEventListener('plutonea:open-location', openPicker) }, [])
  const dashboard = user ? isAdmin(user.role) ? '/admin' : user.role === 'Professional' ? '/partner' : '/bookings' : '/login'
  return <><header className={`site-header ${switchingTo ? 'site-header-switching' : ''}`}><div className="header-inner">
    <div className="header-topline">
      <Link to="/classifieds" className="brand" aria-label="Plutonea Next Deal home"><span className="brand-mark">p</span><span>plutonea<span className="brand-dot">.</span></span></Link>
      <div className="header-actions">
        {!location.pathname.startsWith('/classifieds') && !location.pathname.startsWith('/chats') && !location.pathname.startsWith('/marketplace') && <Link to="/cart" className="icon-button cart-link" aria-label="Home services cart"><ShoppingCart size={20} />{count > 0 && <span className="cart-count">{count}</span>}</Link>}
        <div className="account-wrap">{!ready ? <button className="button button-outline session-account-check" type="button" disabled><span className="session-account-spinner" /> Checking account…</button> : user ? <button className="account-button" onClick={() => setMenuOpen(!menuOpen)}><span className="avatar">{user.fullName.slice(0, 1).toUpperCase()}</span><span className="account-name">{user.fullName.split(' ')[0]}</span><ChevronDown size={15} /></button> : <Link className="button button-dark sign-in" to="/login">Sign in</Link>}
          {menuOpen && user && <div className="account-menu"><div className="menu-email">{user.email}</div><Link to="/profile" onClick={() => setMenuOpen(false)}>My profile</Link>{user.role === 'Professional' && <><Link to="/home-services" onClick={() => setMenuOpen(false)}>Customer mode</Link><Link to="/partner" onClick={() => setMenuOpen(false)}>Partner workspace</Link></>}{!isAdmin(user.role) && <><Link to="/my-listings" onClick={() => setMenuOpen(false)}>My Next Deal ads</Link><Link to="/chats" onClick={() => setMenuOpen(false)}>My chats</Link>{user.role !== 'Professional' && <Link to="/partner" onClick={() => setMenuOpen(false)}>Become a service partner</Link>}</>}<Link to={dashboard} onClick={() => setMenuOpen(false)}>{isAdmin(user.role) ? 'Admin workspace' : user.role === 'Professional' ? 'My partner jobs' : 'My bookings'}</Link><button onClick={async () => { await logout(); setMenuOpen(false); navigate('/classifieds') }}>Log out</button></div>}
        </div>
        <button className="mobile-menu icon-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen}><Menu size={21} /></button>
      </div>
    </div>
    <button className="location-trigger" onClick={() => setLocationOpen(true)}><MapPin size={18} /><span><small>{activeApp === 'next-deal' ? 'Next Deal area' : 'Service location'}</small><strong>{locationLabel || city?.name || 'Choose a location'}</strong></span><ChevronDown size={16} /></button>
    <div className={`app-mode-switcher ${displayedApp === 'home-services' ? 'home-mode-active' : ''} ${switchingTo ? 'app-mode-switching' : ''}`} role="group" aria-label="Choose an application">
      <span className="app-mode-highlight" aria-hidden="true" />
      <button type="button" className={`app-mode-option next-deal-option ${displayedApp === 'next-deal' ? 'selected' : ''}`} aria-pressed={displayedApp === 'next-deal'} onClick={() => switchApp('next-deal')}>
        <span className="app-mode-icon"><ShoppingBag size={17} /></span><span className="app-mode-label"><strong>Next Deal</strong><small>Buy &amp; sell locally</small></span>
      </button>
      <button type="button" className={`app-mode-option home-service-option ${displayedApp === 'home-services' ? 'selected' : ''}`} aria-pressed={displayedApp === 'home-services'} onClick={() => switchApp('home-services')}>
        <span className="app-mode-icon"><House size={17} /></span><span className="app-mode-label"><strong>Home Services</strong><small>Book local pros</small></span>
      </button>
    </div>
    <button className="search-trigger" aria-label={activeApp === 'next-deal' ? 'Search Next Deal' : 'Search for a service'} onClick={() => { const market = activeApp === 'next-deal'; navigate(market ? '/classifieds' : '/home-services'); setTimeout(() => document.getElementById(market ? 'marketplace-search' : 'service-search')?.focus(), 80) }}><Search size={18} /><span>{activeApp === 'next-deal' ? 'Search Next Deal' : 'Search for a service'}</span></button>
    <nav aria-label="Main menu" className={`header-nav ${mobileOpen ? 'nav-open' : ''}`}>{user && isAdmin(user.role) && <Link onClick={() => setMobileOpen(false)} to={dashboard}>Admin</Link>}<ThemePicker /></nav>
    {activeApp === 'next-deal' && <div className="nextdeal-actions-bar" aria-label="Next Deal actions">
      <Link className="nextdeal-header-action" to={user ? '/wishlist' : `/login?return=${encodeURIComponent('/wishlist')}`} aria-label={`Wishlist${wishlist.count ? `, ${wishlist.count} saved` : ''}`}><span className="nextdeal-action-icon"><Heart size={19} />{wishlist.count > 0 && <b className="header-action-count">{wishlist.count > 99 ? '99+' : wishlist.count}</b>}</span><span>Wishlist</span></Link>
      <Link className="nextdeal-header-action" to={user ? '/chats' : `/login?return=${encodeURIComponent('/chats')}`} aria-label={`Chats${chatUnreadCount ? `, ${chatUnreadCount} unread messages` : ''}`}><span className="nextdeal-action-icon"><MessageCircle size={19} />{chatUnreadCount > 0 && <b className="header-action-count">{chatUnreadCount > 99 ? '99+' : chatUnreadCount}</b>}</span><span>Chats</span></Link>
      <Link className="nextdeal-header-action nextdeal-post-action" to="/sell"><span className="nextdeal-action-icon"><Plus size={19} /></span><span>Post ad</span></Link>
      {user && <Link className="nextdeal-header-action" to="/notifications" aria-label={`Notifications${notificationCount ? `, ${notificationCount} new` : ''}`}><span className="nextdeal-action-icon"><Bell size={19} />{notificationCount > 0 && <b className="header-action-count">{notificationCount > 99 ? '99+' : notificationCount}</b>}</span><span>Notifications</span></Link>}
    </div>}
  </div>{switchingTo && <div className="app-switch-progress" role="status" aria-live="polite"><span />Switching to {switchingTo === 'next-deal' ? 'Plutonea Next Deal' : 'Home Services'}…</div>}</header>{locationOpen && <LocationDialog onClose={() => setLocationOpen(false)} />}{!ready && <div className="session-progress" />}</>
}

function ProfileCompletionBanner() {
  const location = useLocation()
  if (location.pathname === '/profile') return null
  return <div className="profile-completion-banner"><UserRound size={17} /><span>Complete your profile to post ads and contact sellers.</span><Link to="/profile">Complete profile <ArrowRight size={15} /></Link></div>
}
function LocationPermissionPrompt() {
  const auth = useAuth(); const location = useLocation(); const { city, setCity, setLocationLabel, setSelectedPlace } = useLocationState()
  const [open, setOpen] = useState(false); const [manual, setManual] = useState(false); const [cities, setCities] = useState<City[]>([]); const [selectedCityId, setSelectedCityId] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  const syncedPreference = useRef('')
  const homeServicesRoute = location.pathname === '/home-services' || location.pathname.startsWith('/category/') || location.pathname.startsWith('/service/')
  useEffect(() => {
    const status = localStorage.getItem('plutonea.location-permission-status')
    const key = `${auth.user?.id || ''}:${status || ''}`
    if (!auth.user || auth.user.locationPermissionStatus || !status || syncedPreference.current === key) return
    syncedPreference.current = key
    const selectedCityId = status === 'Manual' || status === 'Granted' ? city?.id || null : null
    const clearCity = !selectedCityId && (status === 'Manual' || status === 'Granted')
    void endpoints.updateLocationPreference(status as 'Granted' | 'Denied' | 'Dismissed' | 'Manual', selectedCityId, clearCity)
      .then(() => auth.refreshUser())
      .catch(() => { syncedPreference.current = '' })
  }, [auth.user?.id, auth.user?.locationPermissionStatus, city?.id])
  useEffect(() => {
    if (!homeServicesRoute) { setOpen(false); return }
    if (!auth.ready) return
    const serverChoice = auth.user?.locationPermissionStatus
    const localChoice = localStorage.getItem('plutonea.location-permission-status')
    if (serverChoice || localChoice) { setOpen(false); return }
    setOpen(true)
    void endpoints.cities().then(rows => { setCities(rows); setSelectedCityId(city?.id || rows[0]?.id || '') }).catch(e => setMessage(e.message))
  }, [homeServicesRoute, auth.ready, auth.user?.id, auth.user?.locationPermissionStatus, city?.id])

  const saveChoice = async (status: 'Granted' | 'Denied' | 'Dismissed' | 'Manual', selected?: City) => {
    localStorage.setItem('plutonea.location-permission-status', status)
    if (selected) { setCity(selected); setSelectedPlace(null); setLocationLabel(status === 'Granted' ? `Near you · ${selected.name}` : selected.name) }
    if (auth.user) {
      try { await endpoints.updateLocationPreference(status, selected?.id || null); await auth.refreshUser() }
      catch (e) { setMessage(`Location choice saved on this device. Account sync failed: ${(e as Error).message}`) }
    }
  }
  const chooseManually = async () => {
    const selected = cities.find(x => x.id === selectedCityId)
    if (!selected) { setMessage('Choose a city to continue.'); setManual(true); return }
    await saveChoice('Manual', selected); setOpen(false)
  }
  const requestLocation = () => {
    if (!navigator.geolocation) { setManual(true); setMessage('Location access is unavailable in this browser. Choose your city instead.'); return }
    setBusy(true); setMessage('Waiting for your browser’s location permission…')
    navigator.geolocation.getCurrentPosition(async position => {
      try {
        const nearest = cities.map(candidate => ({ city: candidate, distance: distanceKm(position.coords.latitude, position.coords.longitude, candidate.centerLat, candidate.centerLng) })).sort((a, b) => a.distance - b.distance)[0]
        if (nearest && nearest.distance <= 50) { await saveChoice('Granted', nearest.city); const place: PlaceSearchResult = { displayName: `Near you · ${nearest.city.name}`, lat: position.coords.latitude, lng: position.coords.longitude }; setSelectedPlace(place); setLocationLabel(place.displayName); setMessage(`Home service area selected: ${nearest.city.name}.`); setOpen(false) }
        else { const place: PlaceSearchResult = { displayName: 'Current location', lat: position.coords.latitude, lng: position.coords.longitude }; setCity(null); setSelectedPlace(place); setLocationLabel(place.displayName); localStorage.setItem('plutonea.location-permission-status', 'Granted'); if (auth.user) { await endpoints.updateLocationPreference('Granted', null, true); await auth.refreshUser() } setManual(true); setMessage('Location selected. Home Services are not configured within 50 km yet. Search a landmark or choose a service city; Next Deal remains available across India.') }
      } catch (e) { setMessage((e as Error).message) }
      finally { setBusy(false) }
    }, async error => {
      const denied = error.code === error.PERMISSION_DENIED
      await saveChoice(denied ? 'Denied' : 'Dismissed')
      setBusy(false); setManual(true)
      setMessage(denied ? 'Location was blocked in your browser. You can still choose a city manually.' : 'Could not read your location. Choose a city manually instead.')
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 })
  }
  const defer = async () => { await saveChoice('Dismissed'); setOpen(false) }
  if (!open) return null
  return <div className="modal-scrim location-permission-scrim"><section className="modal-card location-permission-card" role="dialog" aria-modal="true" aria-labelledby="location-permission-title">
    <div className="location-permission-icon"><MapPin size={26} /></div><span className="eyebrow">HOME SERVICES FOR YOUR AREA</span><h2 id="location-permission-title">Check services near you</h2><p>Allow location access to select the closest Plutonea service city. Your exact location stays on this device unless you choose to save it as an address. You can also search for a landmark or choose a city.</p>
    <button className="button button-dark button-full" onClick={requestLocation} disabled={busy}>{busy ? 'Checking location…' : 'Use my current location'} <ArrowRight size={16} /></button>
    <button className="text-button location-manual-toggle" onClick={() => setManual(!manual)}>{manual ? 'Hide city choices' : 'Choose a city instead'}</button>
    {manual && <div className="location-manual-picker"><label htmlFor="location-city-select">Browse in</label><select id="location-city-select" value={selectedCityId} onChange={e => setSelectedCityId(e.target.value)}><option value="">Select city</option>{cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="button button-outline button-full" onClick={() => void chooseManually()}>Continue with this city</button></div>}
    <button className="text-button location-manual-toggle" onClick={async () => { await saveChoice('Dismissed'); setOpen(false); window.dispatchEvent(new Event('plutonea:open-location')) }}>Search a landmark or exact address</button>
    {message && <LocationFeedback message={message} />}<button className="location-not-now" onClick={() => void defer()}>Not now</button>
  </section></div>
}

function ThemePicker() {
  const { theme, setTheme } = useTheme(); const [open, setOpen] = useState(false)
  return <div className={`theme-picker ${open ? 'theme-picker-open' : ''}`}>
    <button className="theme-picker-trigger" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}><Palette size={17} /><span>Theme</span><ChevronDown size={13} /></button>
    {open && <div className="theme-picker-menu" role="group" aria-label="Choose an app theme"><span className="theme-picker-title">Choose your look</span>{themeOptions.map(option => <button key={option.id} className={`theme-option ${theme === option.id ? 'theme-option-active' : ''}`} aria-pressed={theme === option.id} onClick={() => { setTheme(option.id); setOpen(false) }}><span className={`theme-option-swatch theme-swatch-${option.id}`}><i /><i /></span><span className="theme-option-copy"><strong>{option.name}</strong><small>{option.detail}</small></span>{theme === option.id && <Check size={16} />}</button>)}</div>}
  </div>
}

function MobileTabBar() {
  const { user } = useAuth(); const location = useLocation(); const admin = isAdmin(user?.role)
  const tabs = admin
    ? [{ to: '/classifieds', label: 'Next Deal', icon: <Store /> }, { to: '/home-services', label: 'Home', icon: <House /> }, { to: '/admin', label: 'Admin', icon: <ShieldCheck /> }, { to: '/chats', label: 'Chats', icon: <MessageCircle /> }, { to: '/profile', label: 'Profile', icon: <UserRound /> }]
    : [{ to: '/classifieds', label: 'Next Deal', icon: <Store /> }, { to: '/home-services', label: 'Home', icon: <House /> }, { to: '/cart', label: 'Cart', icon: <ShoppingCart /> }, { to: user ? '/chats' : '/login', label: 'Chats', icon: <MessageCircle /> }, { to: user ? '/profile' : '/login', label: user ? 'Profile' : 'Sign in', icon: <UserRound /> }]
  return <nav className="mobile-tabbar" aria-label="Main navigation">{tabs.map(tab => {
    const active = tab.to !== '/login' && location.pathname.startsWith(tab.to)
    return <Link key={tab.label} to={tab.to} className={`mobile-tab ${active ? 'mobile-tab-active' : ''}`} aria-current={active ? 'page' : undefined}>{tab.icon}<span>{tab.label}</span></Link>
  })}</nav>
}

function LocationDialog({ onClose }: { onClose: () => void }) {
  const { city, setCity, setLocationLabel, setSelectedPlace } = useLocationState(); const auth = useAuth(); const { user } = auth
  const [cities, setCities] = useState<City[]>([]); const [addresses, setAddresses] = useState<Address[]>([]); const [query, setQuery] = useState(''); const [results, setResults] = useState<PlaceSearchResult[]>([]); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [searched, setSearched] = useState(false)
  useEffect(() => { void endpoints.cities().then(setCities).catch(e => setMessage(e.message)); if (user) void endpoints.addresses().then(setAddresses).catch(() => undefined) }, [user])
  const nearestCity = (lat: number, lng: number) => cities.map(candidate => ({ city: candidate, distance: distanceKm(lat, lng, candidate.centerLat, candidate.centerLng) })).sort((a, b) => a.distance - b.distance)[0]
  const persist = async (status: 'Granted' | 'Manual', selectedCity: City | null, clearCity = false) => { localStorage.setItem('plutonea.location-permission-status', status); if (user) { try { await endpoints.updateLocationPreference(status, selectedCity?.id || null, clearCity); await auth.refreshUser() } catch (e) { setMessage(`Saved on this device. Account sync failed: ${(e as Error).message}`) } } }
  const choose = async (next: City, label = next.name) => { setCity(next); setSelectedPlace(null); setLocationLabel(label); window.dispatchEvent(new CustomEvent('plutonea:location-selected', { detail: label })); await persist(label.startsWith('Near you') ? 'Granted' : 'Manual', next); onClose() }
  const choosePlace = async (place: PlaceSearchResult, status: 'Granted' | 'Manual' = 'Manual') => {
    const nearest = nearestCity(place.lat, place.lng); const serviceCity = nearest && nearest.distance <= 50 ? nearest.city : null
    setCity(serviceCity); setSelectedPlace(place); setLocationLabel(place.displayName); window.dispatchEvent(new CustomEvent('plutonea:location-selected', { detail: place.displayName })); await persist(status, serviceCity, !serviceCity)
    if (!serviceCity) setMessage(`Location selected: ${place.displayName}. Home Services are not configured within 50 km yet. Next Deal remains available across India.`)
    onClose()
  }
  const search = async (event: FormEvent) => { event.preventDefault(); if (query.trim().length < 3) { setMessage('Enter at least 3 characters to search a place.'); return } setBusy(true); setMessage(''); setSearched(true); try { const found = await endpoints.searchPlaces(query.trim()); setResults(found); if (!found.length) setMessage(`No map result found for “${query.trim()}”. Try adding the city, district, or PIN code.`) } catch (e) { setMessage((e as Error).message) } finally { setBusy(false) } }
  const current = () => { if (!navigator.geolocation) { setMessage('Location access is not available in this browser. Search for a landmark or choose a city.'); return } setBusy(true); setMessage('Waiting for your browser’s location permission…'); navigator.geolocation.getCurrentPosition(async p => { const coords = { lat: p.coords.latitude, lng: p.coords.longitude }; const nearest = nearestCity(coords.lat, coords.lng); const place: PlaceSearchResult = { displayName: nearest && nearest.distance <= 50 ? `Near you · ${nearest.city.name}` : 'Current location', ...coords }; try { await choosePlace(place, 'Granted') } finally { setBusy(false) } }, e => { setMessage(e.code === 1 ? 'Allow location access in your browser, or search for a place manually.' : 'Could not read your location. Search for a landmark or city instead.'); setBusy(false) }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }) }
  const useAddress = async (a: Address) => { const place: PlaceSearchResult = { displayName: [a.line1, a.line2, a.pincode].filter(Boolean).join(', '), lat: a.lat, lng: a.lng, postcode: a.pincode }; await choosePlace(place) }
  const filtered = cities.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.slug.includes(query.toLowerCase()))
  return <div className="modal-scrim" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="location-dialog modal-card" role="dialog" aria-modal="true" aria-labelledby="location-dialog-title"><div className="modal-heading"><div><span className="eyebrow">YOUR LOCATION</span><h2 id="location-dialog-title">Where do you need service?</h2></div><button className="icon-button" onClick={onClose} aria-label="Close location picker"><X size={20} /></button></div>
    <form className="location-search-form" onSubmit={search}><div className="location-search"><Search size={18} /><input autoFocus value={query} onChange={e => { setQuery(e.target.value); setSearched(false); setResults([]) }} placeholder="Search a landmark, area, city or PIN code" aria-label="Search a place" /><button type="submit" className="location-search-submit" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button></div></form>
    <button className="current-location" onClick={current} disabled={busy}><span className="location-pin"><MapPin size={18} /></span><span><strong>{busy ? 'Finding your location…' : 'Use my current location'}</strong><small>Allow your browser to identify the nearest place</small></span><ArrowRight size={17} /></button>
    {message && <LocationFeedback message={message} />}
    {results.length > 0 && <><div className="section-caption">Places matching “{query.trim()}”</div><div className="place-results">{results.map((place, i) => <button type="button" className="place-result" key={`${place.lat}-${place.lng}-${i}`} onClick={() => void choosePlace(place)}><MapPin size={19} /><span><strong>{place.displayName}</strong><small>{[place.city, place.state, place.postcode].filter(Boolean).join(' · ') || 'India'}</small></span><ArrowRight size={16} /></button>)}</div></>}
    {addresses.length > 0 && <><div className="section-caption">Saved addresses</div>{addresses.map(a => <button className="saved-location" key={a.id} onClick={() => void useAddress(a)}><MapPin size={18} /><span><strong>{a.label}</strong><small>{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.pincode}</small></span></button>)}</>}
    <div className="section-caption">{query ? 'Configured service cities' : 'Popular service cities'}</div><div className="city-results">{filtered.slice(0, 10).map(c => <button key={c.id} className={`city-option ${city?.id === c.id ? 'selected' : ''}`} onClick={() => void choose(c)}><MapPin size={17} /><span>{c.name}</span>{city?.id === c.id && <Check size={17} />}</button>)}{!filtered.length && searched && <p className="muted empty-small">No configured city matches. Search above looks for exact places across India.</p>}</div>
    <p className="dialog-footnote">Place search data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. Exact locations are kept on this device; only your selected service city is saved to your profile.</p>
  </section></div>
}

function HomePage() {
  const { city, setCity, locationLabel } = useLocationState(); const { user } = useAuth(); const [categories, setCategories] = useState<Category[]>([]); const [listings, setListings] = useState<PartnerListing[]>([]); const [query, setQuery] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const navigate = useNavigate()
  useEffect(() => { let alive = true; endpoints.cities().then(rows => { if (!alive) return; const hasExplicitUnserviceablePlace = !city && ['Granted', 'Manual'].includes(localStorage.getItem('plutonea.location-permission-status') || ''); const selected = rows.find(x => x.id === city?.id) || (!hasExplicitUnserviceablePlace ? rows.find(x => x.id === user?.cityId) : null) || null; if (!selected) { setCategories([]); setListings([]); return } if (!city) setCity(selected); return Promise.all([endpoints.categories(selected.slug), endpoints.publicListings()]).then(([cats, ads]) => { if (alive) { const localAds = ads.filter(ad => cats.some(category => category.id === ad.categoryId)); setCategories(cats.filter(category => localAds.some(ad => ad.categoryId === category.id))); setListings(localAds) } }) }).catch(e => alive && setError(e.message)).finally(() => alive && setLoading(false)); return () => { alive = false } }, [city?.id, user?.cityId])
  const filtered = categories.filter(x => x.name.toLowerCase().includes(query.toLowerCase()))
  const icon = (name: string) => /ac|appliance|repair/i.test(name) ? '❄️' : /clean/i.test(name) ? '🧼' : /salon|spa/i.test(name) ? '✂️' : /electric|plumb|carpenter/i.test(name) ? '🛠️' : /paint/i.test(name) ? '🎨' : '🏠'
  return <><section className="hero-section"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> THE BETTER WAY TO GET IT DONE</div><h1>Your home,<br />in good hands.</h1><p>Trusted local experts for the jobs that make home feel like home.</p><div className="hero-search"><Search size={20} /><input id="service-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="What does your home need?" /><button onClick={() => document.getElementById('service-categories')?.scrollIntoView({ behavior: 'smooth' })}>Explore <ArrowRight size={16} /></button></div><div className="hero-proof"><span><ShieldCheck size={17} /> Vetted professionals</span><span><Star size={16} fill="currentColor" /> 4.8 average rating</span></div></div>
    <div className="hero-visual"><img src="https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1500&q=85" alt="Home service professional repairing an air conditioner" /><div className="hero-image-shade" /><div className="hero-image-caption"><div className="caption-icon"><BadgeCheck size={20} /></div><div><strong>Good work, right at home</strong><small>Book a trusted pro in minutes</small></div></div><div className="hero-sticker"><span>YOUR HOME</span><b>deserves<br />the best.</b><Sparkles size={22} /></div></div><div className="hero-index">01 <span /> 02</div>
  </section><div className="trust-strip"><div><span className="trust-number">4.8<span>★</span></span><span>Average customer rating</span></div><i /><div><span className="trust-number">2,400<span>+</span></span><span>Trusted local professionals</span></div><i /><div><span className="trust-number">100<span>%</span></span><span>Secure, transparent booking</span></div></div>
    <section className="content-section marketplace-switch-cards"><SectionHeading eyebrow="ONE ACCOUNT, TWO EXPERIENCES" title="What are you here to do?" subtitle="Choose Home Services or Next Deal. Your profile works across both."/><div className="marketplace-switch-grid"><Link to="/classifieds" className="marketplace-switch-card"><span>🛍️</span><div><strong>Plutonea · Next Deal</strong><small>Find local items, browse cars, chat with sellers, or post an ad.</small></div><ArrowRight/></Link><Link to="/home-services" className="marketplace-switch-card"><span>🏠</span><div><strong>Home Services</strong><small>Book a trusted professional and pay securely.</small></div><ArrowRight/></Link></div></section>
    <section className="content-section categories-section" id="service-categories"><SectionHeading eyebrow="A LITTLE HELP GOES A LONG WAY" title="What can we help with?" subtitle={city ? `Approved services currently posted in ${city.name}.` : locationLabel ? `Selected location: ${locationLabel}` : 'Find approved services posted by professionals in your area.'} />{error && <ErrorBanner message={error} />}{loading ? <div className="category-grid">{Array.from({ length: 6 }, (_, i) => <div className="skeleton category-skeleton" key={i} />)}</div> : <div className="category-grid">{filtered.map((item, i) => <button key={item.id} className={`category-card category-tone-${i % 4}`} onClick={() => navigate(`/category/${item.slug}`)}><span className="category-icon">{item.iconUrl ? <img src={item.iconUrl} alt="" /> : icon(item.name)}</span><span className="category-name">{item.name}</span><span className="category-arrow"><ArrowRight size={18} /></span></button>)}</div>}{!loading && !categories.length && !error && <div className="empty-state"><MapPin /><h3>{city ? `No home services posted in ${city.name} yet` : locationLabel ? 'Home Services are not available near this location yet' : 'Choose a home service location'}</h3><p>{city ? `There are no approved partner service posts in ${city.name} yet. Choose another city or check back later.` : locationLabel ? `We selected ${locationLabel}, but no configured service city is close enough yet. You can still browse Next Deal ads across India.` : 'Search a landmark or address, select your current location, or choose a service city.'} Next Deal ads are available across India.</p><button className="button button-outline" onClick={() => window.dispatchEvent(new Event('plutonea:open-location'))}>Change location <MapPin size={16} /></button> <Link className="button button-outline" to="/classifieds">Browse Next Deal <ArrowRight size={16} /></Link></div>}</section>
    <section className="promo-band"><div className="promo-copy"><span className="eyebrow">MADE FOR REAL LIFE</span><h2>Small fixes.<br />Big relief.</h2><p>Book vetted experts with clear pricing and a little more peace of mind.</p><Link className="text-link" to="/category/ac-appliance-repair">Explore repairs <ArrowRight size={17} /></Link></div><div className="promo-art"><div className="art-sun" /><div className="art-house"><div className="art-roof" /><div className="art-window" /><div className="art-door" /></div><span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" /><div className="art-note"><Sparkles size={17} /> Home feels better</div></div></section>
    {!!listings.length && <section className="content-section featured-section"><SectionHeading eyebrow="LOCAL EXPERTS, REAL RESULTS" title="A few good finds" subtitle="Services offered by approved professionals in your area." /><div className="service-grid">{listings.slice(0, 4).map(x => <ListingCard listing={x} key={x.id} />)}</div></section>}
    <section className="promise-row"><PromiseItem icon={<ShieldCheck />} title="People you can trust" text="Professionals are reviewed before joining the platform." /><PromiseItem icon={<CreditCard />} title="Know the price upfront" text="See what you’ll pay before booking a service." /><PromiseItem icon={<CalendarDays />} title="Book on your schedule" text="Choose an appointment that works for you." /></section></>
}

function PromiseItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="promise-item"><span>{icon}</span><div><strong>{title}</strong><p>{text}</p></div></div> }
function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) { return <div className="section-heading"><span className="eyebrow">{eyebrow}</span><div className="heading-row"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div> }
function ErrorBanner({ message }: { message: string }) { return <div className="error-banner" role="alert">{message}</div> }
function LocationFeedback({ message }: { message: string }) {
  const noCoverage = /no configured|no home service area|outside configured service areas|not configured within 50 km/i.test(message)
  return <div className={`location-feedback ${noCoverage ? 'location-feedback-warning' : 'location-feedback-info'}`} role="status" aria-live="polite">
    <span className="location-feedback-icon">{noCoverage ? <TriangleAlert size={19} /> : <Info size={19} />}</span>
    <span><strong>{noCoverage ? 'Location selected · Home Services unavailable here' : 'Location update'}</strong><span>{message}</span></span>
  </div>
}
function LoadingCard() { return <div className="loading-panel"><span className="spinner" /> Loading service details…</div> }

function CategoryPage() {
  const { categorySlug = '' } = useParams(); const { city } = useLocationState(); const [category, setCategory] = useState<Category | null>(null); const [services, setServices] = useState<ServiceSummary[]>([]); const [error, setError] = useState('')
  useEffect(() => { if (!city) return; void endpoints.categories(city.slug).then(async rows => { const match = rows.find(x => x.slug === categorySlug); setCategory(match || null); if (!match) return []; const [catalog, listings] = await Promise.all([endpoints.services(match.slug), endpoints.publicListings(match.id)]); return catalog.filter(service => listings.some(listing => listing.serviceSlug === service.slug)) }).then(setServices).catch(e => setError(e.message)) }, [city?.slug, categorySlug])
  return <div className="page-container"><Breadcrumbs label={category?.name || slugTitle(categorySlug)} /><SectionHeading eyebrow="SERVICES, AT YOUR DOORSTEP" title={category?.name || slugTitle(categorySlug)} subtitle={`Approved services posted in ${city?.name || 'your selected city'}.`} />{error && <ErrorBanner message={error} />}{services.length ? <div className="service-grid">{services.map((s, i) => <ServiceCard service={s} key={s.id} index={i} />)}</div> : !error && <Empty title="No approved services in this category yet" text="A service appears here after a partner posts it and Plutonea approves it. Try another category or city." />}</div>
}
function Breadcrumbs({ label }: { label: string }) { return <div className="breadcrumbs"><Link to="/home-services">Home</Link><span>/</span><span>{label}</span></div> }
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty-state"><ShoppingBag /><h3>{title}</h3><p>{text}</p><Link className="button button-outline" to="/home-services">Browse categories</Link></div> }
function ServiceCard({ service, index }: { service: ServiceSummary; index: number }) {
  const [detail, setDetail] = useState<Service | null>(null); useEffect(() => { void endpoints.service(service.slug).then(setDetail).catch(() => undefined) }, [service.slug]); const price = detail?.skus[0]?.price
  return <Link className="service-card" to={`/service/${service.slug}`}><div className={`service-card-art service-art-${index % 4}`}><span>{index % 2 ? '🧰' : '✨'}</span><span className="service-card-duration"><Clock3 size={13} /> {service.durationMins} min</span></div><div className="service-card-body"><div className="service-title-row"><h3>{service.name}</h3><ArrowRight size={18} /></div><p>{service.description}</p><div className="service-meta"><span><Star size={14} fill="currentColor" /> 4.8 <small>(popular)</small></span><span>{price ? `From ${money(price)}` : 'View pricing'}</span></div></div></Link>
}

function ServicePage() {
  const { serviceSlug = '' } = useParams(); const [service, setService] = useState<Service | null>(null); const [error, setError] = useState(''); const [selected, setSelected] = useState<Sku | null>(null)
  useEffect(() => { void endpoints.service(serviceSlug).then(setService).catch(e => setError(e.message)) }, [serviceSlug])
  return <div className="page-container"><Breadcrumbs label={service?.name || slugTitle(serviceSlug)} />{service ? <><section className="service-hero"><div className="service-hero-copy"><span className="eyebrow">HOME SERVICE · {service.durationMins} MIN APPROX.</span><h1>{service.name}</h1><p>{service.description}</p><div className="rating-line"><span><Star size={17} fill="currentColor" /> 4.8</span> Loved by homeowners in your city</div><a className="button button-dark" href="#options">Explore service options <ArrowDown size={16} /></a></div><div className="service-hero-art"><div className="service-orbit" /><span className="service-big-emoji">{/clean/i.test(service.name) ? '🧽' : /ac|repair|appliance/i.test(service.name) ? '❄️' : '🪛'}</span><div className="service-stamp"><ShieldCheck size={19} /><span>PLUTONEA<br />APPROVED</span></div><div className="service-art-label">Quality checked<br /><strong>before you book</strong></div></div></section><div className="detail-layout"><div><section className="options-section" id="options"><SectionHeading eyebrow="PICK WHAT YOU NEED" title="Service options" subtitle="Choose a package to see what’s included." />{service.skus.map((sku, i) => <ServiceOption sku={sku} index={i} key={sku.id} onAdd={() => setSelected(sku)} />)}</section><section className="detail-info"><h2>Good to know</h2><div className="info-grid"><div><ShieldCheck /><h3>Trusted professionals</h3><p>Every partner is reviewed and approved by our team.</p></div><div><Clock3 /><h3>At-home convenience</h3><p>Your expert comes to the address you select.</p></div></div></section></div><aside className="service-aside"><div className="aside-card"><span className="aside-kicker">YOUR PLUTONEA PROMISE</span><h3>Better service.<br />Less uncertainty.</h3><ul><li><Check /> Clear pricing</li><li><Check /> Verified partners</li><li><Check /> Support when needed</li></ul></div><div className="aside-help"><Sparkles /><span><strong>Need a hand choosing?</strong><small>Pick a package to see what’s included.</small></span></div></aside></div></> : error ? <ErrorBanner message={error} /> : <LoadingCard />}{selected && service && <AddServiceModal service={service} sku={selected} onClose={() => setSelected(null)} />}</div>
}
function ServiceOption({ sku, index, onAdd }: { sku: Sku; index: number; onAdd: () => void }) {
  const inclusions = useMemo(() => { try { return JSON.parse(sku.inclusions) as string[] } catch { return [] } }, [sku.inclusions])
  return <article className="option-card"><div className={`option-number option-number-${index % 3}`}>0{index + 1}</div><div className="option-copy"><span className="option-label">{sku.isInstant ? 'QUICK BOOKING' : 'POPULAR CHOICE'}</span><h3>{sku.name}</h3><div className="option-rating"><Star size={14} fill="currentColor" /> 4.8 <span>·</span> {Math.max(8, 23 - index * 4)} min setup</div><ul>{inclusions.map(x => <li key={x}><Check size={14} /> {x}</li>)}</ul></div><div className="option-buy"><div className="price-block"><strong>{money(sku.price)}</strong>{sku.strikePrice > sku.price && <del>{money(sku.strikePrice)}</del>}</div><button className="button button-outline" onClick={onAdd}>Add <Plus size={16} /></button>{sku.discountPct > 0 && <span className="discount-note">{Math.round(sku.discountPct)}% savings</span>}</div></article>
}
function AddServiceModal({ service, sku, onClose }: { service: Service; sku: Sku; onClose: () => void }) {
  const [quantity, setQuantity] = useState(1); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const { add } = useCart(); const navigate = useNavigate()
  const inclusions = (() => { try { return JSON.parse(sku.inclusions) as string[] } catch { return [] } })()
  const addItem = async () => { setBusy(true); try { await add(sku, quantity); onClose(); navigate('/cart') } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  return <div className="modal-scrim" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="modal-card add-modal"><div className="modal-heading"><div><span className="eyebrow">ADD TO YOUR CART</span><h2>{sku.name}</h2></div><button className="icon-button" onClick={onClose}><X /></button></div><p className="modal-subtitle">{service.name} · about {service.durationMins} minutes</p><div className="modal-inclusions">{inclusions.map(x => <span key={x}><Check size={14} />{x}</span>)}</div><div className="quantity-row"><div><strong>How many?</strong><small>Choose the number of units</small></div><Quantity count={quantity} setCount={x => setQuantity(Math.min(10, Math.max(1, x)))} /></div>{error && <ErrorBanner message={error} />}<div className="modal-total"><span>Total</span><strong>{money(sku.price * quantity * (1 - sku.discountPct / 100))}</strong></div><button className="button button-dark button-full" disabled={busy} onClick={() => void addItem()}>{busy ? 'Adding…' : 'Add to cart'} <ArrowRight size={17} /></button></section></div>
}
function Quantity({ count, setCount }: { count: number; setCount: (value: number) => void }) { return <div className="quantity-control"><button onClick={() => setCount(count - 1)} aria-label="Decrease quantity"><Minus size={14} /></button><span>{count}</span><button onClick={() => setCount(count + 1)} aria-label="Increase quantity"><Plus size={14} /></button></div> }
function ListingCard({ listing }: { listing: PartnerListing }) { return <article className="listing-card">{listing.imageUrl ? <img className="listing-image" src={listing.imageUrl} alt="" /> : <div className="listing-image listing-placeholder"><Sparkles size={25} /></div>}<div className="listing-card-body"><span className="listing-category">{listing.categoryName}</span><h3>{listing.title}</h3><p>{listing.description}</p><div className="service-meta"><span><BadgeCheck size={14} /> Partner approved</span><strong>{money(listing.price)}{listing.strikePrice > listing.price && <del>{money(listing.strikePrice)}</del>}</strong></div>{listing.serviceSlug && <Link className="button button-outline button-full" to={`/service/${listing.serviceSlug}`}>View service <ArrowRight size={15} /></Link>}</div></article> }

function CartPage() {
  const { items, subtotal, total, discount, setQuantity, remove } = useCart(); const { user } = useAuth(); const [suggestions, setSuggestions] = useState<ServiceSummary[]>([])
  useEffect(() => { void endpoints.cities().then(rows => rows[0] ? endpoints.categories(rows[0].slug) : []).then(cats => cats[0] ? endpoints.services(cats[0].slug) : []).then(setSuggestions).catch(() => undefined) }, [])
  return <div className="page-container"><Breadcrumbs label="Your cart" /><SectionHeading eyebrow="ONE MORE THING" title="Your cart" subtitle="Take a look at what you’ve picked." />{!items.length ? <div className="empty-cart"><span className="empty-cart-icon"><ShoppingBag size={30} /></span><h2>Your cart is having a quiet moment.</h2><p>Browse services and add something you need around the house.</p><Link className="button button-dark" to="/home-services">Explore services <ArrowRight size={16} /></Link></div> : <div className="cart-layout"><div className="cart-main"><div className="cart-savings"><Sparkles size={18} /> You’re saving {money(discount)} on this order</div><div className="cart-lines">{items.map(item => <article className="cart-line" key={item.id}><div className="cart-line-art">{/AC/i.test(item.skuName) ? '❄️' : '🛠️'}</div><div className="cart-line-details"><span className="listing-category">HOME SERVICE</span><h3>{item.skuName}</h3><p>Professional service · at your chosen address</p><button className="remove-button" onClick={() => void remove(item)}><Trash2 size={14} /> Remove</button></div><div className="cart-line-end"><Quantity count={item.quantity} setCount={n => void setQuantity(item, n)} /><strong>{money(item.lineTotal)}</strong>{item.discountPct > 0 && <del>{money(item.unitPrice * item.quantity)}</del>}</div></article>)}</div>
      {!!suggestions.length && <section className="recommendations"><div className="recommendation-heading"><div><span className="eyebrow">A FEW MORE GOOD THINGS</span><h2>People also book</h2></div><span className="muted">Add only what you need</span></div><div className="recommendation-grid">{suggestions.slice(0, 3).map((s, i) => <ServiceCard service={s} index={i} key={s.id} />)}</div></section>}
    </div><aside className="cart-summary"><div className="summary-head"><span className="eyebrow">ORDER SUMMARY</span><h2>Payment summary</h2></div><SummaryRows subtotal={subtotal} discount={discount} total={total} /><div className="summary-reassure"><ShieldCheck size={17} /> Secure booking, no hidden fees</div><Link to="/checkout" className="button button-dark button-full">Continue to checkout <ArrowRight size={17} /></Link>{!user && <p className="summary-hint">Sign in at checkout. Your cart will be saved.</p>}</aside></div>}{items.length > 0 && <div className="mobile-cart-cta"><span>{money(total)} <small>· {items.length} items</small></span><Link className="button button-dark" to="/checkout">Checkout <ArrowRight size={15} /></Link></div>}</div>
}
function SummaryRows({ subtotal, discount, total }: { subtotal: number; discount: number; total: number }) { return <><div className="summary-row"><span>Item total</span><strong>{money(subtotal)}</strong></div>{discount > 0 && <div className="summary-row green"><span>Discount</span><strong>−{money(discount)}</strong></div>}<div className="summary-row"><span>Taxes and fee</span><strong>Calculated at checkout</strong></div><div className="summary-total"><span>Estimated total</span><strong>{money(total)}</strong></div></> }

function CheckoutPage() {
  const auth = useAuth(); const cart = useCart(); const { user } = auth; const { city } = useLocationState(); const [addresses, setAddresses] = useState<Address[]>([]); const [addressId, setAddressId] = useState(''); const [slot, setSlot] = useState(''); const [addingAddress, setAddingAddress] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const navigate = useNavigate()
  useEffect(() => { if (user) void endpoints.addresses().then(rows => { setAddresses(rows); setAddressId(rows.find(x => x.isDefault)?.id || rows[0]?.id || '') }).catch(e => setError(e.message)) }, [user])
  const times = useMemo(() => { const result: { value: string; label: string }[] = []; const now = new Date(); for (let day = 0; day < 5; day++) for (const hour of [10, 13, 16, 19]) { const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour); if (dt > new Date(Date.now() + 3600000)) result.push({ value: dt.toISOString(), label: `${day === 0 ? 'Today' : day === 1 ? 'Tomorrow' : dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${dt.toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true })}` }) } return result }, [])
  const signInAtCheckout = () => { sessionStorage.setItem('plutonea.post-oauth-path', '/checkout'); sessionStorage.removeItem('haven.post-oauth-path'); window.location.assign(googleSignInUrl) }
  const book = async () => {
    if (!addressId || !slot) { setError('Choose a service address and appointment time to continue.'); return }
    if (!cart.items.length) { navigate('/home-services'); return }
    setBusy(true); setError('')
    try {
      const idempotencyKey = sessionStorage.getItem('plutonea.pending-booking-key') || sessionStorage.getItem('haven.pending-booking-key') || crypto.randomUUID()
      sessionStorage.setItem('plutonea.pending-booking-key', idempotencyKey)
      const booking = await endpoints.createBooking(addressId, slot, idempotencyKey)
      const order = await endpoints.createPayment(booking.id)
      if (order.gatewayOrderId.startsWith('order_mock_')) { await endpoints.verifyPayment(order.gatewayOrderId, `pay_mock_${Date.now()}`, 'mock_signature'); sessionStorage.removeItem('plutonea.pending-booking-key'); sessionStorage.removeItem('haven.pending-booking-key'); await auth.refreshCart(); navigate('/bookings?placed=1'); return }
      setError('Your booking and payment order are ready, but the external payment handoff is not enabled yet. You can safely retry after checkout is configured; the same booking will be reused.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <div className="page-container checkout-container"><Breadcrumbs label="Checkout" /><SectionHeading eyebrow="ALMOST THERE" title="Checkout" subtitle="Confirm where and when we should come by." /><div className="checkout-grid"><div className="checkout-main">
    {!user ? <section className="checkout-card account-checkout"><div className="checkout-card-heading"><span className="step-number">01</span><div><h2>Your account</h2><p>Sign in securely to save your booking.</p></div></div><button className="button button-dark" onClick={signInAtCheckout}><span className="google-g">G</span> Continue with Google <ArrowRight size={16}/></button></section> : <>
      <section className="checkout-card"><div className="checkout-card-heading"><span className="step-number">01</span><div><h2>Service address</h2><p>Choose where the professional should arrive.</p></div><button className="text-button" onClick={() => setAddingAddress(true)}><Plus size={15} /> Add new</button></div>{addresses.length ? <div className="address-choice-list">{addresses.map(a => <button className={`address-choice ${addressId === a.id ? 'address-selected' : ''}`} key={a.id} onClick={() => setAddressId(a.id)}><span className="radio-dot" /><span className="address-icon"><MapPin size={17} /></span><span className="address-copy"><strong>{a.label}{a.isDefault && <em>DEFAULT</em>}</strong><small>{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.pincode}</small></span>{addressId === a.id && <span className="address-check"><Check size={17} /></span>}</button>)}</div> : <div className="empty-address"><MapPin /><div><strong>No saved address yet</strong><p>Add an address to schedule your service.</p></div><button className="button button-outline" onClick={() => setAddingAddress(true)}>Add address</button></div>}</section>
      <section className="checkout-card"><div className="checkout-card-heading"><span className="step-number">02</span><div><h2>Pick a time</h2><p>Choose an appointment window that works for you.</p></div></div><div className="slot-grid">{times.slice(0, 12).map(x => <button key={x.value} className={`slot-option ${slot === x.value ? 'slot-selected' : ''}`} onClick={() => setSlot(x.value)}><Clock3 size={15} />{x.label}</button>)}</div></section>
      <div className="checkout-secure-note"><ShieldCheck size={19} /><span><strong>You’re in good hands.</strong><small>We’ll share your booking details with the selected professional.</small></span></div><button className="button button-dark button-full place-order" onClick={() => void book()} disabled={busy || !cart.items.length}>{busy ? 'Preparing your booking…' : `Confirm booking · ${money(cart.total)}`} <ArrowRight size={17} /></button>
    </>}{error && <ErrorBanner message={error} />}
  </div><aside className="checkout-summary"><div className="summary-head"><span className="eyebrow">YOUR SELECTION</span><h2>{cart.items.length} {cart.items.length === 1 ? 'service' : 'services'}</h2></div>{cart.items.map(i => <div className="checkout-item" key={i.id}><span><strong>{i.skuName}</strong><small>Qty {i.quantity}</small></span><b>{money(i.lineTotal)}</b></div>)}<SummaryRows subtotal={cart.subtotal} discount={cart.discount} total={cart.total} /><p className="summary-hint">Payment is securely processed when your booking is placed.</p><Link to="/cart" className="edit-cart-link"><ArrowLeft size={15} /> Back to cart</Link></aside></div>{addingAddress && <AddAddressModal city={city} onClose={() => setAddingAddress(false)} onSaved={async () => { const rows = await endpoints.addresses(); setAddresses(rows); setAddressId(rows.find(x => x.isDefault)?.id || rows[rows.length - 1]?.id || ''); setAddingAddress(false) }} />}</div>
}

function AddAddressModal({ city, onClose, onSaved }: { city: City | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const { selectedPlace } = useLocationState()
  const [label, setLabel] = useState('Home'); const [line1, setLine1] = useState(selectedPlace?.displayName || ''); const [line2, setLine2] = useState(''); const [pincode, setPincode] = useState(selectedPlace?.postcode || ''); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setError(''); try { await endpoints.addAddress({ label, line1, line2: line2 || null, pincode, lat: selectedPlace?.lat ?? city?.centerLat ?? 19.076, lng: selectedPlace?.lng ?? city?.centerLng ?? 72.877, isDefault: false }); await onSaved() } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  return <div className="modal-scrim"><section className="modal-card form-modal"><div className="modal-heading"><div><span className="eyebrow">YOUR PLACES</span><h2>Add an address</h2></div><button className="icon-button" onClick={onClose}><X /></button></div><form onSubmit={submit} className="stack-form"><label>Save this place as<select value={label} onChange={e => setLabel(e.target.value)}><option>Home</option><option>Work</option><option>Other</option></select></label><label>Address line<input value={line1} onChange={e => setLine1(e.target.value)} required placeholder="House, building, street" /></label><label>Area, landmark (optional)<input value={line2} onChange={e => setLine2(e.target.value)} placeholder="Neighbourhood or nearby landmark" /></label><label>PIN code<input value={pincode} onChange={e => setPincode(e.target.value)} required pattern="[0-9]{6}" maxLength={6} placeholder="6-digit PIN code" /></label><small className="muted">{selectedPlace ? 'Coordinates use the place you selected.' : 'Coordinates use the selected service city.'}</small>{error && <ErrorBanner message={error} />}<button className="button button-dark button-full" disabled={busy}>{busy ? 'Saving…' : 'Save address'} <ArrowRight size={16} /></button></form></section></div>
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const location = useLocation()
  const [policy, setPolicy] = useState<'terms' | 'privacy' | null>(() => location.hash === '#terms' || location.hash === '#privacy' ? location.hash.slice(1) as 'terms' | 'privacy' : null)
  const policyCloseRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!policy) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    policyCloseRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closePolicy() }
    window.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown) }
  }, [policy])
  const closePolicy = () => { setPolicy(null); window.history.replaceState(null, '', `${location.pathname}${location.search}`) }
  const oauthError = new URLSearchParams(location.search).get('oauth_error')
  const message = oauthError ? 'Google sign-in could not be completed. Please try again.' : ''
  const beginOAuth = () => {
    sessionStorage.setItem('plutonea.post-oauth-path', new URLSearchParams(location.search).get('return') || (mode === 'register' ? '/profile' : '/'))
    sessionStorage.removeItem('haven.post-oauth-path')
    window.location.assign(googleSignInUrl)
  }
  return <div className="auth-page">
    <section className="auth-story" aria-labelledby="auth-story-title">
      <Link to="/classifieds" className="brand brand-light"><span className="brand-mark">p</span><span>plutonea<span className="brand-dot">.</span></span></Link>
      <span className="eyebrow">ONE ACCOUNT · TWO WAYS TO FIND MORE</span>
      <h1 id="auth-story-title">Good help.<br />Great finds.</h1>
      <p className="auth-story-intro">Plutonea brings trusted home services and local discoveries together in one simple account.</p>
      <div className="auth-offerings">
        <article className="auth-offering"><span className="auth-offering-icon"><House size={19} /></span><div><strong>Home Services</strong><p>Find and book help for the everyday jobs around your home.</p></div></article>
        <article className="auth-offering"><span className="auth-offering-icon"><Store size={19} /></span><div><strong>Next Deal</strong><p>Discover local ads, post your own, and chat directly with people.</p></div></article>
      </div>
      <div className="auth-story-bottom"><span><ShieldCheck size={17} /> Secure Google sign-in</span><span><Star fill="currentColor" size={15} /> One profile across Plutonea</span></div>
    </section>
    <section className="auth-form-side" aria-label="Sign in and Plutonea information"><div className="auth-box">
      <Link to="/classifieds" className="mobile-auth-brand"><span className="brand-mark">p</span> plutonea.</Link>
      <span className="eyebrow">{mode === 'login' ? 'WELCOME TO PLUTONEA' : 'CREATE YOUR PLUTONEA ACCOUNT'}</span>
      <h2>{mode === 'login' ? 'One account for it all.' : 'Get started securely.'}</h2>
      <p className="auth-intro">Continue with Google to book services, post a Next Deal ad, or chat with a buyer or seller.</p>
      {message && <ErrorBanner message={message} />}
      <button className="button button-dark button-full" onClick={beginOAuth}><span className="google-g">G</span> Continue with Google <ArrowRight size={16} /></button>
      <section className="auth-company-note"><span className="auth-company-label">ABOUT PLUTONEA</span><p>We connect people with useful home services and a place to discover or share local listings.</p></section>
      <p className="auth-terms">By continuing, you agree to the <a href="#terms" onClick={() => setPolicy('terms')}>Terms</a> and acknowledge the <a href="#privacy" onClick={() => setPolicy('privacy')}>Privacy Policy</a>.</p>
    </div></section>
    {policy && <div className="modal-scrim auth-policy-scrim" role="presentation" onClick={event => { if (event.target === event.currentTarget) closePolicy() }}><section className="modal-card auth-policy-modal" role="dialog" aria-modal="true" aria-labelledby="auth-policy-title" aria-describedby="auth-policy-intro"><div className="modal-heading"><div><span className="eyebrow">PLUTONEA · {policy === 'terms' ? 'TERMS OF USE' : 'PRIVACY'}</span><h2 id="auth-policy-title">{policy === 'terms' ? 'Terms of Use' : 'Privacy Policy'}</h2></div><button ref={policyCloseRef} type="button" className="icon-button" onClick={closePolicy} aria-label="Close policy"><X /></button></div>
      <div className="auth-policy-content" id="auth-policy-intro">{policy === 'terms' ? <>
        <p className="auth-policy-lead">Plutonea brings Home Services and Next Deal together. These terms explain the basic rules for using both parts of the platform.</p>
        <h3>1. Your account</h3><p>Sign in with your own Google account and keep your profile information accurate. You are responsible for activity carried out through your account. Do not impersonate another person or use the platform to break the law or harm others.</p>
        <h3>2. Home Services</h3><p>Plutonea helps customers discover and book services offered by service partners. Review the service, price, schedule, address, and any displayed cancellation terms before confirming a booking. Partners are responsible for the services they provide; Plutonea may review partner applications and service listings before making them available.</p>
        <h3>3. Next Deal listings and chats</h3><p>Users may post genuine, lawful ads and contact other users through chat. Provide accurate descriptions and images, and only post content you have the right to share. Buyers and sellers arrange item inspection, test drives, payment, and handover directly with each other. Plutonea does not collect payment for Next Deal transactions.</p>
        <h3>4. Safety and moderation</h3><p>Do not post misleading, unlawful, abusive, or unsafe content. Plutonea may review, limit, or remove content or access when needed to protect users, enforce these terms, or comply with law.</p>
        <h3>5. Platform availability</h3><p>We work to keep Plutonea available and useful, but some features may change or be temporarily unavailable for maintenance, security, or operational reasons.</p>
      </> : <>
        <p className="auth-policy-lead">This policy describes the information Plutonea uses to provide Home Services and Next Deal features.</p>
        <h3>1. Information you provide</h3><p>When you sign in, Google shares basic account information such as your name, email address, and profile image. You may also provide a phone number, service address, booking details, ad text and images, and chat messages.</p>
        <h3>2. How information is used</h3><p>We use this information to create and secure your account, show services and ads for your selected area, manage bookings, publish and moderate listings, enable chats, and provide support and platform safety.</p>
        <h3>3. Who may receive information</h3><p>Information is shared as needed to provide a feature you use: a service partner receives relevant booking details; chat participants see messages exchanged in that conversation; and a payment provider processes Home Services payments when applicable. Next Deal payments are arranged directly between buyers and sellers and are not processed by Plutonea.</p>
        <h3>4. Location and public content</h3><p>Your selected city and service address help with local discovery and bookings. Ads and images you submit may be visible to other users. Avoid including private or sensitive information in public listings.</p>
        <h3>5. Retention and your choices</h3><p>We keep information for as long as needed to operate the platform, maintain account and transaction records, resolve disputes, and meet legal obligations. You can review or update available profile information in the app. Some records may need to be retained where required for legitimate operational or legal reasons.</p>
        <h3>6. Security and questions</h3><p>We use safeguards designed to protect account and platform information. No online service can guarantee absolute security. For a privacy request or question, contact Plutonea using the support contact published for the service.</p>
      </>}</div>
      <p className="auth-policy-footnote">Plutonea may update these terms and notices as the service evolves. Check this page for the current version.</p>
    </section></div>}
  </div>
}

function RequireUser({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, ready } = useAuth(); const location = useLocation()
  if (!ready) return <div className="page-container"><LoadingCard /></div>
  if (!user) return <div className="page-container auth-required"><span className="empty-cart-icon"><UserRound /></span><h2>Sign in to continue</h2><p>This page is part of your Plutonea account.</p><Link className="button button-dark" to={`/login?return=${encodeURIComponent(location.pathname)}`}>Sign in <ArrowRight size={16} /></Link></div>
  const customerCapability = roles?.includes('Customer') && user.role === 'Professional'
  if (roles && !roles.includes(user.role) && !customerCapability && !(roles.includes('Admin') && isAdmin(user.role))) return <div className="page-container"><ErrorBanner message="Your account does not have access to this area." /></div>
  if (!isAdmin(user.role) && !user.profileComplete && location.pathname !== '/profile') return <div className="page-container auth-required"><span className="empty-cart-icon"><UserRound /></span><h2>Finish setting up your profile</h2><p>Add your full name, mobile number, gender, and current location. Your verified sign-in email identifies your account.</p><Link className="button button-dark" to={`/profile?return=${encodeURIComponent(location.pathname + location.search)}`}>Complete profile <ArrowRight size={16} /></Link></div>
  return <>{children}</>
}

function BookingsPage() {
  const { ready } = useAuth(); const [rows, setRows] = useState<Booking[]>([]); const [error, setError] = useState(''); const placed = new URLSearchParams(useLocation().search).has('placed')
  useEffect(() => { if (ready) void endpoints.bookings().then(x => setRows(x.items || [])).catch(e => setError(e.message)) }, [ready])
  return <RequireUser roles={['Customer']}><div className="page-container"><SectionHeading eyebrow="YOUR HOME, ALL IN ONE PLACE" title="My bookings" subtitle="Your upcoming services and past visits." />{placed && <div className="booking-success"><span><Check /></span><div><strong>Your booking is confirmed.</strong><p>We’ve saved the details. You can review your appointment below.</p></div></div>}{error && <ErrorBanner message={error} />}{rows.length ? <div className="booking-list">{rows.map(b => <article className="booking-card" key={b.id}><div className="booking-date"><CalendarDays /><span>{new Date(b.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></div><div className="booking-main"><span className="listing-category">BOOKING {b.bookingNo}</span><h3>{b.items?.map(i => i.serviceName).join(', ') || 'Home service'}</h3><p>{new Date(b.scheduledAt).toLocaleString('en-IN', { weekday: 'long', hour: 'numeric', minute: '2-digit' })}</p></div><span className={`status-pill status-${b.status.toLowerCase()}`}>{b.status}</span><strong>{money(b.total)}</strong></article>)}</div> : !error && <div className="empty-state"><CalendarDays /><h3>No bookings yet</h3><p>Looks like you haven’t booked a service. Explore what’s available in your city.</p><Link className="button button-dark" to="/home-services">Explore services <ArrowRight size={16} /></Link></div>}</div></RequireUser>
}

function ProfilePage() {
  const auth = useAuth(); const { user } = auth; const navigate = useNavigate(); const route = useLocation()
  const { city, locationLabel } = useLocationState()
  const [name, setName] = useState(user?.fullName || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [gender, setGender] = useState(user?.gender || '')
  const [currentLocation, setCurrentLocation] = useState(user?.currentLocation || locationLabel || city?.name || '')
  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressError, setAddressError] = useState('')
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const loadAddresses = async () => {
    try { setAddresses(await endpoints.addresses()); setAddressError('') }
    catch (e) { setAddressError((e as Error).message) }
  }
  useEffect(() => {
    if (!user) return
    setName(user.fullName || ''); setPhone(user.phone || ''); setGender(user.gender || '')
    setCurrentLocation(user.currentLocation || locationLabel || city?.name || '')
    void loadAddresses()
  }, [user?.id])
  const setField = (field: string, setter: (value: string) => void, value: string) => {
    setter(value)
    setFieldErrors(previous => ({ ...previous, [field]: '' }))
    setMessage('')
  }
  useEffect(() => {
    const onLocationSelected = (event: Event) => {
      const place = (event as CustomEvent<string>).detail
      if (place) setField('currentLocation', setCurrentLocation, place)
    }
    window.addEventListener('plutonea:location-selected', onLocationSelected)
    return () => window.removeEventListener('plutonea:location-selected', onLocationSelected)
  }, [])
  const validate = () => {
    const errors: Record<string, string> = {}
    const cleanName = name.trim()
    const cleanPhone = phone.trim().replace(/[\s()-]/g, '')
    const cleanLocation = currentLocation.trim()
    if (cleanName.length < 2) errors.name = 'Enter your full name (at least 2 characters).'
    else if (cleanName.length > 150) errors.name = 'Name must be 150 characters or fewer.'
    if (!/^\+?[1-9]\d{9,14}$/.test(cleanPhone)) errors.phone = 'Enter a valid number with country code, for example +919876543210.'
    if (!['Male', 'Female', 'Other', 'Prefer not to say'].includes(gender)) errors.gender = 'Choose an option to continue.'
    if (cleanLocation.length < 3) errors.currentLocation = 'Enter an area, locality, or city (at least 3 characters).'
    else if (cleanLocation.length > 300) errors.currentLocation = 'Location must be 300 characters or fewer.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }
  const saveProfile = async (e: FormEvent) => {
    e.preventDefault(); setMessage('')
    if (!validate()) { setMessage('Please fix the highlighted fields.'); return }
    setSaving(true)
    try {
      const cleanPhone = phone.trim().replace(/[\s()-]/g, '')
      await endpoints.updateProfile({ fullName: name.trim(), phone: cleanPhone, gender, currentLocation: currentLocation.trim(), cityId: city?.id || user?.cityId || null })
      await auth.refreshUser()
      const returnTo = new URLSearchParams(route.search).get('return')
      setMessage(user?.emailVerified === false ? 'Profile saved. Verify your sign-in email before posting ads.' : 'Profile saved. You can now post ads and contact sellers.')
      if (user?.emailVerified && returnTo?.startsWith('/') && !returnTo.startsWith('//')) navigate(returnTo)
    } catch (e) { setMessage((e as Error).message) } finally { setSaving(false) }
  }
  const missingItems = [
    !user?.emailVerified && 'Verified sign-in email', !name.trim() && 'Full name',
    !phone.trim() && 'Mobile number', !gender && 'Gender', !currentLocation.trim() && 'Current location'
  ].filter(Boolean) as string[]
  const fieldError = (field: string) => fieldErrors[field] ? <span className="profile-field-error" id={`profile-${field}-error`} role="alert">{fieldErrors[field]}</span> : null
  return <RequireUser><div className="page-container profile-page"><SectionHeading eyebrow="YOUR PLUTONEA ACCOUNT" title="My profile" subtitle="Add a few details once to post ads, contact sellers, and book services." /><div className="profile-grid"><section className="panel-card profile-main-card"><div className="panel-heading"><div className="large-avatar">{(user?.fullName || 'P').slice(0, 1).toUpperCase()}</div><div><h2>{user?.fullName || 'Your profile'}</h2><p>{user?.email}</p></div><span className={`status-pill ${user?.profileComplete ? 'status-approved' : 'status-pending'}`}>{user?.profileComplete ? 'Complete' : 'Finish profile'}</span></div>
    {!user?.profileComplete && <div className="profile-completion-note"><strong>Complete your profile to unlock posting</strong><span>{missingItems.length ? `Still needed: ${missingItems.join(', ')}.` : 'Save your details to continue.'}</span></div>}
    <form className="stack-form profile-completion-form" onSubmit={saveProfile} noValidate>
      <label htmlFor="profile-name">Full name</label><input id="profile-name" value={name} onChange={e => setField('name', setName, e.target.value)} maxLength={150} autoComplete="name" placeholder="Enter your full name" required aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? 'profile-name-error' : undefined} />{fieldError('name')}
      <label htmlFor="profile-email">Email address</label><input id="profile-email" value={user?.email || ''} disabled /><small className="profile-help-text">This sign-in email identifies your Plutonea account.</small>
      <label htmlFor="profile-phone">Mobile number</label><input id="profile-phone" type="tel" inputMode="tel" value={phone} onChange={e => setField('phone', setPhone, e.target.value)} placeholder="+919876543210" autoComplete="tel" maxLength={20} required aria-invalid={!!fieldErrors.phone} aria-describedby={fieldErrors.phone ? 'profile-phone-error' : 'profile-phone-help'} />{fieldError('phone')}<small className="profile-help-text" id="profile-phone-help">Include your country code. No verification code is sent; this number is for account contact.</small>
      <label htmlFor="profile-gender">Gender</label><select id="profile-gender" value={gender} onChange={e => setField('gender', setGender, e.target.value)} required aria-invalid={!!fieldErrors.gender} aria-describedby={fieldErrors.gender ? 'profile-gender-error' : undefined}><option value="">Select an option</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option></select>{fieldError('gender')}
      <div className="profile-location-label"><label htmlFor="profile-location">Current location / area</label><button type="button" className="profile-location-select" onClick={() => window.dispatchEvent(new Event('plutonea:open-location'))}><MapPin size={15} /> Choose location</button></div>
      <input id="profile-location" value={currentLocation} onChange={e => setField('currentLocation', setCurrentLocation, e.target.value)} maxLength={300} autoComplete="street-address" placeholder="Area, city, state" required aria-invalid={!!fieldErrors.currentLocation} aria-describedby={fieldErrors.currentLocation ? 'profile-currentLocation-error' : 'profile-location-help'} />{fieldError('currentLocation')}
      <small className="profile-help-text" id="profile-location-help">Choose a place to fill this field automatically, or type your area and city.</small>
      <button className="button button-dark profile-save-button" disabled={saving}>{saving ? 'Saving profile…' : 'Save profile'} <Check size={16} /></button>
      {message && <p className={message.startsWith('Profile saved') ? 'success-note' : 'error-banner'} role={message.startsWith('Profile saved') ? 'status' : 'alert'}>{message}</p>}
    </form>
  </section><section className="panel-card profile-address-card"><div className="panel-title-row"><div><span className="eyebrow">DELIVERY DETAILS</span><h2>Saved addresses</h2><p className="profile-help-text">Useful for faster Home Service bookings.</p></div><button className="button button-outline" onClick={() => setAdding(true)}><Plus size={16} /> Add address</button></div>{addressError && <ErrorBanner message={`Could not load saved addresses: ${addressError}`} />}{addresses.length ? <div className="profile-addresses">{addresses.map(a => <div className="profile-address" key={a.id}><span className="address-icon"><MapPin /></span><div><strong>{a.label}{a.isDefault && <em>DEFAULT</em>}</strong><p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.pincode}</p></div><button className="icon-button danger-icon" aria-label="Remove address" onClick={async () => { try { await endpoints.deleteAddress(a.id); await loadAddresses() } catch (e) { setAddressError((e as Error).message) } }}><Trash2 size={16} /></button></div>)}</div> : !addressError && <p className="muted">No saved addresses yet. You can add one when you book a Home Service.</p>}</section></div>{adding && <AddAddressModal city={city} onClose={() => setAdding(false)} onSaved={async () => { await loadAddresses(); setAdding(false) }} />}</div></RequireUser>
}
function PartnerPage() {
  const { user } = useAuth(); const { city } = useLocationState(); const [application, setApplication] = useState<PartnerApplication | null>(null); const [editingApplication, setEditingApplication] = useState<PartnerApplication | null>(null); const [hasServiceAddress, setHasServiceAddress] = useState<boolean | null>(null); const [listings, setListings] = useState<PartnerListing[]>([]); const [jobs, setJobs] = useState<Booking[]>([]); const [available, setAvailable] = useState(true); const [categories, setCategories] = useState<Category[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [editing, setEditing] = useState<PartnerListing | null>(null)
  const reload = async () => { setLoading(true); setError(''); try { if (user?.role === 'Professional') { const [posts, assigned, currentApplication] = await Promise.all([endpoints.myListings(), endpoints.partnerJobs(), endpoints.myApplication()]); setListings(posts); setJobs(assigned); setApplication(currentApplication) } else if (user?.role === 'Customer') setApplication(await endpoints.myApplication()) } catch (e) { setError((e as Error).message) } finally { setLoading(false) } }
  useEffect(() => {
    void reload()
    setHasServiceAddress(null)
    void endpoints.profileCompletion().then(profile => setHasServiceAddress(profile.hasAddress)).catch(e => { setHasServiceAddress(false); setError((e as Error).message) })
    void endpoints.cities().then(cities => { const selected = cities.find(c => c.id === city?.id) || cities.find(c => c.slug === 'mumbai') || cities[0]; return selected ? endpoints.categories(selected.slug) : [] }).then(setCategories).catch(e => setError((e as Error).message))
  }, [user?.id, city?.id])
  if (!user) return <RequireUser>{null}</RequireUser>
  if (user.role !== 'Professional') return <RequireUser roles={['Customer']}><div className="page-container partner-pending"><SectionHeading eyebrow="PARTNER ONBOARDING" title="Build your business with Plutonea." subtitle="Share your service with local customers. Our team reviews partner accounts before publishing." />
    {error && <ErrorBanner message={error} />}{loading ? <LoadingCard /> : application ? <><div className="application-status-card"><span className={`status-orb status-${application.status.toLowerCase()}`}><ShieldCheck /></span><div><span className="eyebrow">APPLICATION STATUS</span><h2>{application.status === 'Approved' ? 'You’re approved.' : application.status === 'Rejected' ? 'A little more information is needed.' : 'Your application is with our team.'}</h2><p>{application.reviewNote || (application.status === 'Approved' ? 'You can now create service listings for admin review.' : 'We’ll review your details and update this page when there’s news.')}</p>{application.status !== 'Rejected' && <PartnerApplicationSummary application={application} />}</div><span className={`status-pill status-${application.status.toLowerCase()}`}>{application.status}</span>{(application.status === 'Submitted' || application.status === 'UnderReview') && <button className="button button-outline" onClick={() => setEditingApplication(application)}>Edit application</button>}{application.status === 'Rejected' && <button className="button button-dark" onClick={() => setApplication(null)}>Update and resubmit <ArrowRight size={16} /></button>}{application.status === 'Approved' && <button className="button button-dark" onClick={() => window.location.reload()}>Open partner dashboard <ArrowRight size={16} /></button>}</div>{editingApplication && <PartnerSignupCard key={editingApplication.id} categories={categories} onSubmitted={async () => { setEditingApplication(null); await reload() }} hasServiceAddress={hasServiceAddress === true} prerequisiteLoading={hasServiceAddress === null} existingApplication={editingApplication} onCancel={() => setEditingApplication(null)} />}</> : <PartnerSignupCard categories={categories} onSubmitted={reload} hasServiceAddress={hasServiceAddress === true} prerequisiteLoading={hasServiceAddress === null} />}
    <div className="partner-benefits"><PromiseItem icon={<UserRound />} title="Reach nearby customers" text="Show approved services to people in your service city." /><PromiseItem icon={<CreditCard />} title="Manage your listings" text="Update descriptions, pricing and availability." /><PromiseItem icon={<ShieldCheck />} title="Work with trust" text="Every listing is reviewed before it goes live." /></div></div></RequireUser>
  const applicationApproved = application?.status === 'Approved'
  const approvedCategoryIds = applicationApproved ? readApplicationCategoryIds(application) : []
  const listingCategories = categories.filter(category => approvedCategoryIds.includes(category.id))
  const openListingEditor = () => {
    if (!listingCategories.length) {
      setError('No active category matches your approved partner profile. Please request a service category change and wait for admin approval.')
      return
    }
    const category = listingCategories[0]
    setEditing({ id: '', partnerUserId: '', partnerName: '', partnerEmail: '', categoryId: category.id, categoryName: category.name, title: '', description: '', price: 0, strikePrice: 0, durationMins: 60, status: 'Pending', createdAt: '' })
  }
  return <RequireUser roles={['Professional']}><div className="page-container dashboard-page"><div className="dashboard-top"><SectionHeading eyebrow="PARTNER STUDIO" title={`Good to have you, ${user.fullName.split(' ')[0]}.`} subtitle="Manage your service listings and assigned jobs." /><button className="button button-dark" onClick={openListingEditor} disabled={!applicationApproved}><Plus size={16} /> Post a service</button></div>{error && <ErrorBanner message={error} />}{application && <div className="application-status-card"><span className={`status-orb status-${application.status.toLowerCase()}`}><ShieldCheck /></span><div><span className="eyebrow">{application.status === 'Approved' ? 'APPROVED SERVICE PROFILE' : 'PARTNER PROFILE · STATUS'}</span><h2>{application.status === 'Approved' ? 'Your service profile is approved.' : application.status === 'Rejected' ? 'Update your service profile and resubmit.' : 'Service profile changes are under review.'}</h2><p>{application.status === 'Approved' ? 'You can post service ads. If you change your main category or service, the new selection must be approved before you can post again.' : application.status === 'Rejected' ? (application.reviewNote || 'The admin requested changes. Update your service details and submit them again for review.') : 'New Home Service ads are paused until an admin approves your updated category and service.'}</p><PartnerApplicationSummary application={application} /></div><span className={`status-pill status-${application.status.toLowerCase()}`}>{application.status}</span>{application.status === 'Approved' && <button className="button button-outline" onClick={() => setEditingApplication(application)}>Request service change</button>}{(application.status === 'Submitted' || application.status === 'UnderReview' || application.status === 'Rejected') && <button className="button button-outline" onClick={() => setEditingApplication(application)}>{application.status === 'Rejected' ? 'Update and resubmit' : 'Edit pending changes'}</button>}</div>}{editingApplication && <PartnerSignupCard key={editingApplication.id} categories={categories} onSubmitted={async () => { setEditingApplication(null); await reload() }} hasServiceAddress={hasServiceAddress === true} prerequisiteLoading={hasServiceAddress === null} existingApplication={editingApplication} onCancel={() => setEditingApplication(null)} />}<div className="dashboard-stats"><Stat label="Service listings" value={`${listings.length}`} icon={<ShoppingBag />} /><Stat label="Live services" value={`${listings.filter(x => x.status === 'Approved').length}`} icon={<BadgeCheck />} /><Stat label="Assigned jobs" value={`${jobs.length}`} icon={<CalendarDays />} /></div><div className="panel-card dashboard-panel"><div className="panel-title-row"><div><span className="eyebrow">YOUR SERVICES</span><h2>Listings</h2></div><button className="button button-outline" onClick={openListingEditor} disabled={!applicationApproved}><Plus size={15} /> New listing</button></div>{!applicationApproved && <p className="profile-completion-note"><strong>Service ads are paused</strong><span>Wait for admin approval of your service profile changes before creating another listing.</span></p>}{loading ? <LoadingCard /> : listings.length ? <div className="table-wrap"><table><thead><tr><th>Service</th><th>Category</th><th>Price</th><th>Status</th><th>Admin note</th><th /></tr></thead><tbody>{listings.map(x => <tr key={x.id}><td><strong>{x.title}</strong><small>{x.description.slice(0, 72)}{x.description.length > 72 ? '…' : ''}</small></td><td>{x.categoryName}</td><td>{money(x.price)}</td><td><span className={`status-pill status-${x.status.toLowerCase()}`}>{x.status}</span></td><td>{x.reviewNote || '—'}</td><td>{applicationApproved && x.status !== 'Approved' && <button className="small-action" onClick={() => setEditing(x)}>Edit</button>}</td></tr>)}</tbody></table></div> : <div className="empty-inline"><ShoppingBag /><p>No listings yet. Post your first service.</p></div>}</div>
    <div className="panel-card dashboard-panel"><div className="panel-title-row"><div><span className="eyebrow">CUSTOMER APPOINTMENTS</span><h2>Assigned jobs</h2></div><span className="status-pill status-approved">{available ? 'Available' : 'Unavailable'}</span><button className="text-button" onClick={async () => { await endpoints.setPartnerAvailability(!available); setAvailable(!available) }}>Set {available ? 'unavailable' : 'available'}</button></div>{jobs.length ? jobs.map(job => <div className="job-row" key={job.id}><div><strong>{job.items?.map(i => i.serviceName).join(', ') || 'Service booking'}</strong><small>{job.bookingNo} · {new Date(job.scheduledAt).toLocaleString()}</small></div><span className={`status-pill status-${job.status.toLowerCase()}`}>{job.status}</span><JobAction job={job} onDone={reload} /></div>) : <div className="empty-inline"><CalendarDays /><p>No jobs assigned yet.</p></div>}</div>
  </div>{editing && <ListingEditor item={editing} categories={listingCategories} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload() }} />}</RequireUser>
}

type PartnerApplicationSkill = { serviceId?: string; ServiceId?: string; serviceDescription?: string | null; ServiceDescription?: string | null }
function readApplicationSkills(application?: PartnerApplication | null): PartnerApplicationSkill[] {
  try { return application ? JSON.parse(application.skills) as PartnerApplicationSkill[] : [] } catch { return [] }
}
function readApplicationCategoryId(application?: PartnerApplication | null) {
  try { return (application ? JSON.parse(application.categoryIds) as string[] : [])[0] || '' } catch { return '' }
}
function readApplicationCategoryIds(application?: PartnerApplication | null): string[] {
  try {
    const ids = application ? JSON.parse(application.categoryIds) as unknown : []
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
  } catch { return [] }
}
function PartnerApplicationSummary({ application }: { application: PartnerApplication }) {
  const skill = readApplicationSkills(application)[0]
  const otherService = skill?.serviceDescription || skill?.ServiceDescription
  return <><p className="partner-application-summary">{otherService ? <>Requested service: <strong>{otherService}</strong></> : 'Your selected service category and main service are saved in this application.'}</p>{application.applicantRemarks?.trim() && <div className="partner-applicant-remarks"><strong>Applicant remarks</strong><p>{application.applicantRemarks}</p></div>}{application.reviewNote && <p className="review-note"><strong>{application.status === 'Approved' ? 'Admin suggestion' : 'Admin feedback'}:</strong> {application.reviewNote}</p>}</>
}

function PartnerSignupCard({ categories, onSubmitted, hasServiceAddress, prerequisiteLoading, existingApplication, onCancel }: { categories: Category[]; onSubmitted: () => Promise<void>; hasServiceAddress: boolean; prerequisiteLoading: boolean; existingApplication?: PartnerApplication; onCancel?: () => void }) {
  const savedSkill = readApplicationSkills(existingApplication)[0]
  const savedServiceId = savedSkill?.serviceId || savedSkill?.ServiceId || ''
  const [categoryId, setCategoryId] = useState(() => readApplicationCategoryId(existingApplication))
  const [serviceId, setServiceId] = useState(savedServiceId)
  const [services, setServices] = useState<ServiceSummary[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [otherServiceDescription, setOtherServiceDescription] = useState(savedSkill?.serviceDescription || savedSkill?.ServiceDescription || '')
  const [applicantRemarks, setApplicantRemarks] = useState(existingApplication?.applicantRemarks || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!categories.length) { setCategoryId(''); return }
    if (!categoryId || !categories.some(category => category.id === categoryId)) setCategoryId(categories[0].id)
  }, [categories, categoryId])

  useEffect(() => {
    let alive = true
    const selected = categories.find(category => category.id === categoryId)
    setServices([]); setServiceId(''); setError('')
    if (!selected) return () => { alive = false }
    setServicesLoading(true)
    void endpoints.services(selected.slug).then(rows => {
      if (!alive) return
      setServices(rows || [])
      setServiceId(rows?.some(service => service.id === savedServiceId) ? savedServiceId : rows?.[0]?.id || '')
      if (!rows?.length) setError('No active services are available in this category yet. Choose another category or try again later.')
    }).catch(reason => { if (alive) setError((reason as Error).message) })
      .finally(() => { if (alive) setServicesLoading(false) })
    return () => { alive = false }
  }, [categoryId, categories, savedServiceId])

  const isOtherCategory = categories.find(category => category.id === categoryId)?.slug.startsWith('other-home-services') === true

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!hasServiceAddress) { setError('Add a Home Service address to your profile before submitting this application.'); return }
    if (!categoryId || !serviceId) { setError('Choose a service category and an active service.'); return }
    if (isOtherCategory && otherServiceDescription.trim().length < 8) { setError('Describe the home service you provide in at least 8 characters.'); return }
    setBusy(true)
    try {
      if (existingApplication) await endpoints.updatePartnerApplication(existingApplication.id, [categoryId], serviceId, isOtherCategory ? otherServiceDescription.trim() : undefined, applicantRemarks.trim() || undefined)
      else await endpoints.submitPartnerApplication([categoryId], serviceId, isOtherCategory ? otherServiceDescription.trim() : undefined, applicantRemarks.trim() || undefined)
      await onSubmitted()
    }
    catch (reason) { setError((reason as Error).message) }
    finally { setBusy(false) }
  }

  return <section className="partner-apply-card">
    <div className="partner-apply-illustration"><Sparkles size={30} /><span>Good work<br />gets noticed.</span><small>Partner with Plutonea</small></div>
    <div className="partner-apply-content"><span className="eyebrow">SERVICE PARTNER APPLICATION</span><h2>{existingApplication ? 'Update your application' : 'Tell us what service you provide.'}</h2><p>{existingApplication ? 'You can change the selected category or service while the application is awaiting approval. Saving your changes returns it to the review queue.' : 'Choose your main category and service. Our team will review your application before you can publish service listings.'}</p>
      <div className="partner-application-steps"><div className="partner-step-done"><Check size={15} /><span>Your account profile</span></div><div className={hasServiceAddress ? 'partner-step-done' : 'partner-step-needed'}>{hasServiceAddress ? <Check size={15} /> : <MapPin size={15} />}<span>Home Service address {hasServiceAddress ? 'added' : 'required'}</span>{!hasServiceAddress && <Link to="/profile">Add address</Link>}</div></div>
      {prerequisiteLoading && <p className="profile-help-text">Checking your profile and service address…</p>}
      <form className="partner-application-form" onSubmit={submit}>
        <label htmlFor="partner-category">Service category<select id="partner-category" value={categoryId} onChange={event => setCategoryId(event.target.value)} required disabled={!categories.length}><option value="">{categories.length ? 'Choose a category' : 'No categories available'}</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label htmlFor="partner-service">Your main service<select id="partner-service" value={serviceId} onChange={event => setServiceId(event.target.value)} required disabled={!categoryId || servicesLoading || !services.length}><option value="">{servicesLoading ? 'Loading services…' : services.length ? 'Choose a service' : 'No services available'}</option>{services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {isOtherCategory && <label className="partner-other-description" htmlFor="partner-other-service">Describe your home service<textarea id="partner-other-service" value={otherServiceDescription} onChange={event => setOtherServiceDescription(event.target.value)} minLength={8} maxLength={300} required rows={3} placeholder="What service do you provide? Include the main work you do." /></label>}
        <label className="partner-application-remarks" htmlFor="partner-remarks">Remarks for the review team <span className="optional-label">Optional</span><textarea id="partner-remarks" value={applicantRemarks} onChange={event => setApplicantRemarks(event.target.value)} maxLength={1000} rows={4} placeholder="Add context that may help us review your application, such as your experience, service coverage, or any special details." /><small>{applicantRemarks.length}/1000 characters</small></label>
        <p className="partner-form-hint">{servicesLoading ? 'Loading available services for this category.' : isOtherCategory ? 'Your description helps the team review this service correctly.' : 'You can add more services after your partner account is approved.'}</p>
        {error && <ErrorBanner message={error} />}
        <div className="partner-application-actions">{onCancel && <button className="button button-outline" type="button" onClick={onCancel} disabled={busy}>Cancel</button>}<button className="button button-dark" type="submit" disabled={busy || prerequisiteLoading || !hasServiceAddress || !serviceId || servicesLoading}>{busy ? 'Saving…' : existingApplication ? 'Save application changes' : 'Submit for review'} <ArrowRight size={16} /></button></div>
      </form>
    </div>
  </section>
}

function ListingEditor({ item, categories, onClose, onSaved }: { item: PartnerListing; categories: Category[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [categoryId, setCategoryId] = useState(item.categoryId || categories[0]?.id || ''); const [title, setTitle] = useState(item.title); const [description, setDescription] = useState(item.description); const [imageUrl, setImageUrl] = useState(item.imageUrl || ''); const [price, setPrice] = useState(String(item.price || '')); const [strikePrice, setStrikePrice] = useState(String(item.strikePrice || item.price || '')); const [duration, setDuration] = useState(String(item.durationMins || 60)); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('')
    const offer = Number(price), list = strikePrice.trim() ? Number(strikePrice) : offer
    if (!Number.isFinite(offer) || offer <= 0) { setError('Enter an offer price greater than ₹0.'); return }
    if (!Number.isFinite(list) || list < offer) { setError('List price must be equal to or higher than the offer price.'); return }
    if (!categories.some(category => category.id === categoryId)) { setError('Choose a category from your approved partner profile.'); return }
    setBusy(true)
    const body = { categoryId, title, description, imageUrl: imageUrl || null, price: offer, strikePrice: list, durationMins: Number(duration) }
    try { if (item.id) await endpoints.updateListing(item.id, body); else await endpoints.createListing(body); await onSaved() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const selectedCategory = categories.find(category => category.id === categoryId)
  return <div className="modal-scrim"><section className="modal-card form-modal"><div className="modal-heading"><div><span className="eyebrow">PARTNER LISTING</span><h2>{item.id ? 'Edit your service' : 'Post a service'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close listing form"><X /></button></div><p className="modal-subtitle">Choose a service in your approved category. Your listing goes live after an admin review.</p><form className="stack-form" onSubmit={submit}><label>Approved service category{categories.length === 1 ? <input value={selectedCategory?.name || ''} readOnly aria-label="Approved service category" /> : <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required>{categories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</label><label>Service title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={150} required placeholder="e.g. Split AC deep clean" /></label><label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} required rows={3} placeholder="Explain the service and what is included." /></label><label>Image URL (optional)<input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://…" /></label><div className="form-inline"><label>Offer price (₹)<input type="number" min="1" step="1" value={price} onChange={e => setPrice(e.target.value)} required /></label><label>List price (₹)<input type="number" min={price || '1'} step="1" value={strikePrice} onChange={e => setStrikePrice(e.target.value)} placeholder={price || 'Optional'} /><small>Optional. If omitted, it will match the offer price.</small></label></div><label>Approximate duration (minutes)<input type="number" min="15" max="1440" step="15" value={duration} onChange={e => setDuration(e.target.value)} required /></label>{error && <ErrorBanner message={error} />}<button className="button button-dark button-full" disabled={busy || !categories.length}>{busy ? 'Submitting…' : item.id ? 'Save changes for review' : 'Submit listing for review'} <ArrowRight size={16} /></button></form></section></div>
}

function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) { return <div className="stat-card"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div> }
function JobAction({ job, onDone }: { job: Booking; onDone: () => Promise<void> }) {
  const next = job.status === 'Assigned' ? 'accept' : job.status === 'Confirmed' ? 'enroute' : job.status === 'EnRoute' ? 'start' : job.status === 'InProgress' ? 'complete' : null
  if (!next) return null
  return <button className="button button-outline button-small" onClick={async () => { await endpoints.updatePartnerJob(job.id, next); await onDone() }}>{next === 'start' ? 'Start service' : next === 'enroute' ? 'On my way' : next === 'complete' ? 'Complete job' : 'Accept job'} <ArrowRight size={14} /></button>
}

function AdminPage() {
  const [tab, setTab] = useState<'listings' | 'partners' | 'bookings' | 'catalog' | 'classifieds'>('classifieds'); const [listings, setListings] = useState<PartnerListing[]>([]); const [applications, setApplications] = useState<PartnerApplication[]>([]); const [bookings, setBookings] = useState<Booking[]>([]); const [serviceStatus, setServiceStatus] = useState(''); const [partnerStatus, setPartnerStatus] = useState(''); const [bookingStatus, setBookingStatus] = useState(''); const [error, setError] = useState(''); const [busyId, setBusyId] = useState(''); const [reviewingPartner, setReviewingPartner] = useState<{ application: PartnerApplication; approve: boolean } | null>(null)
  const load = async () => { setError(''); try { const [ads, apps, orders] = await Promise.all([endpoints.adminListings(), endpoints.adminApplications(), endpoints.adminBookings()]); setListings(ads || []); setApplications(apps || []); setBookings(orders?.items || []) } catch (e) { setError((e as Error).message) } }
  useEffect(() => { void load() }, [])
  const reviewAd = async (id: string, approve: boolean) => { setBusyId(id); try { await endpoints.reviewListing(id, approve, approve ? undefined : 'Please update the listing details and resubmit.'); await load() } catch (e) { setError((e as Error).message) } finally { setBusyId('') } }
  const reviewPartner = async (id: string, approve: boolean, feedback: string) => { setBusyId(id); try { if (approve) await endpoints.approveApplication(id, feedback); else await endpoints.rejectApplication(id, feedback); setReviewingPartner(null); await load() } catch (e) { setError((e as Error).message) } finally { setBusyId('') } }
  const pendingAds = listings.filter(x => x.status === 'Pending'); const pendingApps = applications.filter(x => x.status === 'Submitted' || x.status === 'UnderReview'); const visibleListings = listings.filter(x => !serviceStatus || x.status === serviceStatus); const visibleApplications = applications.filter(x => !partnerStatus || x.status === partnerStatus); const visibleBookings = bookings.filter(x => !bookingStatus || x.status === bookingStatus)
  return <RequireUser roles={['Admin']}><div className="page-container dashboard-page"><SectionHeading eyebrow="PLUTONEA OPERATIONS" title="Admin workspace" subtitle="Manage Home Services and Next Deal from one workspace." />{error && <ErrorBanner message={error} />}<div className="dashboard-stats"><Stat label="Pending service posts" value={`${pendingAds.length}`} icon={<ShoppingBag />} /><Stat label="Partner applications" value={`${pendingApps.length}`} icon={<UserRound />} /><Stat label="Bookings to date" value={`${bookings.length}`} icon={<CalendarDays />} /></div><div className="admin-tabs" role="tablist" aria-label="Admin workspaces">
    <button role="tab" aria-selected={tab === 'classifieds'} className={tab === 'classifieds' ? 'tab-active' : ''} onClick={() => setTab('classifieds')}><Store size={16}/>Next Deal</button>
    <button role="tab" aria-selected={tab === 'listings'} className={tab === 'listings' ? 'tab-active' : ''} onClick={() => setTab('listings')}><House size={16}/>Home Services</button>
    <button role="tab" aria-selected={tab === 'partners'} className={tab === 'partners' ? 'tab-active' : ''} onClick={() => setTab('partners')}><UserRound size={16}/>Service Partners <span>{pendingApps.length}</span></button>
    <button role="tab" aria-selected={tab === 'bookings'} className={tab === 'bookings' ? 'tab-active' : ''} onClick={() => setTab('bookings')}><CalendarDays size={16}/>Bookings</button>
    <button role="tab" aria-selected={tab === 'catalog'} className={tab === 'catalog' ? 'tab-active' : ''} onClick={() => setTab('catalog')}><Wrench size={16}/>Service catalog</button>  </div>
    {tab === 'listings' && <section className="panel-card dashboard-panel"><div className="panel-title-row"><div><span className="eyebrow">CONTENT MODERATION</span><h2>Partner service posts</h2><p>Review partner offers before they appear to customers.</p></div><div className="admin-panel-tools"><label>Show<select value={serviceStatus} onChange={e => setServiceStatus(e.target.value)}><option value="">All statuses</option>{['Pending','Approved','Rejected'].map(x => <option key={x}>{x}</option>)}</select></label><button className="text-button" onClick={() => void load()}>Refresh</button></div></div>{visibleListings.length ? <div className="review-list">{visibleListings.map(x => <article className="review-card" key={x.id}><div className="review-card-top"><div className="review-title"><span className="review-service-icon"><Sparkles /></span><div><span className="listing-category">{x.categoryName}</span><h3>{x.title}</h3><p>Submitted by {x.partnerName} · {x.partnerEmail}</p></div></div><span className={`status-pill status-${x.status.toLowerCase()}`}>{x.status}</span></div><p className="review-description">{x.description}</p><div className="review-meta"><span>Price <strong>{money(x.price)}</strong>{x.strikePrice > x.price && <del>{money(x.strikePrice)}</del>}</span><span>Duration <strong>{x.durationMins} min</strong></span><span>Submitted <strong>{new Date(x.createdAt).toLocaleDateString()}</strong></span></div>{x.reviewNote && <p className="review-note"><strong>Previous note:</strong> {x.reviewNote}</p>}{x.status === 'Pending' && <div className="review-actions"><button className="button button-outline" disabled={busyId === x.id} onClick={() => void reviewAd(x.id, false)}>Request changes</button><button className="button button-dark" disabled={busyId === x.id} onClick={() => void reviewAd(x.id, true)}>{busyId === x.id ? 'Saving…' : 'Approve and publish'} <Check size={15} /></button></div>}</article>)}</div> : <div className="empty-inline"><BadgeCheck /><p>{listings.length ? 'No service posts match this status.' : 'No service listings have been posted.'}</p></div>}</section>}
    {tab === 'partners' && <section className="panel-card dashboard-panel"><div className="panel-title-row"><div><span className="eyebrow">PARTNER REVIEW</span><h2>Applications</h2><p>Review applicant details and request any missing information before approving.</p></div><div className="admin-panel-tools"><label>Show<select value={partnerStatus} onChange={e => setPartnerStatus(e.target.value)}><option value="">All applications</option>{['Submitted','UnderReview','Approved','Rejected'].map(x => <option key={x} value={x}>{x === 'UnderReview' ? 'Under review' : x}</option>)}</select></label><button className="text-button" onClick={() => void load()}>Refresh</button></div></div>{visibleApplications.length ? <div className="review-list">{visibleApplications.map(x => <article className="review-card partner-review-card" key={x.id}><div className="review-card-top"><div className="review-title"><span className="large-avatar">{x.applicantName?.slice(0, 1).toUpperCase()}</span><div><span className="listing-category">PARTNER APPLICATION</span><h3>{x.applicantName}</h3><p>{x.applicantEmail}</p></div></div><span className={`status-pill status-${x.status.toLowerCase()}`}>{x.status}</span></div><div className="review-meta"><span>Application <strong>{x.id.slice(0, 8)}</strong></span><span>Submitted <strong>{x.submittedAt ? new Date(x.submittedAt).toLocaleDateString() : '—'}</strong></span><span>Mobile <strong>{x.applicantPhone || 'Not provided'}</strong></span></div><PartnerApplicationSummary application={x} /><div className="review-actions">{(x.status === 'Submitted' || x.status === 'UnderReview') && <><button className="button button-outline" disabled={busyId === x.id} onClick={() => setReviewingPartner({ application: x, approve: false })}>Reject</button><button className="button button-dark" disabled={busyId === x.id} onClick={() => setReviewingPartner({ application: x, approve: true })}>{busyId === x.id ? 'Saving…' : 'Confirm & approve partner'} <Check size={15} /></button></>}</div></article>)}</div> : <div className="empty-inline"><UserRound /><p>{applications.length ? 'No partner applications match this status.' : 'No partner applications yet.'}</p></div>}</section>}
    {tab === 'bookings' && <section className="panel-card dashboard-panel"><div className="panel-title-row"><div><span className="eyebrow">SERVICE OPERATIONS</span><h2>Recent bookings</h2><p>Track customer appointments and payment totals.</p></div><div className="admin-panel-tools"><label>Show<select value={bookingStatus} onChange={e => setBookingStatus(e.target.value)}><option value="">All bookings</option>{[...new Set(bookings.map(x => x.status))].map(x => <option key={x}>{x}</option>)}</select></label><button className="text-button" onClick={() => void load()}>Refresh</button></div></div>{visibleBookings.length ? <div className="table-wrap"><table><thead><tr><th>Booking</th><th>Service</th><th>Appointment</th><th>Status</th><th>Total</th></tr></thead><tbody>{visibleBookings.map(x => <tr key={x.id}><td><strong>{x.bookingNo}</strong></td><td>{x.items?.map(i => i.serviceName).join(', ') || 'Home service'}</td><td>{new Date(x.scheduledAt).toLocaleString()}</td><td><span className={`status-pill status-${x.status.toLowerCase()}`}>{x.status}</span></td><td>{money(x.total)}</td></tr>)}</tbody></table></div> : <div className="empty-inline"><CalendarDays /><p>{bookings.length ? 'No bookings match this status.' : 'No bookings to show.'}</p></div>}</section>}
     {tab === 'catalog' && <AdminServiceCatalogPanel />}
     {tab === 'classifieds' && <MarketplaceAdminPanel />}
     {reviewingPartner && <PartnerReviewModal application={reviewingPartner.application} approve={reviewingPartner.approve} busy={busyId === reviewingPartner.application.id} onClose={() => setReviewingPartner(null)} onSubmit={feedback => reviewPartner(reviewingPartner.application.id, reviewingPartner.approve, feedback)} />}
  </div></RequireUser>
}

function PartnerReviewModal({ application, approve, busy, onClose, onSubmit }: { application: PartnerApplication; approve: boolean; busy: boolean; onClose: () => void; onSubmit: (feedback: string) => Promise<void> }) {
  const [feedback, setFeedback] = useState('')
  const [validationError, setValidationError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const message = feedback.trim()
    if (!approve && message.length < 10) { setValidationError('Please provide a clear rejection reason of at least 10 characters.'); return }
    if (message.length > 1000) { setValidationError('Feedback must be 1,000 characters or fewer.'); return }
    setValidationError('')
    await onSubmit(message)
  }
  return <div className="modal-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}><section className="modal-card form-modal partner-review-modal" role="dialog" aria-modal="true" aria-labelledby="partner-review-title"><div className="modal-heading"><div><span className="eyebrow">PARTNER APPLICATION REVIEW</span><h2 id="partner-review-title">{approve ? 'Approve application' : 'Reject application'}</h2></div><button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Close review dialog"><X /></button></div><p className="modal-subtitle">{application.applicantName} · {application.applicantEmail}</p><form className="stack-form" onSubmit={submit} noValidate><label htmlFor="partner-review-feedback">{approve ? 'Suggestion or welcome note' : 'Reason for rejection'} {!approve && <span className="required-label">Required</span>}</label><textarea id="partner-review-feedback" value={feedback} onChange={event => setFeedback(event.target.value)} maxLength={1000} minLength={approve ? undefined : 10} rows={5} required={!approve} placeholder={approve ? 'Optional: share a helpful suggestion or next step for the partner.' : 'Explain what needs to be corrected and how the applicant can resubmit.'} aria-invalid={!!validationError} aria-describedby={validationError ? 'partner-review-feedback-error' : 'partner-review-feedback-help'} />{validationError ? <span id="partner-review-feedback-error" className="profile-field-error" role="alert">{validationError}</span> : <small id="partner-review-feedback-help" className="profile-help-text">{approve ? 'This note will be shown to the partner with the approval.' : 'Be specific and constructive. The partner will see this note and can update and resubmit.'} · {feedback.length}/1000</small>}<div className="partner-application-actions"><button className="button button-outline" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-dark" type="submit" disabled={busy || (!approve && feedback.trim().length < 10)}>{busy ? 'Saving…' : approve ? 'Approve and send note' : 'Reject and send reason'}</button></div></form></section></div>
}

function AdminServiceCatalogPanel() {
  const [cities, setCities] = useState<City[]>([])
  const [cityId, setCityId] = useState('')
  const [categories, setCategories] = useState<AdminCatalogCategory[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [services, setServices] = useState<AdminCatalogService[]>([])
  const [editingCategory, setEditingCategory] = useState<AdminCatalogCategory | null>(null)
  const [editingService, setEditingService] = useState<AdminCatalogService | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [categorySlug, setCategorySlug] = useState('')
  const [categoryIcon, setCategoryIcon] = useState('')
  const [categorySort, setCategorySort] = useState('1')
  const [categoryActive, setCategoryActive] = useState(true)
  const [serviceName, setServiceName] = useState('')
  const [serviceSlug, setServiceSlug] = useState('')
  const [serviceDescription, setServiceDescription] = useState('')
  const [serviceDuration, setServiceDuration] = useState('60')
  const [serviceCategoryId, setServiceCategoryId] = useState('')
  const [serviceActive, setServiceActive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refreshCategories = async (forCity = cityId) => {
    if (!forCity) { setCategories([]); setCategoryId(''); return }
    const rows = await endpoints.adminCatalogCategories(forCity)
    setCategories(rows || [])
    setCategoryId(current => rows?.some(row => row.id === current) ? current : rows?.[0]?.id || '')
  }
  const refreshServices = async (forCategory = categoryId) => {
    if (!forCategory) { setServices([]); return }
    setServices(await endpoints.adminCatalogServices(forCategory) || [])
  }
  useEffect(() => { void endpoints.cities().then(rows => { setCities(rows); if (rows.length) setCityId(current => current || rows[0].id) }).catch(e => setError((e as Error).message)) }, [])
  useEffect(() => { void refreshCategories().catch(e => setError((e as Error).message)) }, [cityId])
  useEffect(() => { setServiceCategoryId(categoryId); void refreshServices().catch(e => setError((e as Error).message)) }, [categoryId])

  const resetCategoryForm = () => { setEditingCategory(null); setCategoryName(''); setCategorySlug(''); setCategoryIcon(''); setCategorySort(String(categories.length + 1)); setCategoryActive(true) }
  const editCategory = (category: AdminCatalogCategory) => { setEditingCategory(category); setCategoryName(category.name); setCategorySlug(category.slug); setCategoryIcon(category.iconUrl || ''); setCategorySort(String(category.sortOrder)); setCategoryActive(category.isActive) }
  const saveCategory = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true)
    const city = cities.find(row => row.id === cityId)
    const normalizedSlug = categorySlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    try {
      if (editingCategory) await endpoints.updateCatalogCategory(editingCategory.id, { name: categoryName.trim(), slug: normalizedSlug, iconUrl: categoryIcon.trim() || null, sortOrder: Number(categorySort), isActive: categoryActive })
      else await endpoints.createCatalogCategory({ cityId, name: categoryName.trim(), slug: city?.slug === 'mumbai' ? normalizedSlug : `${normalizedSlug}-${city?.slug}`, iconUrl: categoryIcon.trim() || null, sortOrder: Number(categorySort) })
      await refreshCategories(); resetCategoryForm(); setNotice(editingCategory ? 'Category updated.' : 'Category added.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const saveService = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true)
    const normalizedSlug = serviceSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const selectedCity = cities.find(city => city.id === cityId)
    const createServiceSlug = selectedCity?.slug === 'mumbai' ? normalizedSlug : `${normalizedSlug}-${selectedCity?.slug}`
    try {
      if (editingService) await endpoints.updateCatalogService(editingService.id, { categoryId: serviceCategoryId, name: serviceName.trim(), slug: normalizedSlug, description: serviceDescription.trim(), durationMins: Number(serviceDuration), isActive: serviceActive })
      else await endpoints.createCatalogService({ categoryId, name: serviceName.trim(), slug: createServiceSlug, description: serviceDescription.trim(), durationMins: Number(serviceDuration) })
      await refreshServices(); setEditingService(null); setServiceName(''); setServiceSlug(''); setServiceDescription(''); setServiceDuration('60'); setServiceActive(true); setNotice(editingService ? 'Main service updated.' : 'Main service added.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const deactivateCategory = async (category: AdminCatalogCategory) => {
    if (!window.confirm(`Deactivate “${category.name}”? It will remain in historical records and can be reactivated.`)) return
    setError(''); setNotice('')
    try { await endpoints.deleteCatalogCategory(category.id); await refreshCategories(); setNotice('Category deactivated.') } catch (e) { setError((e as Error).message) }
  }
  const deactivateService = async (service: AdminCatalogService) => {
    if (!window.confirm(`Deactivate “${service.name}”? Existing records will be preserved.`)) return
    setError(''); setNotice('')
    try { await endpoints.deleteCatalogService(service.id); await refreshServices(); setNotice('Main service deactivated.') } catch (e) { setError((e as Error).message) }
  }

  return <section className="panel-card dashboard-panel">
    <div className="panel-title-row"><div><span className="eyebrow">HOME SERVICE SETUP</span><h2>Service catalog</h2><p>Manage the categories applicants can choose and the main services within each category.</p></div><label>City<select value={cityId} onChange={event => setCityId(event.target.value)}>{cities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label></div>
    {error && <ErrorBanner message={error} />}{notice && <p className="success-note" role="status">{notice}</p>}
    <div className="catalog-admin-grid">
      <div className="catalog-admin-column"><div className="panel-title-row"><div><span className="eyebrow">MAIN CATEGORY</span><h3>Service categories</h3></div><button className="button button-outline" onClick={resetCategoryForm}><Plus size={15} /> Add category</button></div>
        <div className="catalog-admin-list">{categories.map(category => <article className={`catalog-admin-row ${category.id === categoryId ? 'catalog-admin-row-selected' : ''}`} key={category.id}><button className="catalog-admin-select" onClick={() => { setCategoryId(category.id); resetCategoryForm() }}><strong>{category.name}</strong><small>{category.slug}</small></button><span className={`status-pill ${category.isActive ? 'status-approved' : 'status-rejected'}`}>{category.isActive ? 'Active' : 'Inactive'}</span><button className="text-button" onClick={() => editCategory(category)}>Edit</button>{category.isActive && <button className="text-button danger-text" onClick={() => void deactivateCategory(category)}>Deactivate</button>}</article>)}{!categories.length && <p className="muted">No categories configured for this city.</p>}</div>
        <form className="stack-form catalog-admin-form" onSubmit={saveCategory}><h3>{editingCategory ? 'Edit category' : 'Add category'}</h3><label>Category name<input value={categoryName} onChange={event => { setCategoryName(event.target.value); if (!editingCategory) setCategorySlug(event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) }} required maxLength={100} /></label><label>Slug<input value={categorySlug} onChange={event => setCategorySlug(event.target.value)} required maxLength={100} /><small>Must be unique across cities. New categories automatically include the city slug.</small></label><label>Icon URL (optional)<input value={categoryIcon} onChange={event => setCategoryIcon(event.target.value)} maxLength={500} /></label><label>Display order<input type="number" min="0" value={categorySort} onChange={event => setCategorySort(event.target.value)} required /></label>{editingCategory && <label className="catalog-active-toggle"><input type="checkbox" checked={categoryActive} onChange={event => setCategoryActive(event.target.checked)} /> Category is active</label>}<div className="partner-application-actions"><button type="button" className="button button-outline" onClick={resetCategoryForm}>Clear</button><button className="button button-dark" disabled={busy || !cityId}>{busy ? 'Saving…' : editingCategory ? 'Save category' : 'Add category'}</button></div></form>
      </div>
      <div className="catalog-admin-column"><div className="panel-title-row"><div><span className="eyebrow">MAIN SERVICE</span><h3>{categories.find(item => item.id === categoryId)?.name || 'Choose a category'}</h3><p>Main services shown to applicants in the selected category.</p></div><button className="button button-outline" onClick={() => { setEditingService(null); setServiceCategoryId(categoryId); setServiceName(''); setServiceSlug(''); setServiceDescription(''); setServiceDuration('60'); setServiceActive(true) }} disabled={!categoryId}><Plus size={15} /> Add service</button></div>
        <div className="catalog-admin-list">{services.map(service => <article className="catalog-admin-row" key={service.id}><button className="catalog-admin-select" onClick={() => { setEditingService(service); setServiceCategoryId(service.categoryId); setServiceName(service.name); setServiceSlug(service.slug); setServiceDescription(service.description); setServiceDuration(String(service.durationMins)); setServiceActive(service.isActive) }}><strong>{service.name}</strong><small>{service.slug} · {service.durationMins} min</small></button><span className={`status-pill ${service.isActive ? 'status-approved' : 'status-rejected'}`}>{service.isActive ? 'Active' : 'Inactive'}</span><button className="text-button" onClick={() => { setEditingService(service); setServiceCategoryId(service.categoryId); setServiceName(service.name); setServiceSlug(service.slug); setServiceDescription(service.description); setServiceDuration(String(service.durationMins)); setServiceActive(service.isActive) }}>Edit</button>{service.isActive && <button className="text-button danger-text" onClick={() => void deactivateService(service)}>Deactivate</button>}</article>)}{!services.length && <p className="muted">No main services exist in this category yet. Add one below.</p>}</div>
        <form className="stack-form catalog-admin-form" onSubmit={saveService}><h3>{editingService ? 'Edit main service' : 'Add main service'}</h3><label>Service category<select value={serviceCategoryId || categoryId} onChange={event => setServiceCategoryId(event.target.value)} required>{categories.filter(category => category.isActive).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Main service name<input value={serviceName} onChange={event => { setServiceName(event.target.value); if (!editingService) setServiceSlug(event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) }} required maxLength={150} placeholder="e.g. Women Haircut and Styling" /></label><label>Slug<input value={serviceSlug} onChange={event => setServiceSlug(event.target.value)} required maxLength={150} /><small>Must be unique across the catalog.</small></label><label>Description<textarea value={serviceDescription} onChange={event => setServiceDescription(event.target.value)} maxLength={2000} rows={3} /></label><label>Default duration (minutes)<input type="number" min="1" value={serviceDuration} onChange={event => setServiceDuration(event.target.value)} required /></label>{editingService && <label className="catalog-active-toggle"><input type="checkbox" checked={serviceActive} onChange={event => setServiceActive(event.target.checked)} /> Main service is active</label>}<div className="partner-application-actions"><button type="button" className="button button-outline" onClick={() => { setEditingService(null); setServiceName(''); setServiceSlug(''); setServiceDescription(''); setServiceDuration('60'); setServiceActive(true); setServiceCategoryId(categoryId) }}>Clear</button><button className="button button-dark" disabled={busy || !categoryId}>{busy ? 'Saving…' : editingService ? 'Save main service' : 'Add main service'}</button></div></form>
      </div>
    </div>
  </section>
}

function NotFound() { return <div className="page-container"><Empty title="We can’t find that page." text="The link may be old, or the page may have moved." /></div> }
function Footer() { return <footer className="site-footer"><div className="footer-inner"><div><Link to="/classifieds" className="brand"><span className="brand-mark">p</span><span>plutonea<span className="brand-dot">.</span></span></Link><p>Home Services and Next Deal, together.</p></div><div className="footer-links"><Link to="/home-services">Explore Home Services</Link><Link to="/classifieds">Explore Next Deal</Link><Link to="/partner">Become a partner</Link><Link to="/bookings">My bookings</Link><Link to="/profile">My profile</Link></div><div className="footer-end"><span>Made for everyday life.</span><small>© {new Date().getFullYear()} Plutonea · Home Services & Next Deal</small></div></div></footer> }








