export interface FoodItem {
  id: string;
  name: string;
  description: string;
  price: number;
  rating: number;
  image: string;
  category: string;
  stockQuantity: number;
  isRecommended?: boolean;
  available?: boolean;
}

export interface CartItem extends FoodItem {
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  customerName: string;
  items: any[];
  total: number;
  status: 'pending' | 'confirmed' | 'assigned' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  assignedRiderId?: string;
  riderId?: string;
  riderName?: string;
  deliveryLocation?: {
    lat: number;
    lng: number;
  };
  timestamp?: any;
  createdAt?: { seconds: number };
  address: string;
  phone: string;
  deliveryOtp?: string;
  notes?: string;
  paymentMethod?: 'cash' | 'online' | 'upi' | 'cod';
  paymentStatus?: 'pending' | 'paid' | 'pending_verification';
  utr?: string;
  discount?: number;
  couponCode?: string | null;
  deliveryCharge?: number;
  subtotal?: number;
  gst?: number;
  estimatedDeliveryTime?: number; // in minutes
  estimatedArrival?: string; // ISO date string
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
