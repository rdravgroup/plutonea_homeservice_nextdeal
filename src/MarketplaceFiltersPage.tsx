import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, MapPin, Search, ShoppingBag, SlidersHorizontal, X } from 'lucide-react'
import { endpoints, type MarketplaceAd } from './api'
import { DriveImage } from './NextDealPages'
import { getDealCategory, nextDealCategories, type DealField } from './nextDealTaxonomy'

const cash = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`
const attribute = (ad: MarketplaceAd, key: string) => {
  const column: Record<string, string | number | null | undefined> = {
    make: ad.make, model: ad.model, year: ad.year, kilometres: ad.kilometres,
    fuel: ad.fuel, transmission: ad.transmission,
  }
  const value = Object.prototype.hasOwnProperty.call(column, key) ? column[key] : ad.attributes?.[key]
  return value == null ? '' : String(value)
}
function ListingCard({ ad }: { ad: MarketplaceAd }) {
  const category = getDealCategory(ad.categorySlug)
  const details = ad.kind === 'Car'
    ? [ad.year, ad.kilometres ? `${ad.kilometres.toLocaleString('en-IN')} km` : '', ad.fuel, ad.transmission]
    : [ad.attributes?.condition, ad.attributes?.brand || ad.attributes?.model]
  return <Link className="marketplace-card" to={`/marketplace/${ad.id}`}>
    <div className="marketplace-photo"><DriveImage src={ad.images[0]} alt={ad.title} placeholder={category?.icon || (ad.kind === 'Car' ? '🚘' : '🛍️')} /></div>
    <div className="marketplace-card-body"><small className="nextdeal-card-category-text">{category?.label || 'Next Deal'}</small><strong>{ad.title}</strong>
      <div className="marketplace-price">{cash(ad.price)}</div><p>{details.filter(Boolean).join(' · ')}</p>
      <small><MapPin size={13} /> {ad.locationText}, {ad.cityName}</small>
    </div>
  </Link>
}

function FilterInput({ field, ads, value, onChange }: { field: DealField; ads: MarketplaceAd[]; value: string; onChange: (value: string) => void }) {
  const values = useMemo(() => [...new Set(ads.map(ad => attribute(ad, field.key)).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [ads, field.key])
  if (field.type === 'number') {
    return <div className="market-filter-range"><label><span>From</span><input aria-label={`${field.label} from`} type="number" min="0" value={value.split('|')[0] || ''} placeholder="Any" onChange={event => onChange(`${event.target.value}|${value.split('|')[1] || ''}`)} /></label><label><span>To</span><input aria-label={`${field.label} to`} type="number" min="0" value={value.split('|')[1] || ''} placeholder="Any" onChange={event => onChange(`${value.split('|')[0] || ''}|${event.target.value}`)} /></label></div>
  }
  if (field.type === 'select') {
    const options = [...new Set([...(field.options || []), ...values])]
    return <select value={value} onChange={event => onChange(event.target.value)}><option value="">Any {field.label.toLowerCase()}</option>{options.map(option => <option value={option} key={option}>{option}</option>)}</select>
  }
  return <><input list={`filter-options-${field.key}`} value={value} onChange={event => onChange(event.target.value)} placeholder={`Any ${field.label.toLowerCase()}`} /><datalist id={`filter-options-${field.key}`}>{values.map(option => <option value={option} key={option} />)}</datalist></>
}

export function MarketplaceFiltersPage() {
  const [ads, setAds] = useState<MarketplaceAd[]>([])
  const [categorySlug, setCategorySlug] = useState('')
  const [subcategorySlug, setSubcategorySlug] = useState('')
  const [search, setSearch] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [allCondition, setAllCondition] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [sort, setSort] = useState('newest')
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    endpoints.marketplaceAds().then(rows => { if (live) setAds(rows) })
      .catch(reason => { if (live) setError((reason as Error).message) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])

  const selectedCategory = getDealCategory(categorySlug)
  const categoryAds = useMemo(() => categorySlug ? ads.filter(ad => ad.categorySlug === categorySlug) : ads, [ads, categorySlug])
  const commonConditions = useMemo(() => [...new Set(ads.map(ad => ad.attributes?.condition).filter((v): v is string => Boolean(v)))].sort(), [ads])
  const activeFilterCount = Number(Boolean(minPrice || maxPrice)) + Number(Boolean(allCondition)) + Number(Boolean(subcategorySlug)) + Object.values(fieldValues).filter(Boolean).length

  const visibleAds = useMemo(() => categoryAds.filter(ad => {
    if (subcategorySlug && ad.subcategorySlug !== subcategorySlug) return false
    if (search.trim()) {
      const haystack = `${ad.title} ${ad.description} ${ad.make || ''} ${ad.model || ''} ${ad.locationText} ${ad.cityName}`.toLowerCase()
      if (!haystack.includes(search.trim().toLowerCase())) return false
    }
    if (minPrice && ad.price < Number(minPrice)) return false
    if (maxPrice && ad.price > Number(maxPrice)) return false
    if (allCondition && ad.attributes?.condition !== allCondition) return false
    for (const field of selectedCategory?.fields || []) {
      const selected = fieldValues[field.key]
      if (!selected) continue
      const actual = attribute(ad, field.key)
      if (field.type === 'number') {
        const [low, high] = selected.split('|')
        const number = Number(actual)
        if (!actual || (low && number < Number(low)) || (high && number > Number(high))) return false
      } else if (!actual.toLowerCase().includes(selected.trim().toLowerCase())) return false
    }
    return true
  }).sort((a, b) => sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : sort === 'oldest' ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : Date.parse(b.createdAt) - Date.parse(a.createdAt)), [categoryAds, subcategorySlug, search, minPrice, maxPrice, allCondition, fieldValues, selectedCategory, sort])

  const chooseCategory = (slug: string) => { setCategorySlug(slug); setSubcategorySlug(''); setFieldValues({}); setFilterDrawerOpen(false) }
  const clearFilters = () => { setSubcategorySlug(''); setMinPrice(''); setMaxPrice(''); setAllCondition(''); setFieldValues({}); setSort('newest') }
  const setField = (key: string, value: string) => setFieldValues(current => ({ ...current, [key]: value }))

  return <div className="page-container marketplace-page category-marketplace-page">
    <div className="marketplace-heading"><div><span className="eyebrow">LOCAL FINDS, DIRECT FROM PEOPLE</span><h1>{selectedCategory ? `Explore ${selectedCategory.label}` : 'Next Deal across India'}</h1><p>Browse listings across India and contact sellers directly. No online payment is collected for Next Deal.</p></div></div>
    <div className="marketplace-tools"><label><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={selectedCategory ? `Search ${selectedCategory.label.toLowerCase()}` : 'Search cars, mobiles, appliances, properties…'} /></label><span><MapPin size={15} /> All India · meet locally</span></div>
    <nav className="deal-category-nav" aria-label="Browse main categories"><button className={!categorySlug ? 'selected' : ''} onClick={() => chooseCategory('')}>All categories</button>{nextDealCategories.map(category => <button key={category.slug} className={categorySlug === category.slug ? 'selected' : ''} onClick={() => chooseCategory(category.slug)}><span>{category.icon}</span>{category.label}</button>)}</nav>
    <div className="deal-mobile-filter-row"><span>{loading ? 'Finding listings…' : `${visibleAds.length} ${visibleAds.length === 1 ? 'listing' : 'listings'}`}</span><button className="filter-toggle" onClick={() => setFilterDrawerOpen(true)}><SlidersHorizontal size={16} /> Filters {activeFilterCount > 0 && <b>{activeFilterCount}</b>}</button></div>
    <div className="deal-results-layout">
      <main className="deal-results-main"><div className="deal-results-toolbar"><strong>{loading ? 'Finding listings…' : `${visibleAds.length} ${visibleAds.length === 1 ? 'listing' : 'listings'}`}</strong><label>Sort by<select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="oldest">Oldest first</option></select></label></div>
        {error && <div className="error-banner" role="alert">{error}</div>}{loading ? <div className="muted">Loading listings…</div> : visibleAds.length ? <div className="marketplace-grid deal-results-grid">{visibleAds.map(ad => <ListingCard key={ad.id} ad={ad} />)}</div> : <div className="empty-state"><ShoppingBag /><h3>No listings match these filters</h3><p>Try changing the price range or clearing a filter. You can also choose another category.</p><button className="button button-outline" onClick={clearFilters}>Clear filters</button></div>}
      </main>
      <div className={`deal-filter-overlay ${filterDrawerOpen ? 'open' : ''}`} onClick={event => { if (event.target === event.currentTarget) setFilterDrawerOpen(false) }}>
        <aside className={`deal-filter-sidebar ${filterDrawerOpen ? 'open' : ''}`} aria-label="Listing filters"><div className="deal-filter-header"><div><span className="eyebrow">REFINE RESULTS</span><h2>Filters</h2></div><button className="deal-clear-button" onClick={clearFilters}>Clear all</button><button className="deal-filter-close" onClick={() => setFilterDrawerOpen(false)} aria-label="Close filters"><X /></button></div>
          <section className="deal-filter-section"><h3>Categories</h3><button className={`deal-category-choice ${!categorySlug ? 'active' : ''}`} onClick={() => chooseCategory('')}><span>All categories</span>{!categorySlug && <Check size={16} />}</button>{nextDealCategories.map(category => <button key={category.slug} className={`deal-category-choice ${categorySlug === category.slug ? 'active' : ''}`} onClick={() => chooseCategory(category.slug)}><span><i>{category.icon}</i>{category.label}</span>{categorySlug === category.slug && <Check size={16} />}</button>)}</section>
          <section className="deal-filter-section"><h3>Budget</h3><div className="market-filter-range"><label><span>Minimum</span><input type="number" min="0" value={minPrice} onChange={event => setMinPrice(event.target.value)} placeholder="₹ Min" /></label><label><span>Maximum</span><input type="number" min="0" value={maxPrice} onChange={event => setMaxPrice(event.target.value)} placeholder="₹ Max" /></label></div></section>
          {!selectedCategory && commonConditions.length > 0 && <section className="deal-filter-section"><h3>Condition</h3><select value={allCondition} onChange={event => setAllCondition(event.target.value)}><option value="">Any condition</option>{commonConditions.map(value => <option key={value}>{value}</option>)}</select></section>}
          {selectedCategory && selectedCategory.subcategories.length > 1 && <section className="deal-filter-section"><h3>Type</h3><select value={subcategorySlug} onChange={event => setSubcategorySlug(event.target.value)}><option value="">All {selectedCategory.label.toLowerCase()}</option>{selectedCategory.subcategories.map(item => <option value={item.slug} key={item.slug}>{item.label}</option>)}</select></section>}
          {selectedCategory?.fields.map(field => <section className="deal-filter-section" key={field.key}><h3>{field.label}</h3><FilterInput field={field} ads={categoryAds} value={fieldValues[field.key] || ''} onChange={value => setField(field.key, value)} /></section>)}
          <button className="button button-dark button-full deal-mobile-apply" onClick={() => setFilterDrawerOpen(false)}>Show {visibleAds.length} results</button>
        </aside>
      </div>
    </div>
  </div>
}
