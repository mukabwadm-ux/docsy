export type ProductStatus = 'active' | 'draft' | 'archived'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'
export type ReviewSource = 'seed' | 'visitor'
export type ManualOrderStatus = 'pending' | 'delivered'

/** One block of the product page's story section. */
export interface StoryBlock {
  heading?: string
  body?: string
  image_url?: string
}

/** One numbered step in the how-it-works strip. */
export interface HowItWorksStep {
  step_number?: number
  title?: string
  caption?: string
  image_url?: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort_order: number
}

export interface ProductImage {
  id: string
  product_id?: string
  image_url: string
  alt_text: string | null
  sort_order: number
}

/**
 * The public shape of a product.
 *
 * `file_url` is absent by design — the anon role has no grant on that column
 * (migration 0003), so a public query naming it fails outright. It appears only
 * on AdminProduct below.
 */
export interface Product {
  id: string
  title: string
  slug: string
  description: string | null
  short_description: string | null
  benefits: string[]
  story_content: StoryBlock[]
  how_it_works: HowItWorksStep[]
  announcement_text: string | null
  price: number
  compare_at_price: number | null
  currency: string
  category_id: string | null
  file_size_mb: number | null
  file_type: string | null
  preview_image_url: string | null
  is_featured: boolean
  views_count: number
  sales_count: number
  rating_avg: number
  rating_count: number
  status: ProductStatus
  created_at: string
  updated_at: string

  // Joined
  categories?: Category | null
  product_images?: ProductImage[]
}

/** Adds the columns only the secret-key client can see. */
export interface AdminProduct extends Product {
  file_url: string | null
}

export interface Review {
  id: string
  product_id: string
  reviewer_name: string
  reviewer_location: string | null
  rating: number
  review_text: string | null
  source: ReviewSource
  is_verified_purchase: boolean
  status: ReviewStatus
  created_at: string
  products?: { title: string; slug: string } | null
}

export interface ManualOrder {
  id: string
  product_id: string | null
  buyer_email: string
  buyer_name: string | null
  note: string | null
  amount: number | null
  currency: string
  status: ManualOrderStatus
  delivered_at: string | null
  created_at: string
  products?: { title: string; slug: string; file_type: string | null } | null
}

export type CatalogSort = 'newest' | 'price-asc' | 'price-desc' | 'rating' | 'popular'
