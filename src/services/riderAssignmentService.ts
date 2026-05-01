import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
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
    const q = query(collection(db, 'riders'), where('status', '==', 'online'));
    const snapshot = await getDocs(q);
    const availableRiders = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    
    if (availableRiders.length === 0) {
      console.log('No riders available for order:', orderId);
      // Update order status to pending if not already
      await updateDoc(doc(db, 'orders', orderId), { status: 'pending' });
      return null;
    }

    // 2. Calculate distances and find the nearest rider
    let bestRider: any = null;
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

    // 3. Assign rider
    const riderDoc = await getDoc(doc(db, 'riders', bestRider.id));
    if (riderDoc.data()?.status !== 'online') {
      console.warn('Rider is no longer online, retrying assignment...');
      return assignRider(orderId, deliveryLocation); // Simple recursion for retry
    }

    // Update Order
    await updateDoc(doc(db, 'orders', orderId), {
      assigned_rider_id: bestRider.id,
      status: 'assigned'
    });

    // Update Rider
    await updateDoc(doc(db, 'riders', bestRider.id), { status: 'busy' });

    console.log(`Successfully assigned rider ${bestRider.name} to order ${orderId}`);
    return bestRider;

  } catch (error) {
    console.error('Error assigning rider:', error);
    return null;
  }
};
