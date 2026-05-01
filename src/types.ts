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
}

export interface CartItem extends FoodItem {
  quantity: number;
}

export interface Order {
  id: string;
  user_id: string;
  customer_name: string;
  items: any[];
  total: number;
  status: 'pending' | 'confirmed' | 'assigned' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  assigned_rider_id?: string;
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
  payment_status?: 'pending' | 'paid' | 'pending_verification';
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
  status: 'online' | 'offline' | 'busy';
  location: {
    lat: number;
    lng: number;
  };
  email: string;
  phone?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  address: string;
}
