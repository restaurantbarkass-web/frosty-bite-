import { supabase } from '../supabase';

export const supabaseService = {
  // Improved error handler
  handleError(error: any) {
      if (error.code === 'PGRST204' || error.code === 'PGRST205' || error.code === '42703' || (error.message && error.message.includes('schema cache'))) {
        console.error("SUPABASE CONFIG ERROR: Database table or column not found. You likely added a new feature (like Coupons) but haven't updated your Supabase SQL yet.", error);
      }
    if (error.code === '22P02' && error.message.includes('uuid')) {
      console.error('SUPABASE TYPE ERROR: Expected UUID but got a different string format. Your database user_id column likely needs to be changed from UUID to TEXT to support Firebase UIDs.', error);
    }
    if (error.code === '42883') {
      console.error('SUPABASE TYPE MISMATCH: You are trying to compare a Text UID with a UUID column. Please run the SQL migration to change ID columns to TEXT.', error);
    }
    if (error.code === '42501') {
      console.error('SUPABASE RLS ERROR: Row Level Security violation. You likely need to enable INSERT/UPDATE policies for the table in your Supabase Dashboard.', error);
    }
    if (error.code === '23503') {
      console.error('SUPABASE FOREIGN KEY ERROR: You are trying to insert a record that references a non-existent parent. Check if the user exists in the users table.', error);
    }
    return error;
  },

  // Generic Fetch
  async fetchData<T>(table: string, queryBuilder?: (q: any) => any) {
    let q = supabase.from(table).select('*');
    if (queryBuilder) {
      q = queryBuilder(q);
    }
    const { data, error } = await q;
    if (error) throw this.handleError(error);
    return data as T[];
  },

  // Generic Insert
  async insertData<T>(table: string, data: any) {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select();
    if (error) throw this.handleError(error);
    return (result && result[0]) as T;
  },

  // Generic Get Single
  async fetchSingle<T>(table: string, id: string, idField: string = 'id') {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(idField, id)
      .single();
    if (error) throw this.handleError(error);
    return data as T;
  },

  // Generic Upsert
  async upsertData<T>(table: string, data: any, idField: string = 'id') {
    const { data: result, error } = await supabase
      .from(table)
      .upsert(data, { onConflict: idField })
      .select();
    if (error) throw this.handleError(error);
    return (result && result[0]) as T;
  },

  // Generic Update
  async updateData(table: string, id: string, data: any, idField: string = 'id') {
    const { data: result, error } = await supabase
      .from(table)
      .update(data)
      .eq(idField, id)
      .select();
    if (error) throw this.handleError(error);
    return result && result[0];
  },

  // Generic Delete
  async deleteData(table: string, id: string, idField: string = 'id') {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(idField, id);
    if (error) throw error;
  },

  // Centralized Order Cancellation with inventory restoration & logging
  async cancelOrder(orderId: string, reason: string, cancelledBy: 'customer' | 'admin', userId: string) {
    // 1. Fetch order details to know what items and total are there
    const order = await supabaseService.fetchSingle<any>('orders', orderId);
    if (!order) throw new Error('Order not found');

    const totalAmount = order.total || order.subtotal || 0;

    // Check monthly limit if cancelled by customer
    if (cancelledBy === 'customer') {
      const targetUserId = userId || order.user_id;
      const count = await supabaseService.getMonthlyCancellationCount(targetUserId, order.phone);
      if (count >= 3) {
        throw new Error('Cancellation limit exceeded. Customers can only cancel their order up to thrice (3 times) a month.');
      }
    }

    // 2. Perform the update on orders table: Set status='cancelled', cancelled_at, cancellation_reason, refund_status, total_amount
    const isOnlinePayment = order.payment_method === 'online' || order.payment_method === 'upi';
    const refundStatus = isOnlinePayment ? 'pending_refund' : 'none';

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        refund_status: refundStatus,
        total_amount: totalAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) throw updateError;

    // 3. Restore inventory (stock_quantity in products table)
    if (order.items && Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.id) {
          try {
            // Get current stock
            const { data: product } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', item.id)
              .single();
            
            if (product) {
              const newStock = (product.stock_quantity || 0) + (item.quantity || 1);
              await supabase
                .from('products')
                .update({ stock_quantity: newStock, available: true })
                .eq('id', item.id);
            }
          } catch (err) {
            console.error(`Failed to restore stock for item ${item.id}:`, err);
          }
        }
      }
    }

    // 4. Create cancellation logs
    try {
      await supabase
        .from('cancellation_logs')
        .insert({
          order_id: orderId,
          user_id: userId || order.user_id,
          reason: reason,
          cancelled_by: cancelledBy,
          created_at: new Date().toISOString()
        });
    } catch (err) {
      console.error('Failed to create cancellation log:', err);
    }

    return { ...order, status: 'cancelled', cancellation_reason: reason, refund_status: refundStatus, cancelled_at: new Date().toISOString() };
  },

  // Get monthly cancellation count for a user (or phone for guest)
  async getMonthlyCancellationCount(userId: string, phone?: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthISO = startOfMonth.toISOString();

    let query = supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .gte('cancelled_at', startOfMonthISO);

    if (userId && userId !== 'guest' && userId !== '') {
      query = query.eq('user_id', userId);
    } else if (phone) {
      query = query.eq('phone', phone);
    } else {
      return 0;
    }

    const { count, error } = await query;
    if (error) {
      console.error('Error fetching monthly cancellation count:', error);
      return 0;
    }
    return count || 0;
  },

  // Real-time subscription helper
  subscribe(table: string, callback: (payload: any) => void, filter?: string) {
    let channel = supabase.channel(`public:${table}`);
    
    if (filter) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        (payload) => callback(payload)
      );
    } else {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => callback(payload)
      );
    }

    return channel.subscribe();
  }
};
