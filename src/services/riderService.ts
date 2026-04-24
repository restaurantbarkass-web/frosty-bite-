import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc, 
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { sendOTP } from '../utils/whatsapp';

export const riderService = {
  // Listen for assigned orders
  subscribeToAssignedOrders: (riderId: string, callback: (orders: any[]) => void) => {
    const q = query(
      collection(db, 'orders'),
      where('assignedRiderId', '==', riderId),
      where('status', 'in', ['assigned', 'preparing', 'out_for_delivery'])
    );

    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(orders);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders');
    });
  },

  // Update order status
  updateOrderStatus: async (orderId: string, status: string) => {
    const orderRef = doc(db, 'orders', orderId);
    const updateData: any = { 
      status,
      updatedAt: serverTimestamp()
    };

    // If status is "out_for_delivery", generate and send OTP
    if (status === 'out_for_delivery') {
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      updateData.deliveryOtp = otp;

      // Fetch order to get customer phone
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const order = orderSnap.data();
        if (order.phone) {
          sendOTP(order.phone, otp);
        }
      }
    }

    await updateDoc(orderRef, updateData);
  },

  // Update rider status
  updateRiderStatus: async (riderId: string, status: 'online' | 'offline' | 'busy') => {
    const riderRef = doc(db, 'riders', riderId);
    await updateDoc(riderRef, { 
      status,
      lastActive: serverTimestamp()
    });
  },

  // Update rider location
  updateRiderLocation: async (riderId: string, lat: number, lng: number) => {
    const riderRef = doc(db, 'riders', riderId);
    await updateDoc(riderRef, { 
      location: { lat, lng },
      lastLocationUpdate: serverTimestamp()
    });
  },

  // Fetch rider earnings/stats
  getRiderStats: async (riderId: string) => {
    const riderRef = doc(db, 'riders', riderId);
    const snap = await getDoc(riderRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  }
};
