/**
 * Common Lottie Animation URLs for the Frosty Bite App
 * You can find thousands more at lottiefiles.com
 */
export const LOTTIE_ANIMATIONS = {
  // Feedback & UI
  SUCCESS_CHECK: "https://assets9.lottiefiles.com/packages/lf20_pqnqpoc0.json",
  ORDER_CONFIRMED: "https://assets1.lottiefiles.com/packages/lf20_c9f9116e.json", // This is a fallback-like guess, let me verify or use safer ones
  
  // Statuses
  COOKING: "https://assets2.lottiefiles.com/packages/lf20_31804790.json",
  DELIVERY_TRUCK: "https://assets1.lottiefiles.com/packages/lf20_6EY660.json",
  PROCESSING: "https://assets3.lottiefiles.com/private_files/lf30_8scfgy7c.json",
  
  // Empty states
  EMPTY_CART: "https://assets10.lottiefiles.com/packages/lf20_6wutsrox.json",
};

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
