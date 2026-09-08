import chefCookingAnim from '../assets/animations/chef_cooking.json';
import deliveryScooterAnim from '../assets/animations/delivery_scooter.json';
import orderProcessingAnim from '../assets/animations/order_processing.json';
import orderDeliveredAnim from '../assets/animations/order_delivered.json';
import orderCancelledAnim from '../assets/animations/order_cancelled.json';

/**
 * UI Animation Asset keys and mappings for the Frosty Bite App
 */
export const FROSTY_ANIMATIONS = {
  // Feedback & UI
  SUCCESS_CHECK: 'delivered',
  ORDER_CONFIRMED: 'order_confirmed',
  
  // Statuses
  COOKING: 'chef_cooking',
  CHEF_COOKING: 'chef_cooking',
  DELIVERY_TRUCK: 'delivery_scooter',
  DELIVERY_SCOOTER: 'delivery_scooter',
  PROCESSING: 'processing',
  CANCELLED: 'cancelled',
  
  // Empty states
  EMPTY_CART: 'empty_cart',
  CAKE: 'empty_cart',
  
  // Raw JSON files if needed
  JSON_CHEF: chefCookingAnim,
  JSON_SCOOTER: deliveryScooterAnim,
  JSON_PROCESSING: orderProcessingAnim,
  JSON_DELIVERED: orderDeliveredAnim,
  JSON_CANCELLED: orderCancelledAnim,
};

// Aliased for backward compatibility
export const LOTTIE_ANIMATIONS = FROSTY_ANIMATIONS;


/**
 * CODE EXAMPLE: Using a local JSON file
 * 
 * 1. Download your animation from LottieFiles as JSON
 * 2. Place it in /src/assets/animations/
 * 3. Import it:
 *    import cookingAnim from '../assets/animations/cooking.json';
 * 
 * 4. Pass it directly to lottie-react:
 *    <Lottie animationData={cookingAnim} />
 */
