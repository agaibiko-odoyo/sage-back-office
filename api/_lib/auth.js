import { createClient } from '@supabase/supabase-js';

export function supabaseAdmin() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('Server database access is not configured.');
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
}

export async function requireAdmin(request, response) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  const db = supabaseAdmin();
  const { data, error } = token ? await db.auth.getUser(token) : { data: {}, error: true };
  const allowed = (process.env.ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (error || !data.user?.email || !allowed.includes(data.user.email.toLowerCase())) {
    response.status(403).json({ error: 'Administrator access is required.' });
    return null;
  }
  return data.user;
}
