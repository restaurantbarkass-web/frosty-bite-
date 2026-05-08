export interface FoodItem {
  id: string;
  name: string;
  description: string;
  price: number;
  rating: number;
  image: string;
  category: string;
  stock_quantity: number;
  is_recommended?: boolean;
  available?: boolean;
  tags?: string[];
  barcode?: string;
}

export interface CartItem extends FoodItem {
  quantity: number;
}

export interface Order {
  id: string;
  user_id: string;
  customer_name: string;
  customerName?: string; // Add optional for backward compatibility / mixed casing
  items: any[];
  total: number;
  status: 'awaiting_payment' | 'pending' | 'confirmed' | 'assigned' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  rider_id?: string;
  rider_name?: string;
  delivery_location?: {
    lat: number;
    lng: number;
  };
  created_at?: string;
  updated_at?: string;
  address: string;
  phone: string;
  delivery_otp?: string;
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
  estimated_delivery_time?: number; // in minutes
  estimated_arrival?: string; // ISO date string
}

export interface Rider {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy' | 'on-delivery';
  location: {
    lat: number;
    lng: number;
  };
  email: string;
  phone?: string;
}

export interface User {
  uid: string;
  full_name: string;
  email: string;
  address: string;
  role: 'customer' | 'admin' | 'rider';
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
