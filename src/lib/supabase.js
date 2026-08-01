import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

const isValidSupabaseUrl = typeof url === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.trim())

export const supabase = isValidSupabaseUrl && key ? createClient(url.trim(), key.trim()) : null

const productImageFiles = {
  'bogolan-throw': 'cubecandles.jpeg',
  'sunset-nairobi': 'vanilla.jpeg',
  'savannah-dusk': 'bubblegum.jpeg',
  'loomed-horizon': 'caramel.jpeg',
  'royal-triptych': 'blueberry.jpeg'
}

export const productImageUrl = productId => {
  const file = productImageFiles[productId]
  return file && isValidSupabaseUrl
    ? `${url.trim()}/storage/v1/object/public/product-images/${file}`
    : ''
}
