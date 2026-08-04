import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../_lib/auth.js';

function userScopedDb(accessToken) {
  return createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
    accessToken: async () => accessToken
  });
}

export default async function handler(request, response) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  const adminDb = supabaseAdmin();
  const { data } = token ? await adminDb.auth.getUser(token) : { data: {} };
  if (!data.user) return response.status(401).json({ error: 'Please sign in first.' });
  const db = userScopedDb(token);
  if (request.method === 'GET') {
    const { data: subscription, error } = await db.from('push_subscriptions').select('id').eq('user_id', data.user.id).limit(1).maybeSingle();
    if (error) return response.status(500).json({ error: `Could not check notification preference (${error.code || 'database error'}).` });
    return response.status(200).json({ enabled: Boolean(subscription) });
  }
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  const { endpoint, keys } = request.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) return response.status(400).json({ error: 'Invalid browser subscription.' });
  const { error } = await db.from('push_subscriptions').upsert({ user_id: data.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' });
  if (error) {
    console.error('Could not save push subscription', { code: error.code, message: error.message, details: error.details });
    return response.status(500).json({ error: `Could not save notification preference (${error.code || 'database error'}).` });
  }
  return response.status(201).json({ message: 'Notifications enabled.' });
}
