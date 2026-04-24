import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { Order, Rider } from '../types';

/**
 * Calculates the distance between two points using the Haversine formula.
 * Returns distance in kilometers.
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Automatically assigns the best available rider to an order.
 */
export const assignRider = async (orderId: string, deliveryLocation: { lat: number, lng: number }) => {
  try {
    // 1. Fetch available riders (online)
    const ridersRef = collection(db, 'riders');
    const q = query(ridersRef, where('status', '==', 'online'));
    const querySnapshot = await getDocs(q);
    
    const availableRiders: Rider[] = [];
    querySnapshot.forEach((doc) => {
      availableRiders.push({ id: doc.id, ...doc.data() } as Rider);
    });

    if (availableRiders.length === 0) {
      console.log('No riders available for order:', orderId);
      // Update order status to pending if not already
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'pending'
      });
      return null;
    }

    // 2. Calculate distances and find the nearest rider
    let bestRider: Rider | null = null;
    let minDistance = Infinity;

    availableRiders.forEach((rider) => {
      const distance = calculateDistance(
        rider.location.lat, 
        rider.location.lng, 
        deliveryLocation.lat, 
        deliveryLocation.lng
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        bestRider = rider;
      }
    });

    if (!bestRider) return null;

    // 3. Assign rider using a transaction to ensure atomicity
    const orderRef = doc(db, 'orders', orderId);
    const riderRef = doc(db, 'riders', (bestRider as Rider).id);

    await runTransaction(db, async (transaction) => {
      const riderDoc = await transaction.get(riderRef);
      if (!riderDoc.exists()) throw new Error("Rider does not exist!");
      
      const riderData = riderDoc.data() as Rider;
      if (riderData.status !== 'online') {
        throw new Error("Rider is no longer available!");
      }

      // Update Order
      transaction.update(orderRef, {
        assignedRiderId: (bestRider as Rider).id,
        status: 'assigned'
      });

      // Update Rider
      transaction.update(riderRef, {
        status: 'busy'
      });
    });

    console.log(`Successfully assigned rider ${(bestRider as Rider).name} to order ${orderId}`);
    return bestRider;

  } catch (error) {
    console.error('Error assigning rider:', error);
    // If it's a "no longer available" error, we could potentially retry once
    return null;
  }
};
