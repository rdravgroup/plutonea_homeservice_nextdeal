export type DealField = {
  key: string
  label: string
  type?: 'text' | 'number' | 'select'
  options?: string[]
  placeholder?: string
}

export type DealSubcategory = { slug: string; label: string }
export type DealCategory = {
  slug: string
  label: string
  icon: string
  subcategories: DealSubcategory[]
  fields: DealField[]
}

const subcategories = (values: string[]) => values.map(label => ({
  label,
  slug: label.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
}))
const select = (key: string, label: string, options: string[]): DealField => ({ key, label, type: 'select', options })
const number = (key: string, label: string, placeholder = ''): DealField => ({ key, label, type: 'number', placeholder })
const text = (key: string, label: string, placeholder = ''): DealField => ({ key, label, type: 'text', placeholder })

export const nextDealCategories: DealCategory[] = [
  { slug: 'cars', label: 'Cars', icon: '🚘', subcategories: subcategories(['Cars']), fields: [
    text('make', 'Make'), text('model', 'Model'), number('year', 'Year'), number('kilometres', 'Kilometres driven'),
    select('fuel', 'Fuel', ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid']), select('transmission', 'Transmission', ['Manual', 'Automatic']),
    select('owners', 'Number of owners', ['First owner', 'Second owner', 'Third owner', 'Fourth owner', 'More than four']),
    select('sellerType', 'Seller type', ['Individual', 'Dealer']),
    select('bodyType', 'Body type', ['Hatchback', 'Sedan', 'SUV', 'MUV', 'Coupe', 'Pickup', 'Van']),
    select('color', 'Colour', ['White', 'Silver', 'Black', 'Grey', 'Red', 'Blue', 'Brown', 'Green', 'Other']),
    select('seats', 'Seats', ['2', '4', '5', '6', '7', '8', '9+']),
    text('rtoState', 'RTO state / registration'),
    select('ncapRating', 'NCAP rating', ['5 star', '4 star', '3 star', '2 star', '1 star', 'Not rated']),
    select('airbags', 'Airbags', ['1', '2', '3', '4', '5', '6', '7', '8+']),
    select('features', 'Safety / popular feature', ['ABS', 'EBD', 'Traction Control', 'Airbags', 'Android Auto', 'Apple CarPlay', 'Rear AC', 'Reverse Camera', 'Sunroof', 'Alloy Wheels', 'Leather Upholstery']),
  ] },
  { slug: 'bikes', label: 'Bikes', icon: '🏍️', subcategories: subcategories(['Motorcycles', 'Scooters', 'Spare Parts', 'Bicycles']), fields: [
    text('brand', 'Brand'), text('model', 'Model'), number('year', 'Year'), number('kilometres', 'Kilometres driven'),
    number('engineCc', 'Engine capacity (cc)'), select('fuel', 'Fuel', ['Petrol', 'Electric', 'CNG', 'Other']),
    select('condition', 'Condition', ['New', 'Like new', 'Good', 'Fair']), select('owners', 'Number of owners', ['First owner', 'Second owner', 'Third owner', 'More than three']),
    select('vehicleType', 'Vehicle type', ['Motorcycle', 'Scooter', 'Bicycle', 'Spare parts']),
  ] },
  { slug: 'properties', label: 'Properties', icon: '🏢', subcategories: subcategories([
    'For Sale: Houses & Apartments', 'For Rent: Houses & Apartments', 'Lands & Plots', 'For Sale: New Projects & Properties',
    'For Rent: Shops & Offices', 'For Sale: Shops & Offices', 'PG & Guest Houses',
  ]), fields: [
    select('propertyType', 'Property type', ['Apartment', 'Independent house', 'Villa', 'Plot / land', 'Shop / office', 'PG / guest house']),
    select('bhk', 'Bedrooms / BHK', ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '4+ BHK', 'Not applicable']),
    number('bathrooms', 'Bathrooms'), number('areaSqft', 'Area (sq ft)'), number('propertyAge', 'Property age (years)'),
    select('furnishing', 'Furnishing', ['Furnished', 'Semi-furnished', 'Unfurnished']),
  ] },
  { slug: 'mobiles', label: 'Mobiles', icon: '📱', subcategories: subcategories(['Mobile Phones', 'Accessories', 'Tablets']), fields: [
    text('brand', 'Brand'), text('model', 'Model'), select('condition', 'Condition', ['New', 'Like new', 'Good', 'Fair']),
    select('storage', 'Storage', ['32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB']),
    select('ram', 'RAM', ['2 GB', '3 GB', '4 GB', '6 GB', '8 GB', '12 GB', '16 GB']),
    select('network', 'Network', ['4G', '5G', 'Other']),
  ] },
  { slug: 'electronics-appliances', label: 'Electronics & Appliances', icon: '📺', subcategories: subcategories([
    'TVs, Video - Audio', 'Home Appliances', 'Computers & Laptops', 'Cameras & Accessories', 'Other Electronics',
  ]), fields: [
    text('brand', 'Brand'), text('model', 'Model'), select('condition', 'Condition', ['New', 'Like new', 'Good', 'Fair']),
    select('applianceType', 'Item type', ['Air conditioner', 'Refrigerator', 'Washing machine', 'Cooler', 'Television', 'Laptop', 'Camera', 'Other']),
    select('warranty', 'Warranty', ['Valid', 'Expired', 'No warranty']), number('ageYears', 'Age (years)'),
  ] },
  { slug: 'commercial-vehicles', label: 'Commercial Vehicles & Spares', icon: '🚚', subcategories: subcategories(['Commercial & Other Vehicles', 'Spare Parts']), fields: [
    select('vehicleType', 'Vehicle type', ['Truck', 'Bus', 'Van', 'Three-wheeler', 'Tractor', 'Spare parts']),
    text('brand', 'Brand'), text('model', 'Model'), number('year', 'Year'), number('kilometres', 'Kilometres driven'),
    select('fuel', 'Fuel', ['Diesel', 'Petrol', 'CNG', 'Electric', 'Other']), select('condition', 'Condition', ['New', 'Good', 'Fair']),
  ] },
  { slug: 'jobs', label: 'Jobs', icon: '💼', subcategories: subcategories([
    'Data entry & Back office', 'Sales & Marketing', 'BPO & Telecaller', 'Driver', 'Office Assistant', 'Delivery & Collection',
    'Teacher', 'Cook', 'Receptionist & Front office', 'Operator & Technician', 'Other Jobs',
  ]), fields: [
    select('jobType', 'Job type', ['Full time', 'Part time', 'Contract', 'Work from home']), text('experience', 'Experience'),
    select('workMode', 'Work mode', ['On-site', 'Hybrid', 'Remote']),
    select('education', 'Education', ['Any', '10th pass', '12th pass', 'Graduate', 'Post graduate']), number('salary', 'Monthly pay (₹)'),
  ] },
  { slug: 'furniture', label: 'Furniture', icon: '🛋️', subcategories: subcategories([
    'Sofa & Dining', 'Beds & Wardrobes', 'Home Decor & Garden', 'Kids Furniture', 'Other Household Items',
  ]), fields: [
    select('condition', 'Condition', ['New', 'Like new', 'Good', 'Fair']), text('material', 'Material'),
    select('itemType', 'Item type', ['Sofa', 'Dining set', 'Bed', 'Wardrobe', 'Desk', 'Chair', 'Decor', 'Other']),
    text('color', 'Colour'),
  ] },
  { slug: 'fashion', label: 'Fashion', icon: '👗', subcategories: subcategories(['Men', 'Women', 'Kids']), fields: [
    select('condition', 'Condition', ['New with tags', 'New without tags', 'Like new', 'Good']), text('size', 'Size'),
    select('gender', 'For', ['Men', 'Women', 'Kids', 'Unisex']),
  ] },
  { slug: 'pets', label: 'Pets', icon: '🐾', subcategories: subcategories(['Fishes & Aquarium', 'Pet Food & Accessories', 'Dogs', 'Other Pets']), fields: [
    text('breed', 'Breed / type'), text('age', 'Age'), select('vaccinated', 'Vaccinated', ['Yes', 'No', 'Not applicable']),
  ] },
  { slug: 'books-sports-hobbies', label: 'Books, Sports & Hobbies', icon: '🎸', subcategories: subcategories([
    'Books', 'Gym & Fitness', 'Musical Instruments', 'Sports Equipment', 'Other Hobbies',
  ]), fields: [
    select('condition', 'Condition', ['New', 'Like new', 'Good', 'Fair']), text('brand', 'Brand / author'),
    select('itemType', 'Item type', ['Book', 'Sports equipment', 'Musical instrument', 'Fitness equipment', 'Other']),
  ] },
  { slug: 'services', label: 'Services', icon: '🛠️', subcategories: subcategories([
    'Education & Classes', 'Tours & Travel', 'Electronics Repair & Services', 'Health & Beauty', 'Home Renovation & Repair',
    'Cleaning & Pest Control', 'Legal & Documentation Services', 'Packers & Movers', 'Other Services',
  ]), fields: [
    select('serviceType', 'Service format', ['At customer location', 'At my location', 'Online', 'On-site / online']),
    text('experience', 'Experience'), text('availability', 'Availability'),
  ] },
  { slug: 'other', label: 'Other', icon: '🛍️', subcategories: subcategories(['Other items']), fields: [
    select('condition', 'Condition', ['New', 'Like new', 'Good', 'Fair']), text('brand', 'Brand'),
  ] },
]

export const getDealCategory = (slug?: string) => nextDealCategories.find(category => category.slug === slug)
