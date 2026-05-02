import { supabase } from '../supabase';
import { sendOTP } from '../utils/whatsapp';

export const riderService = {
  // Listen for assigned orders
  subscribeToAssignedOrders: (riderId: string, callback: (orders: any[]) => void) => {
    // Initial fetch
    supabase
      .from('orders')
      .select('*')
      .eq('rider_id', riderId)
      .in('status', ['assigned', 'preparing', 'out_for_delivery'])
      .then(({ data }) => {
        if (data) callback(data);
      });

    // Real-time subscribe
    const channel = supabase
      .channel(`rider_orders_${riderId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: `rider_id=eq.${riderId}`
      }, async () => {
        const { data } = await supabase
          .from('orders')
          .select('*')
          .eq('rider_id', riderId)
          .in('status', ['assigned', 'preparing', 'out_for_delivery']);
        if (data) callback(data);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // Update order status
  updateOrderStatus: async (orderId: string, status: string) => {
    const updateData: any = { 
      status,
      updated_at: new Date().toISOString()
    };

    // If status is "out_for_delivery", generate and send OTP
    if (status === 'out_for_delivery') {
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      updateData.delivery_otp = otp;

      // Fetch order to get customer phone
      const { data: orderData } = await supabase
        .from('orders')
        .select('phone')
        .eq('id', orderId)
        .single();
      
      if (orderData?.phone) {
        sendOTP(orderData.phone, otp);
      }
    }

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);
    
    if (error) throw error;
  },

  // Update rider status
  updateRiderStatus: async (riderId: string, status: 'online' | 'offline' | 'busy') => {
    const { error } = await supabase
      .from('riders')
      .update({ 
        status,
        last_active: new Date().toISOString()
      })
      .eq('id', riderId);
    
    if (error) throw error;
  },

  // Update rider location
  updateRiderLocation: async (riderId: string, lat: number, lng: number) => {
    const { error } = await supabase
      .from('riders')
      .update({ 
        location: { lat, lng },
        last_location_update: new Date().toISOString()
      })
      .eq('id', riderId);
    
    if (error) throw error;
  },

  // Fetch rider earnings/stats
  getRiderStats: async (riderId: string) => {
    const { data, error } = await supabase
      .from('riders')
      .select('*')
      .eq('id', riderId)
      .single();
    
    if (error) throw error;
    return data;
  }
};
