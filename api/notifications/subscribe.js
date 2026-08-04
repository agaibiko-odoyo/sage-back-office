import { supabaseAdmin } from '../_lib/auth.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  const db = supabaseAdmin();
  const { data } = token ? await db.auth.getUser(token) : { data: {} };
  if (!data.user) return response.status(401).json({ error: 'Please sign in first.' });
  const { endpoint, keys } = request.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) return response.status(400).json({ error: 'Invalid browser subscription.' });
  const { error } = await db.from('push_subscriptions').upsert({ user_id: data.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' });
  if (error) return response.status(500).json({ error: 'Could not save notification preference.' });
  return response.status(201).json({ message: 'Notifications enabled.' });
}
