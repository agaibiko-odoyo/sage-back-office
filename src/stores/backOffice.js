import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'

const errorMessage = error => error?.message || 'Something went wrong. Please try again.'

export const useBackOfficeStore = defineStore('backOffice', {
  state: () => ({
    ready: false, session: null, authError: '', dataError: '', loading: false,
    activeView: 'orders', selectedOrder: null, query: '', status: 'all',
    orders: [], products: [], deliveryMethods: [], statusDraft: '', paymentReferenceDraft: '', credentials: { email: '', password: '' }
  }),
  getters: {
    filteredOrders: state => state.orders.filter(order => {
      const haystack = `${order.order_number} ${order.customer_name} ${order.customer_email || ''} ${order.customer_phone || ''}`.toLowerCase()
      return (!state.query || haystack.includes(state.query.toLowerCase())) && (state.status === 'all' || order.status === state.status)
    }),
    statuses: () => [
      'awaiting_confirmation',
      'order_confirmed',
      'departed_store',
      'out_for_delivery',
      'delivered_successfully'
    ],
    customers: state => Object.values(state.orders.reduce((all, order) => {
      const key = order.customer_email || order.customer_phone || order.customer_name
      if (!all[key]) all[key] = { name: order.customer_name, email: order.customer_email, phone: order.customer_phone, orders: 0, spend: 0, lastOrder: order.created_at, city: order.city }
      all[key].orders += 1
      all[key].spend += Number(order.total)
      if (order.created_at > all[key].lastOrder) all[key].lastOrder = order.created_at
      return all
    }, {})),
    orderTotal: state => state.orders.reduce((total, order) => total + Number(order.total), 0),
    confirmedPayments: state => state.orders.filter(order => order.mpesa_payments?.[0]?.mpesa_reference).length
  },
  actions: {
    async initialise() {
      if (!supabase) { this.authError = 'Supabase configuration is missing or invalid. Check the Vercel VITE_SUPABASE_URL setting.'; this.ready = true; return }
      const { data } = await supabase.auth.getSession()
      this.session = data.session
      this.ready = true
      supabase.auth.onAuthStateChange((_event, session) => { this.session = session; if (session) this.loadData(); else this.clearData() })
      if (this.session) await this.loadData()
    },
    clearData() { this.orders = []; this.products = []; this.deliveryMethods = []; this.selectedOrder = null; this.dataError = '' },
    async signIn() {
      this.authError = ''; this.loading = true
      const { error } = await supabase.auth.signInWithPassword(this.credentials)
      this.loading = false
      if (error) this.authError = errorMessage(error)
    },
    async signOut() { await supabase.auth.signOut() },
    async loadData() {
      this.loading = true; this.dataError = ''
      const [orders, products, methods] = await Promise.all([
        supabase.from('delivery_orders').select('id, order_number, customer_name, customer_email, customer_phone, address, city, postal_code, delivery_notes, delivery_method, subtotal, shipping_cost, total, status, created_at, user_id, delivery_order_items(id, product_id, product_name, quantity, unit_price), mpesa_payments(id, phone_number, amount, status, result_code, result_description, mpesa_receipt_number, mpesa_reference, created_at)').order('created_at', { ascending: false }),
        supabase.from('products').select('id, name, price, is_active, updated_at').order('name'),
        supabase.from('delivery_methods').select('id, name, cost, is_active').order('name')
      ])
      this.loading = false
      const failed = [orders, products, methods].find(result => result.error)
      if (failed) { this.dataError = errorMessage(failed.error); return }
      this.orders = orders.data || []; this.products = products.data || []; this.deliveryMethods = methods.data || []
    },
    openOrder(order) { this.selectedOrder = order; this.statusDraft = order.status; this.paymentReferenceDraft = order.mpesa_payments?.[0]?.mpesa_reference || ''; this.activeView = 'order-detail' },
    navigate(view) { this.activeView = view; this.selectedOrder = null },
    async updateStatus() {
      if (!this.selectedOrder || !this.statusDraft || this.statusDraft === this.selectedOrder.status) return
      this.loading = true
      const { error } = await supabase.from('delivery_orders').update({ status: this.statusDraft }).eq('id', this.selectedOrder.id)
      this.loading = false
      if (error) { this.dataError = errorMessage(error); return }
      this.selectedOrder.status = this.statusDraft
      const found = this.orders.find(order => order.id === this.selectedOrder.id)
      if (found) found.status = this.statusDraft
    },
    async toggleProduct(product) {
      const { error } = await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id)
      if (error) { this.dataError = errorMessage(error); return }
      product.is_active = !product.is_active
    },
    async savePaymentReference(confirmPayment = false) {
      const payment = this.selectedOrder?.mpesa_payments?.[0]
      if (!payment) { this.dataError = 'This order does not have an M-Pesa payment record to update.'; return }
      this.loading = true
      const changes = { mpesa_reference: this.paymentReferenceDraft.trim() || null }
      if (confirmPayment) changes.status = 'paid'
      const { data, error } = await supabase.from('mpesa_payments').update(changes).eq('id', payment.id).select('mpesa_reference, status').single()
      this.loading = false
      if (error) { this.dataError = errorMessage(error); return }
      payment.mpesa_reference = data.mpesa_reference
      payment.status = data.status
    }
  }
})
