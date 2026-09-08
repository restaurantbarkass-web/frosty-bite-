export interface FAQItem {
  id: string;
  category: FAQCategory;
  question: string;
  answer: string;
  highlights?: string[];
  tags: string[];
  isPopular?: boolean;
}

export type FAQCategory =
  | 'All'
  | 'Ordering'
  | 'Delivery'
  | 'Payments'
  | 'Cakes'
  | 'Custom Orders'
  | 'Offers'
  | 'Refunds'
  | 'Account';

export interface CategoryTab {
  id: FAQCategory;
  label: string;
  iconName: string;
  description: string;
}

export const FAQ_CATEGORIES: CategoryTab[] = [
  {
    id: 'All',
    label: 'All Questions',
    iconName: 'Sparkles',
    description: 'Browse complete answers about Frosty Bite Bakery'
  },
  {
    id: 'Ordering',
    label: 'Ordering',
    iconName: 'ShoppingBag',
    description: 'Placing, scheduling, and modifying your bakery orders'
  },
  {
    id: 'Delivery',
    label: 'Delivery',
    iconName: 'Truck',
    description: 'Coverage areas, delivery speeds, and live tracking'
  },
  {
    id: 'Payments',
    label: 'Payments',
    iconName: 'CreditCard',
    description: 'UPI, cards, payment security, and transaction queries'
  },
  {
    id: 'Cakes',
    label: 'Cakes',
    iconName: 'Cake',
    description: 'Flavors, sizes, eggless choices, and storage tips'
  },
  {
    id: 'Custom Orders',
    label: 'Custom Orders',
    iconName: 'Palette',
    description: 'Bespoke designs, celebration tiers, and lead times'
  },
  {
    id: 'Offers',
    label: 'Offers',
    iconName: 'Tag',
    description: 'Promo codes, seasonal discounts, and loyalty rewards'
  },
  {
    id: 'Refunds',
    label: 'Refunds',
    iconName: 'RotateCcw',
    description: 'Cancellation policy, damaged goods, and refunds'
  },
  {
    id: 'Account',
    label: 'Account',
    iconName: 'User',
    description: 'Profile management, password resets, and notifications'
  }
];

export const FAQ_ITEMS: FAQItem[] = [
  // ORDERING
  {
    id: 'order-place',
    category: 'Ordering',
    question: 'How can I place an order?',
    answer: 'Ordering at Frosty Bite is effortless! Simply browse our artisanal dessert and cake collections, select your desired flavor, weight, and egg/eggless preference, and add the item to your cart. Proceed to checkout, provide your delivery address or select store pickup, choose your preferred payment method, and confirm. You will receive an instant confirmation receipt and live tracking link.',
    highlights: [
      'Choose from handcrafted bento, standard, or custom cakes',
      'Select delivery address or convenient store pickup',
      'Instant order confirmation with SMS/WhatsApp updates'
    ],
    tags: ['order', 'how to order', 'buy', 'cart', 'checkout', 'steps'],
    isPopular: true
  },
  {
    id: 'order-cancel',
    category: 'Ordering',
    question: 'Can I cancel my order?',
    answer: 'Yes, you can cancel standard orders before the kitchen begins baking or preparing your items. Simply go to "My Orders" or tap the "Cancel Order" button in your live order tracking screen. For custom or personalized celebration cakes already in decoration, cancellation is permitted up to 4 hours before the scheduled dispatch slot.',
    highlights: [
      'Instant cancellation available prior to baking preparation',
      'Eligible cancellations receive immediate wallet credit or original payment refund'
    ],
    tags: ['cancel', 'cancellation', 'stop order', 'change mind'],
    isPopular: true
  },
  {
    id: 'order-account-needed',
    category: 'Ordering',
    question: 'Do I need an account to place an order?',
    answer: 'No, guest checkout is supported for quick cravings! However, creating a free Frosty Bite account takes just 15 seconds and unlocks exclusive perks including real-time order tracking, saved delivery addresses, member-only promo codes, and loyalty reward points on every bite.',
    highlights: [
      'Guest checkout available without mandatory registration',
      'Registered accounts earn Frosty loyalty points and quick reordering'
    ],
    tags: ['account', 'guest', 'signup', 'login', 'register'],
    isPopular: false
  },
  {
    id: 'order-advance-booking',
    category: 'Ordering',
    question: 'Can I schedule an order for a future date or midnight surprise?',
    answer: 'Absolutely! During checkout, you can select your preferred delivery date and time slot, including our signature midnight delivery slots (11:30 PM – 12:15 AM) perfect for birthday and anniversary surprises.',
    highlights: [
      'Schedule up to 30 days in advance',
      'Midnight celebration slots available across active delivery zones'
    ],
    tags: ['schedule', 'midnight', 'future', 'advance', 'birthday slot'],
    isPopular: false
  },

  // DELIVERY
  {
    id: 'del-home-delivery',
    category: 'Delivery',
    question: 'Do you provide home delivery?',
    answer: 'Yes! Frosty Bite provides dedicated, temperature-controlled doorstep delivery for all our fresh cakes, pastries, savories, and beverages. Our delivery partners use custom shock-absorbent cake carriers to guarantee your cake arrives in pristine, display-ready condition.',
    highlights: [
      'Temperature-controlled, shock-absorbent delivery boxes',
      'Direct doorstep hand-off with contact-free options'
    ],
    tags: ['delivery', 'home delivery', 'doorstep', 'shipping'],
    isPopular: true
  },
  {
    id: 'del-areas',
    category: 'Delivery',
    question: 'Which areas do you deliver to?',
    answer: 'We currently serve major zones across Cuttack and Bhubaneswar, including CDA Sectors, Badambadi, Link Road, Patia, Saheed Nagar, Khandagiri, Nayapalli, and surrounding localities. You can enter your exact pincode or use our live GPS location checker at the top of the website to verify instant coverage.',
    highlights: [
      'Full coverage in Cuttack & Bhubaneswar central & suburban zones',
      'Real-time GPS geofence checker available on our home and checkout screens'
    ],
    tags: ['areas', 'locations', 'cuttack', 'bhubaneswar', 'pincode', 'zones'],
    isPopular: true
  },
  {
    id: 'del-time',
    category: 'Delivery',
    question: 'How long does delivery take?',
    answer: 'For in-stock signature cakes, pastries, and snacks, our standard delivery timeframe is 30 to 45 minutes from order confirmation. Custom design cakes and handcrafted artisan tiers are baked fresh upon request and delivered according to your chosen scheduling window.',
    highlights: [
      '30–45 minutes for standard menu favorites',
      'Precision time-slot scheduling for customized celebration cakes'
    ],
    tags: ['time', 'duration', 'speed', 'fast delivery', 'eta', 'how long'],
    isPopular: true
  },
  {
    id: 'del-tracking',
    category: 'Delivery',
    question: 'Can I track my order?',
    answer: 'Yes! As soon as your order is confirmed, you can access our live Order Tracking screen. You will see real-time status updates as your order transitions from "Order Received" to "Baking & Crafting", "Quality Inspection", "Out for Delivery", and "Delivered" with live delivery updates.',
    highlights: [
      'Live kitchen stage progress and rider dispatch notifications',
      'Direct WhatsApp and SMS status alerts'
    ],
    tags: ['track', 'tracking', 'live status', 'order status', 'rider location'],
    isPopular: true
  },

  // PAYMENTS
  {
    id: 'pay-methods',
    category: 'Payments',
    question: 'What payment methods do you accept?',
    answer: 'We accept a wide variety of safe and encrypted payment options: Instant UPI (Google Pay, PhonePe, Paytm, BHIM, CRED), Credit/Debit Cards (Visa, MasterCard, RuPay), Net Banking across all major Indian banks, Frosty Wallet Credits, and Cash on Delivery (COD) for eligible serviceable locations.',
    highlights: [
      'Zero-fee instant UPI with direct QR code & app intent',
      '256-bit SSL encrypted card and banking gateway',
      'Cash on Delivery available on qualifying cart values'
    ],
    tags: ['payment methods', 'how to pay', 'cards', 'cash', 'cod', 'netbanking'],
    isPopular: true
  },
  {
    id: 'pay-upi',
    category: 'Payments',
    question: 'Can I pay using UPI?',
    answer: 'Yes, UPI is our fastest and most popular checkout method! You can tap to open Google Pay, PhonePe, or Paytm directly on mobile, or scan the dynamic on-screen QR code on desktop. Payments are confirmed instantly without manual delay.',
    highlights: [
      'One-tap mobile app switching for Google Pay, PhonePe & Paytm',
      'Dynamic high-resolution QR code for desktop screen scanning'
    ],
    tags: ['upi', 'gpay', 'phonepe', 'paytm', 'qr code', 'bhim'],
    isPopular: true
  },
  {
    id: 'pay-failed',
    category: 'Payments',
    question: 'What happens if my payment fails or amount is debited without confirmation?',
    answer: 'If money is deducted from your bank account but your order is not generated due to a network glitch, our automated reconciliation system detects it within 15 minutes. In most cases, the funds are reversed by your bank within 24 to 48 hours. You can also share your UTR transaction ID with our support team on WhatsApp for immediate manual verification.',
    highlights: [
      'Automated banking reconciliation within 15 minutes',
      'Dedicated WhatsApp billing desk for instant UTR lookup'
    ],
    tags: ['payment failed', 'deducted', 'refund pending', 'utr', 'double charge'],
    isPopular: false
  },

  // CAKES
  {
    id: 'cake-flavor-size',
    category: 'Cakes',
    question: 'Can I choose my cake flavor and size?',
    answer: 'Yes! Every cake in our artisan catalog offers customizable size choices: 300g Bento Cakes, 500g (0.5 kg), 1 kg, 1.5 kg, and 2 kg+ celebratory tier options. You can also select your preferred flavor profile such as Belgian Dark Truffle, Fresh Mango Bliss, Dutch Chocolate, Red Velvet Cream Cheese, Rasmalai Fusion, and Classic Vanilla Bean.',
    highlights: [
      'Portion sizes from single-serve bento up to 5kg grand celebration tiers',
      'Over 20+ signature flavors made with authentic Swiss cocoa & real fruit purées'
    ],
    tags: ['flavor', 'size', 'weight', 'kg', 'bento', 'flavors', 'vanilla', 'chocolate'],
    isPopular: true
  },
  {
    id: 'cake-eggless',
    category: 'Cakes',
    question: 'Are all your cakes available in 100% Eggless options?',
    answer: 'Yes! We take dietary choices very seriously. All Frosty Bite cakes, bento boxes, and sweet pastries are available in 100% pure vegetarian (Eggless) formulations baked in dedicated, certified preparation zones without compromising on moisture or richness.',
    highlights: [
      '100% Eggless vegetarian certified preparation available across all menu items',
      'Green vegetarian dietary badge visible on every product page'
    ],
    tags: ['eggless', 'veg', 'vegetarian', 'dietary', 'egg-free'],
    isPopular: true
  },
  {
    id: 'cake-storage',
    category: 'Cakes',
    question: 'How should I store my cake and what is its shelf life?',
    answer: 'Fresh cream and mousse cakes should be refrigerated at 2°C to 5°C immediately upon arrival and consumed within 48 hours for optimal flavor and texture. Fondant and butter-cream cakes should be stored in an air-conditioned room away from direct heat and sunlight. Bring cream cakes to room temperature 10 minutes before slicing for peak velvety indulgence.',
    highlights: [
      'Refrigerate fresh cream & fruit cakes at 2°C to 5°C',
      'Best consumed within 48 hours of delivery'
    ],
    tags: ['storage', 'fridge', 'shelf life', 'freshness', 'preservation', 'expiry'],
    isPopular: false
  },

  // CUSTOM ORDERS
  {
    id: 'custom-customize',
    category: 'Custom Orders',
    question: 'Can I customize my cake?',
    answer: 'Yes! We specialize in bespoke cake creations. You can customize the name inscription, age plaque, frosting colors, custom themed toppers, edible photoprints, 3D fondant figurines, and multi-tier structural designs. You can also chat directly with our AI Cake Butler or pastry team on WhatsApp to share your inspiration images.',
    highlights: [
      'Complimentary custom message piping & celebration candle set',
      'High-resolution edible photo cakes and themed 3D fondant artistry',
      'Direct WhatsApp consultation for custom anniversary & wedding tiers'
    ],
    tags: ['custom', 'customize', 'photo cake', 'fondant', 'theme', 'message', 'name on cake'],
    isPopular: true
  },
  {
    id: 'custom-lead-time',
    category: 'Custom Orders',
    question: 'How early should I order a custom cake?',
    answer: 'For standard photo cakes and customized bento designs, an advance notice of 4 to 6 hours is sufficient. For elaborate multi-tier wedding cakes, hand-sculpted 3D fondant masterpieces, or large corporate dessert tables, we recommend placing your order 24 to 48 hours in advance.',
    highlights: [
      '4–6 hours advance notice for photo cakes & customized bentos',
      '24–48 hours for elaborate 3D fondant and grand wedding tiers'
    ],
    tags: ['advance', 'how early', 'lead time', 'preparation time', 'custom timing'],
    isPopular: true
  },

  // OFFERS
  {
    id: 'offers-coupon',
    category: 'Offers',
    question: 'How do I use a coupon code?',
    answer: 'To apply a promotional discount, navigate to your Cart or the Checkout screen and locate the "Apply Promo Code" field. Enter your coupon code (e.g. FIRSTBITE, SWEET10, CELEBRATE) or tap any active coupon card on our Offers page to automatically apply the maximum eligible discount.',
    highlights: [
      'One-tap auto-apply from the Offers page',
      'Real-time discount calculation shown in your cart summary'
    ],
    tags: ['coupon', 'promo code', 'discount', 'voucher', 'how to apply'],
    isPopular: true
  },
  {
    id: 'offers-loyalty',
    category: 'Offers',
    question: 'How do loyalty points work?',
    answer: 'With the Frosty Bite Sweet Rewards Program, registered members earn 5% cashback points on every single order value. 1 Frosty Point = ₹1. You can redeem your accumulated points seamlessly at checkout for instant price cuts or complimentary pastries with no minimum redemption threshold.',
    highlights: [
      'Earn 5% points back on every celebration order',
      '1 Point = ₹1 with seamless one-click redemption at checkout'
    ],
    tags: ['loyalty', 'points', 'rewards', 'cashback', 'frosty points'],
    isPopular: true
  },

  // REFUNDS
  {
    id: 'refund-eligibility',
    category: 'Refunds',
    question: 'Can I get a refund?',
    answer: 'Yes. If an order is cancelled prior to kitchen preparation or if there is a verified quality issue, your refund will be processed promptly. Refunds to Frosty Wallet Credits are credited instantly, while refunds to your original bank account or UPI ID are completed within 2 to 4 business days depending on your financial institution.',
    highlights: [
      'Instant refund to Frosty Wallet for immediate reordering',
      '2–4 working days for bank account / UPI reversals'
    ],
    tags: ['refund', 'money back', 'reversal', 'return money'],
    isPopular: true
  },
  {
    id: 'refund-damaged',
    category: 'Refunds',
    question: 'What should I do if my order arrives damaged?',
    answer: 'We uphold our 100% Frosty Freshness & Quality Guarantee. In the rare event of transit damage or an incorrect item, please take a quick photograph of the product and contact our emergency hotline via WhatsApp or the app within 2 hours of delivery. We will immediately dispatch a fresh replacement on priority or issue a 100% instant full refund.',
    highlights: [
      '100% Frosty Freshness & Pristine Arrival Guarantee',
      'Instant priority remake/replacement or full 100% refund upon photo verification'
    ],
    tags: ['damaged', 'broken', 'wrong item', 'complaint', 'quality issue', 'replacement'],
    isPopular: true
  },

  // ACCOUNT
  {
    id: 'acc-forgot-password',
    category: 'Account',
    question: 'What should I do if I forget my password?',
    answer: 'If you have forgotten your password, go to the Login screen and click "Forgot Password?". Enter your registered email address or phone number to receive an instant secure reset link or OTP. Follow the instructions to create a new password and log back into your sweet haven instantly.',
    highlights: [
      'Instant OTP or email password reset link within 10 seconds',
      'Secure password recovery compliant with modern encryption standards'
    ],
    tags: ['forgot password', 'reset password', 'cannot login', 'recover account'],
    isPopular: true
  },
  {
    id: 'acc-profile-update',
    category: 'Account',
    question: 'How can I update my delivery address or phone number?',
    answer: 'You can update your profile details anytime by visiting the "Profile" section. Here you can add multiple saved addresses (e.g. Home, Office, Party Venue), update your primary contact number, and set your dietary preferences.',
    highlights: [
      'Save unlimited delivery addresses with custom labels',
      'Quick switch default address during checkout'
    ],
    tags: ['profile', 'address', 'phone number', 'change address', 'update details'],
    isPopular: false
  }
];
