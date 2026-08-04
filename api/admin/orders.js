import { requireAdmin, supabaseAdmin } from '../_lib/auth.js';
import { sendPush } from '../_lib/push.js';

const statuses = new Set(['awaiting_confirmation', 'order_confirmed', 'departed_store', 'out_for_delivery', 'delivered_successfully']);
const labels = {
  awaiting_confirmation: 'Order received', order_confirmed: 'Order confirmed', departed_store: 'Order departed our store', out_for_delivery: 'Out for delivery', delivered_successfully: 'Delivered successfully'
};

export default async function handler(request, response) {
  const admin = await requireAdmin(request, response);
  if (!admin) return;
  if (request.method !== 'PATCH') return response.status(405).json({ error: 'Method not allowed' });
  const { orderId, status } = request.body || {};
  if (!orderId || !statuses.has(status)) return response.status(400).json({ error: 'Invalid order status update.' });
  const db = supabaseAdmin();
  const { data: order, error: readError } = await db.from('delivery_orders').select('id, order_number, user_id, status').eq('id', orderId).single();
  if (readError || !order) return response.status(404).json({ error: 'Order was not found.' });
  if (order.status === status) return response.status(200).json({ order });
  const { data: updated, error } = await db.from('delivery_orders').update({ status }).eq('id', orderId).select('id, order_number, user_id, status').single();
  if (error) return response.status(500).json({ error: 'Could not update the order status.' });
  try {
    await sendPush([updated.user_id], {
      title: `Order ${updated.order_number}`,
      body: labels[status],
      url: '/profile'
    });
  } catch (error) {
    // Fulfilment progress is authoritative even when push delivery is not.
    console.error('Order status updated, but notification delivery failed', error?.message || error);
  }
  return response.status(200).json({ order: updated });
}
