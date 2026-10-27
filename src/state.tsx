import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { endpoints, readSession, writeSession, type Cart, type CartLine, type CurrentUser, type Session, type Sku } from './api'

type AuthValue = {
  user: CurrentUser | null; ready: boolean; refreshUser: () => Promise<void>
  logout: () => Promise<void>; syncGuestCart: (items: CartLine[]) => Promise<void>; refreshCart: () => Promise<void>
}
const AuthContext = createContext<AuthValue | null>(null)
const CART_KEY = 'plutonea.guestCart'
const LEGACY_CART_KEY = 'haven.guestCart'
const CART_SYNC_KEY = 'plutonea.oauth-cart-sync'
const LEGACY_CART_SYNC_KEY = 'haven.oauth-cart-sync'

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

  const setCart = (cart: Cart) => setItems(cart.items || [])
  const refreshCart = async () => { if (user) setCart(await endpoints.cart()) }
  const refreshUser = async () => setUser(await endpoints.me())

  useEffect(() => {
    let alive = true
    const boot = async () => {
      const callback = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const accessToken = callback.get('accessToken')
      const refreshToken = callback.get('refreshToken')
      if (accessToken && refreshToken) {
        writeSession({ accessToken, refreshToken, role: (callback.get('role') || 'Customer') as Session['role'], profileStatus: callback.get('profileStatus') || 'Incomplete' })
        sessionStorage.setItem(CART_SYNC_KEY, 'pending')
        sessionStorage.removeItem(LEGACY_CART_SYNC_KEY)
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
      }
      if (readSession()) {
        let me: CurrentUser
        try {
          me = await endpoints.me()
        } catch {
          writeSession(null)
          sessionStorage.removeItem(CART_SYNC_KEY)
          sessionStorage.removeItem(LEGACY_CART_SYNC_KEY)
          if (alive) setUser(null)
        }
        if (readSession()) {
          if (alive) setUser(me!)
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

  return <AuthContext.Provider value={value}><CartContext.Provider value={cartValue}>{children}</CartContext.Provider></AuthContext.Provider>
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AppState is missing'); return value }
export function useCart() { const value = useContext(CartContext); if (!value) throw new Error('AppState is missing'); return value }
