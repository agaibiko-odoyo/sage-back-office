import webpush from 'web-push';
import { supabaseAdmin } from './auth.js';

function configured() {
  const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return true;
}

export async function sendPush(userIds, payload) {
  if (!configured() || !userIds.filter(Boolean).length) return;
  const db = supabaseAdmin();
  const { data: subscriptions } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', [...new Set(userIds.filter(Boolean))]);
  await Promise.allSettled((subscriptions || []).map(async subscription => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload));
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', subscription.id);
      else console.error('Push delivery failed', error?.message || error);
    }
  }));
}
