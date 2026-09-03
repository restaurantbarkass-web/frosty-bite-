export interface FoodItem {
  id: string;
  name: string;
  description: string;
  ai_description?: string; // AI-optimized description for better matching
  price: number;
  rating: number;
  image: string;
  category: string;
  stock_quantity: number;
  is_recommended?: boolean;
  is_ai_boosted?: boolean; // Boosted by admin for AI recommendations
  available?: boolean;
  tags?: string[];
  barcode?: string;
  estimated_delivery_time?: number; // Estimated time of delivery in minutes
  estimated_delivery_time_unit?: 'mins' | 'days'; // Delivery time unit ('mins' or 'days')
  estimated_delivery_time_string?: string; // Optional custom string like "1-2" or "3"
  available_date?: string; // Optional specific date of availability
  available_day?: string;  // Computed day of the week for availability
}

export interface CartItem extends FoodItem {
  quantity: number;
}

export interface Order {
  id: string;
  user_id: string;
  customer_name: string;
  customerName?: string;
  email?: string;
  items: any[];
  total: number;
  status: 'awaiting_payment' | 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'ready' | 'delivered' | 'cancelled';
  order_type?: 'delivery' | 'pickup';
  delivery_location?: {
    lat: number;
    lng: number;
  };
  created_at?: string;
  updated_at?: string;
  address: string;
  delivery_address?: string;
  phone: string;
  notes?: string;
  payment_method?: 'cash' | 'online' | 'upi' | 'cod';
  payment_status?: 'pending' | 'paid' | 'pending_verification' | 'failed';
  utr?: string;
  payment_screenshot?: string;
  discount?: number;
  coupon_code?: string | null;
  delivery_charge?: number;
  subtotal?: number;
  gst?: number;
  estimated_delivery_time?: number | string; // in minutes or custom string unit (e.g. days)
  estimated_arrival?: string; // ISO date string
  delivery_date?: string; // e.g. "2026-08-29"
  delivery_time?: string; // e.g. "07:30 PM" or "Evening (03:00 PM - 06:00 PM)"
  delivery_time_slot?: string; // e.g. "evening", "midnight", "custom"
  cake_message?: string; // Text to write on the cake
  cake_occasion?: string; // e.g. "Birthday", "Anniversary"
  cake_candle_knife?: boolean; // Include candles and knife
  is_scheduled?: boolean;
  cancelled_at?: string;
  cancellation_reason?: string;
  refund_status?: 'none' | 'pending_refund' | 'refunded' | 'failed';
  total_amount?: number;
}

export interface User {
  uid: string;
  full_name: string;
  email: string;
  address: string;
  role: 'customer' | 'admin';
}

export interface Banner {
  id: string;
  title: string;
  image_url: string;
  redirect_url: string;
  priority: number;
  is_active: boolean;
  is_flash_deal?: boolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
  auto_apply_coupon?: string; // Code of coupon to auto-apply when clicked
  gift_url?: string; // Optional link to see the gift item
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_item';
  value: number; // For percentage/fixed
  min_order: number;
  expiry_date: string;
  usage_limit: number;
  usage_count: number;
  status: 'active' | 'expired' | 'disabled';
  is_hidden?: boolean;
  is_first_order_only?: boolean;
  created_at: string;
  free_item_id?: string;
  free_item_quantity?: number;
  gift_url?: string; // Optional link to see the gift item
}

export interface BannerClick {
  id: string;
  banner_id: string;
  clicked_at: string;
  user_id?: string;
}

export interface BakeryLocation {
  bakeryName?: string;
  bakeryAddress?: string;
  bakeryLatitude?: number;
  bakeryLongitude?: number;
  bakeryMapUrl?: string;
  bakeryLocationConfirmed?: boolean;
  bakeryLocationUpdatedAt?: string;
}

export interface AppConfig {
  isOrderingOpen: boolean;
  pickup_only?: boolean;
  isPickupOnly?: boolean;
  bakeryName?: string;
  bakeryAddress?: string;
  bakeryLatitude?: number;
  bakeryLongitude?: number;
  bakeryMapUrl?: string;
  bakeryLocationConfirmed?: boolean;
  bakeryLocationUpdatedAt?: string;
  feedbackUrl?: string;
  websiteUrl?: string;
  [key: string]: any;
}

