import { supabase } from './supabase'

const keyBytes = key => {
  const value = `${key}${'='.repeat((4 - key.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(value), char => char.charCodeAt(0))
}

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export async function enablePush() {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY
  const { data: { session } } = await supabase.auth.getSession()
  if (!pushSupported() || !key || !session?.access_token) throw new Error('Notifications are not configured for this browser.')
  if (await Notification.requestPermission() !== 'granted') throw new Error('Notification permission was not granted.')
  await navigator.serviceWorker.register('/push-sw.js')
  const registration = await navigator.serviceWorker.ready
  const existingSubscription = await registration.pushManager.getSubscription()
  if (existingSubscription) await existingSubscription.unsubscribe()
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) })
  const result = await fetch('/api/notifications/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(subscription) })
  if (!result.ok) throw new Error((await result.json().catch(() => ({}))).error || 'Could not enable notifications.')
}
