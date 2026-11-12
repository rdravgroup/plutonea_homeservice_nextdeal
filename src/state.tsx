import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { endpoints, readSession, type Cart, type CartLine, type CurrentUser, type MarketplaceAd, type Session, type Sku } from './api'

type AuthValue = {
  user: CurrentUser | null; ready: boolean; refreshUser: () => Promise<void>
  logout: () => Promise<void>; syncGuestCart: (items: CartLine[]) => Promise<void>; refreshCart: () => Promise<void>
}
const AuthContext = createContext<AuthValue | null>(null)
type WishlistValue = { ads: MarketplaceAd[]; count: number; isSaved: (adId: string) => boolean; toggle: (adId: string) => Promise<void>; refresh: () => Promise<void> }
const WishlistContext = createContext<WishlistValue | null>(null)
const CART_KEY = 'plutonea.guestCart'
const LEGACY_CART_KEY = 'haven.guestCart'
const CART_SYNC_KEY = 'plutonea.oauth-cart-sync'
const LEGACY_CART_SYNC_KEY = 'haven.oauth-cart-sync'

// The API remains the authority for access. This local profile keeps the account
// shell signed in while /auth/me is temporarily unavailable after the OAuth redirect.
function sessionUser(session: Session): CurrentUser | null {
  if (!session.accessToken) return null
  let claims: Record<string, unknown> = {}
  try {
    const payload = session.accessToken.split('.')[1]
    if (payload) {
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
      const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
      claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
    }
  } catch { /* OAuth still returned an app token; use its session role below. */ }
  const id = String(claims.sub || claims.nameid || claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || 'authenticated-session')
  const email = String(claims.email || claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || '')
  const claimRole = claims.role || claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
  const roles = (Array.isArray(claimRole) ? claimRole : [claimRole]).map(String)
  const roleValue = roles.includes('Admin') || roles.includes('2') ? 'Admin'
    : roles.includes('Professional') || roles.includes('1') ? 'Professional'
      : (['Customer', 'Professional', 'Admin'].includes(String(session.role)) ? String(session.role) : 'Customer')
  return {
    id, email, fullName: email ? email.split('@')[0] : 'Plutonea account', role: roleValue as CurrentUser['role'],
    profileStatus: String(claims.profileStatus || session.profileStatus || 'Incomplete'), emailVerified: false, profileComplete: false,
  }
}

type CartValue = { items: CartLine[]; count: number; subtotal: number; total: number; discount: number
  add: (sku: Sku, quantity: number) => Promise<void>; setQuantity: (item: CartLine, quantity: number) => Promise<void>
  remove: (item: CartLine) => Promise<void>; clear: () => void; setRemote: (cart: Cart) => void }
const CartContext = createContext<CartValue | null>(null)

function getGuestCart(): CartLine[] {
  try {
    const current = localStorage.getItem(CART_KEY)
    const legacy = localStorage.getItem(LEGACY_CART_KEY)
    const cart = JSON.parse(current || legacy || '[]') as CartLine[]
    if (!current && legacy) localStorage.setItem(CART_KEY, JSON.stringify(cart))
    localStorage.removeItem(LEGACY_CART_KEY)
    return cart
  }
  catch { return [] }
}
function saveGuestCart(items: CartLine[]) { localStorage.setItem(CART_KEY, JSON.stringify(items)) }

export function AppState({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [ready, setReady] = useState(false)
  const [items, setItems] = useState<CartLine[]>(getGuestCart)
  const [savedAds, setSavedAds] = useState<MarketplaceAd[]>([])

  const setCart = (cart: Cart) => setItems(cart.items || [])
  const refreshCart = async () => { if (user) setCart(await endpoints.cart()) }
  const refreshUser = async () => setUser(await endpoints.me())
  const refreshWishlist = async () => { if (!user) { setSavedAds([]); return }; setSavedAds(await endpoints.marketplaceFavorites()) }

  useEffect(() => {
    let alive = true
    if (!user) { setSavedAds([]); return () => { alive = false } }
    setSavedAds([])
    void endpoints.marketplaceFavorites().then(rows => { if (alive) setSavedAds(rows) }).catch(error => console.warn('Could not load Next Deal saved ads.', error))
    return () => { alive = false }
  }, [user?.id])

  useEffect(() => {
    let alive = true
    const boot = async () => {
      if (readSession()) {
        let me: CurrentUser | null = null
        try {
          me = await endpoints.me()
        } catch (error) {
          // Retry once for a just-issued OAuth token, which can arrive before the API
          // instance is ready to serve its profile endpoint.
          await new Promise(resolve => window.setTimeout(resolve, 400))
          try { me = await endpoints.me() } catch { /* Preserve the OAuth session below. */ }
          if (!readSession()) {
            sessionStorage.removeItem(CART_SYNC_KEY)
            sessionStorage.removeItem(LEGACY_CART_SYNC_KEY)
          } else {
            console.error('Could not load the signed-in Plutonea profile.', error)
          }
        }
        if (readSession()) {
          if (alive) setUser(me || sessionUser(readSession()!))
          try {
            if ((sessionStorage.getItem(CART_SYNC_KEY) || sessionStorage.getItem(LEGACY_CART_SYNC_KEY)) === 'pending') {
              sessionStorage.setItem(CART_SYNC_KEY, 'running')
              sessionStorage.removeItem(LEGACY_CART_SYNC_KEY)
              try {
                const guest = getGuestCart()
                if (guest.length) {
                  let remote = await endpoints.cart()
                  for (const item of guest) remote = await endpoints.addCartItem(item.skuId, item.quantity)
                  localStorage.removeItem(CART_KEY)
                  if (alive) setCart(remote)
                }
              }
              finally { sessionStorage.removeItem(CART_SYNC_KEY); sessionStorage.removeItem(LEGACY_CART_SYNC_KEY) }
            }
            const serverCart = await endpoints.cart()
            if (alive) setCart(serverCart)
          } catch {
            // Cart access is independent from authentication; a cart failure must not sign the user out.
            sessionStorage.removeItem(CART_SYNC_KEY)
            sessionStorage.removeItem(LEGACY_CART_SYNC_KEY)
          }
        }
      }
      if (alive) setReady(true)
    }
    void boot()
    return () => { alive = false }
  }, [])

  const syncGuestCart = async (guestItems: CartLine[]) => {
    let current = await endpoints.cart()
    for (const item of guestItems) current = await endpoints.addCartItem(item.skuId, item.quantity)
    setCart(current)
    localStorage.removeItem(CART_KEY)
  }
  const logout = async () => {
    await endpoints.logout()
    setUser(null)
    const guest = getGuestCart()
    setItems(guest)
  }

  const add = async (sku: Sku, quantity: number) => {
    if (user) { setCart(await endpoints.addCartItem(sku.id, quantity)); return }
    setItems(previous => {
      const found = previous.find(x => x.skuId === sku.id)
      const next = found
        ? previous.map(x => x.skuId === sku.id ? { ...x, quantity: x.quantity + quantity, lineTotal: x.lineTotal + sku.price * quantity * (1 - sku.discountPct / 100) } : x)
        : [...previous, { id: sku.id, skuId: sku.id, skuName: sku.name, unitPrice: sku.price, discountPct: sku.discountPct, quantity, lineTotal: sku.price * quantity * (1 - sku.discountPct / 100) }]
      saveGuestCart(next)
      return next
    })
  }
  const setQuantity = async (item: CartLine, quantity: number) => {
    if (quantity < 1) return remove(item)
    if (user) { await endpoints.updateCartItem(item.id, quantity); await refreshCart(); return }
    setItems(previous => {
      const next = previous.map(x => x.id === item.id ? { ...x, quantity, lineTotal: x.unitPrice * quantity * (1 - x.discountPct / 100) } : x)
      saveGuestCart(next); return next
    })
  }
  const remove = async (item: CartLine) => {
    if (user) { await endpoints.removeCartItem(item.id); await refreshCart(); return }
    setItems(previous => { const next = previous.filter(x => x.id !== item.id); saveGuestCart(next); return next })
  }
  const clear = async () => { if (user) await endpoints.clearCart(); setItems([]); saveGuestCart([]) }
  const count = items.reduce((sum, x) => sum + x.quantity, 0)
  const subtotal = items.reduce((sum, x) => sum + x.unitPrice * x.quantity, 0)
  const total = items.reduce((sum, x) => sum + x.lineTotal, 0)
  const value = useMemo<AuthValue>(() => ({ user, ready, refreshUser, logout, syncGuestCart, refreshCart }), [user, ready, items])
  const cartValue = useMemo<CartValue>(() => ({ items, count, subtotal, total, discount: subtotal - total, add, setQuantity, remove, clear, setRemote: setCart }), [items, user])
  const toggleFavorite = async (adId: string) => {
    if (!user) throw new Error('Sign in to save listings to your wishlist.')
    if (savedAds.some(ad => ad.id === adId)) await endpoints.removeMarketplaceFavorite(adId)
    else await endpoints.addMarketplaceFavorite(adId)
    await refreshWishlist()
    window.dispatchEvent(new Event('plutonea:header-counts-refresh'))
  }
  const wishlistValue = useMemo<WishlistValue>(() => ({ ads: savedAds, count: savedAds.length, isSaved: id => savedAds.some(ad => ad.id === id), toggle: toggleFavorite, refresh: refreshWishlist }), [savedAds, user])

  return <AuthContext.Provider value={value}><WishlistContext.Provider value={wishlistValue}><CartContext.Provider value={cartValue}>{children}</CartContext.Provider></WishlistContext.Provider></AuthContext.Provider>
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AppState is missing'); return value }
export function useWishlist() { const value = useContext(WishlistContext); if (!value) throw new Error('AppState is missing'); return value }
export function useCart() { const value = useContext(CartContext); if (!value) throw new Error('AppState is missing'); return value }


