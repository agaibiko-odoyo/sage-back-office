import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

const isValidSupabaseUrl = typeof url === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.trim())

export const supabase = isValidSupabaseUrl && key ? createClient(url.trim(), key.trim()) : null
