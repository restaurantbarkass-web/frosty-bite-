import { db } from '../firebase';
import { collection, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { safeFirestore } from './firestoreService';
import { sendOTP } from '../utils/whatsapp';

export const riderService = {
  // Listen for assigned orders
  subscribeToAssignedOrders: (riderId: string, callback: (orders: any[]) => void) => {
    const q = query(
      collection(db, 'orders'),
      where('assigned_rider_id', '==', riderId),
      where('status', 'in', ['assigned', 'preparing', 'out_for_delivery'])
    );

    return safeFirestore.listen(q, (orders: any[]) => {
      callback(orders);
    }, `rider_orders_${riderId}`);
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
      const orderData = await safeFirestore.getDocument<any>(doc(db, 'orders', orderId), `order_${orderId}`);
      
      if (orderData?.phone) {
        sendOTP(orderData.phone, otp);
      }
    }

    await updateDoc(doc(db, 'orders', orderId), updateData);
  },

  // Update rider status
  updateRiderStatus: async (riderId: string, status: 'online' | 'offline' | 'busy') => {
    await updateDoc(doc(db, 'riders', riderId), { 
      status,
      last_active: new Date().toISOString()
    });
  },

  // Update rider location
  updateRiderLocation: async (riderId: string, lat: number, lng: number) => {
    await updateDoc(doc(db, 'riders', riderId), { 
      location: { lat, lng },
      last_location_update: new Date().toISOString()
    });
  },

  // Fetch rider earnings/stats
  getRiderStats: async (riderId: string) => {
    return await safeFirestore.getDocument<any>(doc(db, 'riders', riderId), `rider_stats_${riderId}`);
  }
};
