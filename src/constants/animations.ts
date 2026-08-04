import chefCookingAnim from '../assets/animations/chef_cooking.json';
import deliveryScooterAnim from '../assets/animations/delivery_scooter.json';
import orderProcessingAnim from '../assets/animations/order_processing.json';
import orderDeliveredAnim from '../assets/animations/order_delivered.json';
import orderCancelledAnim from '../assets/animations/order_cancelled.json';

/**
 * UI Animation Assets for the Frosty Bite App
 */
export const FROSTY_ANIMATIONS = {
  // Feedback & UI
  SUCCESS_CHECK: orderDeliveredAnim,
  ORDER_CONFIRMED: orderProcessingAnim,
  
  // Statuses
  COOKING: chefCookingAnim,
  CHEF_COOKING: chefCookingAnim,
  DELIVERY_TRUCK: deliveryScooterAnim,
  DELIVERY_SCOOTER: deliveryScooterAnim,
  PROCESSING: orderProcessingAnim,
  CANCELLED: orderCancelledAnim,
  
  // Empty states
  EMPTY_CART: orderProcessingAnim,
  CAKE: chefCookingAnim,
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
