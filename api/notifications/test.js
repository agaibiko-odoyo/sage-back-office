import { requireAdmin } from '../_lib/auth.js';
import { sendPush } from '../_lib/push.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  const admin = await requireAdmin(request, response);
  if (!admin) return;
  try {
    const delivery = await sendPush([admin.id], { title: 'Sage Candle test', body: 'Backoffice alerts are connected on this device.', url: '/' });
    return response.status(200).json({ delivery });
  } catch (error) {
    console.error('Admin test push failed', error);
    return response.status(500).json({ error: 'Could not send the test notification.' });
  }
}
