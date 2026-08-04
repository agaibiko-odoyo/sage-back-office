import webpush from 'web-push';
import { supabaseAdmin } from './auth.js';

function configured() {
  const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    return true;
  } catch (error) {
    console.error('Push notifications are misconfigured', error?.message || error);
    return false;
  }
}

export async function sendPush(userIds, payload) {
  const recipients = [...new Set(userIds.filter(Boolean))];
  if (!configured()) {
    console.warn('Push notification skipped: VAPID is not configured.');
    return;
  }
  if (!recipients.length) {
    console.warn('Push notification skipped: order has no signed-in recipient.');
    return;
  }
  const db = supabaseAdmin();
  const { data: subscriptions, error } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', recipients);
  if (error) {
    console.error('Could not load push subscriptions', error);
    return;
  }
  if (!subscriptions?.length) {
    console.warn('Push notification skipped: no saved browser subscriptions for recipient.');
    return;
  }
  await Promise.allSettled((subscriptions || []).map(async subscription => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload));
      console.info('Push notification accepted by provider', { subscriptionId: subscription.id });
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', subscription.id);
      else console.error('Push delivery failed', error?.message || error);
    }
  }));
}
