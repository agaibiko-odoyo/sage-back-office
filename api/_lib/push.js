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
    return { subscriptions: 0, accepted: 0, failed: 0, reason: 'VAPID is not configured.' };
  }
  if (!recipients.length) {
    console.warn('Push notification skipped: order has no signed-in recipient.');
    return { subscriptions: 0, accepted: 0, failed: 0, reason: 'No signed-in recipient.' };
  }
  const db = supabaseAdmin();
  const { data: subscriptions, error } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', recipients);
  if (error) {
    console.error('Could not load push subscriptions', error);
    return { subscriptions: 0, accepted: 0, failed: 0, reason: `Could not load saved subscriptions (${error.code || error.message || 'database error'}).` };
  }
  if (!subscriptions?.length) {
    console.warn('Push notification skipped: no saved browser subscriptions for recipient.');
    return { subscriptions: 0, accepted: 0, failed: 0, reason: 'No saved browser subscriptions.' };
  }
  let accepted = 0;
  let failed = 0;
  await Promise.allSettled((subscriptions || []).map(async subscription => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload));
      accepted += 1;
      console.info('Push notification accepted by provider', { subscriptionId: subscription.id });
    } catch (error) {
      failed += 1;
      if (error?.statusCode === 404 || error?.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', subscription.id);
      else console.error('Push delivery failed', error?.message || error);
    }
  }));
  return { subscriptions: subscriptions.length, accepted, failed };
}
