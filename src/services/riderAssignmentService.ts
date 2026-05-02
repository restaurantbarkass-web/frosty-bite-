import { supabase } from '../supabase';
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
    const { data: availableRiders, error: fetchError } = await supabase
      .from('riders')
      .select('*')
      .eq('status', 'online');
    
    if (fetchError) throw fetchError;
    
    if (!availableRiders || availableRiders.length === 0) {
      console.log('No riders available for order:', orderId);
      // Update order status to pending if not already
      await supabase
        .from('orders')
        .update({ status: 'pending' })
        .eq('id', orderId);
      return null;
    }

    // 2. Calculate distances and find the nearest rider
    let bestRider: any = null;
    let minDistance = Infinity;

    availableRiders.forEach((rider) => {
      if (rider.location) {
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
      }
    });

    if (!bestRider) return null;

    // 3. Assign rider
    const riderId = bestRider.id;
    const { data: riderData, error: riderError } = await supabase
      .from('riders')
      .select('*')
      .eq('id', riderId)
      .single();
    
    if (riderError) throw riderError;
    
    if (!riderData || riderData.status !== 'online') {
      console.warn('Rider is no longer online, retrying assignment...');
      return assignRider(orderId, deliveryLocation); // Simple recursion for retry
    }

    // Update Order
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        rider_id: bestRider.id,
        status: 'assigned'
      })
      .eq('id', orderId);

    if (orderUpdateError) throw orderUpdateError;

    // Update Rider
    const { error: riderUpdateError } = await supabase
      .from('riders')
      .update({ status: 'busy' })
      .eq('id', bestRider.id);

    if (riderUpdateError) throw riderUpdateError;

    console.log(`Successfully assigned rider ${bestRider.name} to order ${orderId}`);
    return bestRider;

  } catch (error) {
    console.error('Error assigning rider:', error);
    return null;
  }
};
