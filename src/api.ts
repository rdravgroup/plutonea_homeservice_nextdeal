const API_URL = (import.meta.env.VITE_API_URL || 'https://plutonea.com').replace(/\/$/, '')
const SESSION_KEY = 'plutonea.session'
const LEGACY_SESSION_KEY = 'haven.session'

export type Role = 'Customer' | 'Professional' | 'Admin'
export type Session = {
  accessToken: string
  refreshToken: string
  role: Role
  profileStatus: string
  requestedRole?: Role | null
  partnerApplicationStatus?: string | null
}

export type CurrentUser = {
  id: string; email: string; fullName: string; avatarUrl?: string | null
  phone?: string | null; phoneVerified?: boolean; role: Role; profileStatus: string; cityId?: string | null; partnerApplicationStatus?: string | null; hasPartnerAccess?: boolean
}
export type City = { id: string; name: string; slug: string; centerLat: number; centerLng: number }
export type Category = { id: string; name: string; slug: string; iconUrl?: string | null; sortOrder: number }
export type Sku = { id: string; name: string; price: number; strikePrice: number; discountPct: number; isInstant: boolean; inclusions: string }
export type ServiceSummary = { id: string; name: string; slug: string; description: string; durationMins: number }
export type Service = ServiceSummary & { skus: Sku[] }
export type CartLine = { id: string; skuId: string; skuName: string; unitPrice: number; discountPct: number; quantity: number; lineTotal: number }
export type Cart = { id: string; cityId: string; items: CartLine[]; subtotal: number; discount: number; total: number; itemCount: number }
export type Address = { id: string; label: string; line1: string; line2?: string | null; pincode: string; lat: number; lng: number; isDefault: boolean }
export type PartnerListing = {
  id: string; partnerUserId: string; partnerName: string; partnerEmail: string; categoryId: string; categoryName: string
  title: string; description: string; imageUrl?: string | null; price: number; strikePrice: number
  durationMins: number; status: string; reviewNote?: string | null; createdAt: string; serviceSlug?: string | null; skuId?: string | null
}
export type MarketplaceAd = {
  id: string; kind: 'Car' | 'Classified'; status: string; cityId: string; cityName: string; sellerUserId: string; sellerName: string
  title: string; description: string; price: number; locationText: string; images: string[]; make?: string | null; model?: string | null
  variant?: string | null; year?: number | null; kilometres?: number | null; fuel?: string | null; transmission?: string | null
  reviewNote?: string | null; createdAt: string
}
export type MarketplaceMessage = { id: string; senderUserId: string; senderName: string; body: string; createdAt: string }
export type MarketplaceConversation = { id: string; adId: string; adTitle: string; adImage: string; adPrice: number; adStatus: string; otherUserId: string; otherUserName: string; lastMessage: string; lastMessageAt: string; unreadCount: number; isBuyer: boolean }
export type MarketplaceConversationThread = { conversation: MarketplaceConversation; messages: MarketplaceMessage[] }
export type MarketplaceAdInput = {
  kind: 'Car' | 'Classified'; cityId: string; title: string; description: string; price: number; locationText: string; images: string[]
  make?: string; model?: string; variant?: string; year?: number; kilometres?: number; fuel?: string; transmission?: string
}
export type PartnerApplication = {
  id: string; userId: string; status: string; submittedAt?: string | null; reviewedAt?: string | null
  reviewNote?: string | null; applicantName: string; applicantEmail: string
  categoryIds: string; skills: string; documentUrls: string; applicantPhone?: string | null; phoneVerified?: boolean
}
export type Booking = { id: string; bookingNo: string; status: string; scheduledAt: string; total: number; items: { serviceName: string; quantity: number }[] }
export type PageResult<T> = { items: T[]; page: number; pageSize: number; totalCount: number; totalPages: number }

export function readSession(): Session | null {
  try {
    const current = localStorage.getItem(SESSION_KEY)
    const legacy = localStorage.getItem(LEGACY_SESSION_KEY)
    const session = JSON.parse(current || legacy || 'null') as Session | null
    if (!current && session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); localStorage.removeItem(LEGACY_SESSION_KEY) }
    return session
  }
  catch { return null }
}
export function writeSession(session: Session | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(LEGACY_SESSION_KEY)
}
export const googleSignInUrl = `${API_URL}/api/v1/auth/google-signin`

let refreshTask: Promise<boolean> | null = null
async function refreshSession(): Promise<boolean> {
  const session = readSession()
  if (!session?.refreshToken) return false
  if (!refreshTask) {
    refreshTask = fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }).then(async response => {
      if (!response.ok) { writeSession(null); return false }
      const envelope = await response.json()
      if (!envelope.success || !envelope.data) { writeSession(null); return false }
      writeSession(envelope.data as Session)
      return true
    }).catch(() => false).finally(() => { refreshTask = null })
  }
  return refreshTask
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; auth?: boolean; retry?: boolean; headers?: Record<string, string> } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  const session = readSession()
  if (options.auth !== false && session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`
  let response = await fetch(`${API_URL}${path}`, {
    method: options.method || 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  if (response.status === 401 && options.auth !== false && options.retry !== false && !path.startsWith('/api/v1/auth/')) {
    if (await refreshSession()) return api<T>(path, { ...options, retry: false })
  }
  if (response.status === 204) return undefined as T
  const payload = await response.json().catch(() => null)
  if (!response.ok || (payload && payload.success === false)) {
    throw new Error(payload?.error?.message || payload?.title || `Request failed (${response.status})`)
  }
  return (payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload) as T
}

export const endpoints = {
  me: () => api<CurrentUser>('/api/v1/auth/me'),
  cities: () => api<City[]>('/api/v1/cities', { auth: false }),
  categories: (city: string) => api<Category[]>(`/api/v1/cities/${encodeURIComponent(city)}/categories`, { auth: false }),
  services: (category: string) => api<ServiceSummary[]>(`/api/v1/categories/${encodeURIComponent(category)}/services`, { auth: false }),
  service: (slug: string) => api<Service>(`/api/v1/services/${encodeURIComponent(slug)}`, { auth: false }),
  publicListings: (categoryId?: string) => api<PartnerListing[]>(`/api/v1/listings${categoryId ? `?categoryId=${categoryId}` : ''}`, { auth: false }),
  marketplaceAds: (cityId?: string, search?: string, kind?: 'Car' | 'Classified') => api<MarketplaceAd[]>(`/api/v1/marketplace/ads?${new URLSearchParams({ ...(cityId ? { cityId } : {}), ...(search ? { search } : {}), ...(kind ? { kind } : {}) })}`, { auth: false }),
  marketplaceAd: (id: string) => api<MarketplaceAd>(`/api/v1/marketplace/ads/${id}`, { auth: false }),
  myMarketplaceAds: () => api<MarketplaceAd[]>('/api/v1/marketplace/my-ads'),
  createMarketplaceAd: (ad: MarketplaceAdInput) => api<MarketplaceAd>('/api/v1/marketplace/ads', { method: 'POST', body: ad }),
  setMarketplaceAdStatus: (id: string, status: string) => api<void>(`/api/v1/marketplace/ads/${id}/status`, { method: 'POST', body: { status } }),
  startMarketplaceConversation: (id: string, message: string) => api<MarketplaceConversation>(`/api/v1/marketplace/ads/${id}/conversations`, { method: 'POST', body: { message } }),
  marketplaceConversations: () => api<MarketplaceConversation[]>('/api/v1/marketplace/conversations'),
  marketplaceConversation: (id: string) => api<MarketplaceConversationThread>(`/api/v1/marketplace/conversations/${id}`),
  sendMarketplaceMessage: (id: string, body: string) => api<MarketplaceMessage>(`/api/v1/marketplace/conversations/${id}/messages`, { method: 'POST', body: { body } }),
  bookTestDrive: (id: string, requestedAt: string, buyerNote?: string) => api<string>(`/api/v1/marketplace/cars/${id}/test-drives`, { method: 'POST', body: { requestedAt, buyerNote } }),
  sellerTestDrives: () => api<MarketplaceRequest[]>('/api/v1/marketplace/seller/test-drives'),
  respondToTestDrive: (id: string, status: 'Accepted' | 'Declined') => api<void>(`/api/v1/marketplace/seller/test-drives/${id}/status`, { method: 'POST', body: { status } }),
  myTestDrives: () => api<MarketplaceRequest[]>('/api/v1/marketplace/my-test-drives'),
  adminMarketplaceAds: (status?: string) => api<MarketplaceAd[]>(`/api/v1/admin/marketplace/ads?${new URLSearchParams({ ...(status ? { status } : {}) })}`),
  reviewMarketplaceAd: (id: string, approve: boolean, note?: string) => api<MarketplaceAd>(`/api/v1/admin/marketplace/ads/${id}/review`, { method: 'POST', body: { approve, note } }),
  cart: () => api<Cart>('/api/v1/cart'),
  addCartItem: (skuId: string, quantity: number) => api<Cart>('/api/v1/cart/items', { method: 'POST', body: { skuId, quantity } }),
  updateCartItem: (id: string, quantity: number) => api<void>(`/api/v1/cart/items/${id}`, { method: 'PUT', body: { quantity } }),
  removeCartItem: (id: string) => api<void>(`/api/v1/cart/items/${id}`, { method: 'DELETE' }),
  clearCart: () => api<void>('/api/v1/cart', { method: 'DELETE' }),
  addresses: () => api<Address[]>('/api/v1/addresses'),
  addAddress: (address: Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean }) => api<Address>('/api/v1/addresses', { method: 'POST', body: address }),
  deleteAddress: (id: string) => api<void>(`/api/v1/addresses/${id}`, { method: 'DELETE' }),
  setDefaultAddress: (id: string) => api<void>(`/api/v1/addresses/${id}/default`, { method: 'PUT' }),
  updateProfile: (fullName: string, phone?: string) => api<void>('/api/v1/profile', { method: 'PUT', body: { fullName, ...(phone !== undefined ? { phone } : {}) } }),
  requestPhoneOtp: (phone: string) => api<{devCode?:string|null}>('/api/v1/profile/phone/request-otp', { method: 'POST', body: { phone } }),
  verifyPhoneOtp: (code: string) => api<{profileComplete:boolean;accessToken?:string|null;refreshToken?:string|null;role?:Role|null;profileStatus:string}>('/api/v1/profile/phone/verify-otp', { method: 'POST', body: { code } }),
  myApplication: () => api<PartnerApplication | null>('/api/v1/pro/applications/me'),
  submitPartnerApplication: (categoryIds: string[], serviceId: string) => api<string>('/api/v1/pro/applications', { method: 'POST', body: { categoryIds, skills: [{ serviceId, experienceYears: 1 }], documentUrls: ['pending-document-review'] } }),
  myListings: () => api<PartnerListing[]>('/api/v1/partner/listings'),
  createListing: (listing: Omit<PartnerListing, 'id' | 'partnerUserId' | 'partnerName' | 'partnerEmail' | 'categoryName' | 'status' | 'reviewNote' | 'createdAt' | 'serviceSlug' | 'skuId'>) =>
    api<PartnerListing>('/api/v1/partner/listings', { method: 'POST', body: listing }),
  updateListing: (id: string, listing: Omit<PartnerListing, 'id' | 'partnerUserId' | 'partnerName' | 'partnerEmail' | 'categoryName' | 'status' | 'reviewNote' | 'createdAt' | 'serviceSlug' | 'skuId'>) =>
    api<PartnerListing>(`/api/v1/partner/listings/${id}`, { method: 'PUT', body: listing }),
  deleteListing: (id: string) => api<void>(`/api/v1/partner/listings/${id}`, { method: 'DELETE' }),
  adminListings: (status?: string) => api<PartnerListing[]>(`/api/v1/admin/listings${status ? `?status=${status}` : ''}`),
  reviewListing: (id: string, approve: boolean, note?: string) => api<PartnerListing>(`/api/v1/admin/listings/${id}/review`, { method: 'POST', body: { approve, note } }),
  adminApplications: (status?: string) => api<PartnerApplication[]>(`/api/v1/admin/pro-applications${status ? `?status=${status}` : ''}`),
  approveApplication: (id: string) => api<void>(`/api/v1/admin/pro-applications/${id}/approve`, { method: 'POST', body: {} }),
  rejectApplication: (id: string, reason: string) => api<void>(`/api/v1/admin/pro-applications/${id}/reject`, { method: 'POST', body: { reason } }),
  bookings: () => api<PageResult<Booking>>('/api/v1/bookings?page=1&pageSize=50'),
  adminBookings: () => api<PageResult<Booking>>('/api/v1/admin/bookings?page=1&pageSize=50'),
  partnerJobs: () => api<Booking[]>('/api/v1/pro/jobs'),
  setPartnerAvailability: (isAvailable: boolean) => api<void>('/api/v1/pro/me/availability', { method: 'PUT', body: { isAvailable } }),
  updatePartnerJob: (id: string, action: 'accept' | 'enroute' | 'start' | 'complete') => api<void>(`/api/v1/pro/jobs/${id}/${action}`, { method: 'POST', body: {} }),
  createBooking: (addressId: string, scheduledAt: string, idempotencyKey: string) => api<Booking>('/api/v1/bookings', { method: 'POST', body: { addressId, scheduledAt }, headers: { 'Idempotency-Key': idempotencyKey } }),
  createPayment: (bookingId: string) => api<{ gatewayOrderId: string; currency: string; amount: number }>('/api/v1/payments/order', { method: 'POST', body: { bookingId } }),
  verifyPayment: (gatewayOrderId: string, gatewayPaymentId: string, signature: string) => api<void>('/api/v1/payments/verify', { method: 'POST', body: { gatewayOrderId, gatewayPaymentId, signature } }),
  serviceable: (city: string, lat: number, lng: number) => api<{ isServiceable: boolean; distanceKm: number }>(`/api/v1/cities/${city}/serviceable?lat=${lat}&lng=${lng}`, { auth: false }),
  logout: async () => {
    const session = readSession()
    if (session?.refreshToken) await api<void>('/api/v1/auth/logout', { method: 'POST', body: { refreshToken: session.refreshToken } }).catch(() => undefined)
    writeSession(null)
  },
}
export type MarketplaceRequest = { id: string; adId: string; adTitle: string; buyerUserId: string; buyerName: string; buyerEmail: string; message: string; status: string; requestedAt?: string | null; createdAt: string }
