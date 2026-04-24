/**
 * UI Animation Assets for the Frosty Bite App
 */
export const FROSTY_ANIMATIONS = {
  // Feedback & UI
  SUCCESS_CHECK: "https://assets10.lottiefiles.com/packages/lf20_mye7bg9j.json", // Sample real success check
  ORDER_CONFIRMED: "https://assets10.lottiefiles.com/packages/lf20_mye7bg9j.json",
  
  // Statuses
  COOKING: "https://assets1.lottiefiles.com/packages/lf20_N9Z9mG.json",
  DELIVERY_TRUCK: "https://assets1.lottiefiles.com/packages/lf20_N9Z9mG.json",
  PROCESSING: "https://assets1.lottiefiles.com/packages/lf20_N9Z9mG.json",
  
  // Empty states
  EMPTY_CART: "https://assets5.lottiefiles.com/packages/lf20_qh5z2fdq.json",
  CAKE: "https://assets5.lottiefiles.com/packages/lf20_qh5z2fdq.json",
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
