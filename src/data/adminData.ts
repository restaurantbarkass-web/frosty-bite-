export interface Order {
  id: string;
  customerName: string;
  items: string[];
  total: number;
  status: 'Pending' | 'Preparing' | 'Out for delivery' | 'Delivered';
  rider?: string;
  timestamp: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  available: boolean;
}

export interface Rider {
  id: string;
  name: string;
  status: 'Online' | 'Offline' | 'On Delivery';
  currentOrder?: string;
  phone: string;
}

export const dummyOrders: Order[] = [
  {
    id: 'ORD-001',
    customerName: 'John Doe',
    items: ['Red Velvet Cake', 'Hot Chocolate'],
    total: 1420,
    status: 'Preparing',
    timestamp: '2026-03-31T10:30:00Z'
  },
  {
    id: 'ORD-002',
    customerName: 'Jane Smith',
    items: ['Butter Croissant', 'Latte'],
    total: 450,
    status: 'Pending',
    timestamp: '2026-03-31T10:45:00Z'
  },
  {
    id: 'ORD-003',
    customerName: 'Mike Johnson',
    items: ['Sourdough Loaf', 'Cookies (x6)'],
    total: 790,
    status: 'Out for delivery',
    rider: 'Rider-001',
    timestamp: '2026-03-31T10:15:00Z'
  },
  {
    id: 'ORD-004',
    customerName: 'Sarah Williams',
    items: ['Pastries Bundle'],
    total: 850,
    status: 'Delivered',
    timestamp: '2026-03-31T09:30:00Z'
  }
];

export const dummyMenu: MenuItem[] = [
  {
    id: 'MENU-001',
    name: 'Red Velvet Cake',
    price: 1200,
    category: 'Cakes',
    image: 'https://images.unsplash.com/photo-1586788680434-30d3246718d0?auto=format&fit=crop&q=80&w=200/200',
    available: true
  },
  {
    id: 'MENU-002',
    name: 'Butter Croissant',
    price: 180,
    category: 'Pastries',
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=200/200',
    available: true
  },
  {
    id: 'MENU-003',
    name: 'Sourdough Loaf',
    price: 250,
    category: 'Breads',
    image: 'https://images.unsplash.com/photo-1585478282226-1d713204d95c?auto=format&fit=crop&q=80&w=200/200',
    available: true
  },
  {
    id: 'MENU-004',
    name: 'Choco Chip Cookie',
    price: 90,
    category: 'Cookies',
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=200/200',
    available: true
  }
];

export const dummyRiders: Rider[] = [
  {
    id: 'Rider-001',
    name: 'Ahmed Khan',
    status: 'On Delivery',
    currentOrder: 'ORD-003',
    phone: '+91 9876543210'
  },
  {
    id: 'Rider-002',
    name: 'Suresh Kumar',
    status: 'Online',
    phone: '+91 9876543211'
  },
  {
    id: 'Rider-003',
    name: 'Rahul Singh',
    status: 'Offline',
    phone: '+91 9876543212'
  }
];

export const chartData = [
  { name: 'Mon', orders: 45, revenue: 12000 },
  { name: 'Tue', orders: 52, revenue: 15000 },
  { name: 'Wed', orders: 38, revenue: 11000 },
  { name: 'Thu', orders: 65, revenue: 18000 },
  { name: 'Fri', orders: 88, revenue: 25000 },
  { name: 'Sat', orders: 120, revenue: 35000 },
  { name: 'Sun', orders: 110, revenue: 32000 },
];

export const popularItemsData = [
  { name: 'Cakes', sales: 420 },
  { name: 'Pastries', sales: 680 },
  { name: 'Breads', sales: 500 },
  { name: 'Cookies', sales: 850 },
];
