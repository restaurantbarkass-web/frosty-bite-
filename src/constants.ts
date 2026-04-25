import { FoodItem } from './types';

export const ADMIN_EMAILS = [
  "admin1@gmail.com",
  "owner@frostybite.com",
  "restaurantbarkass@gmail.com", // Keeping the original bootstrap admin
  "wasifmd924@gmail.com",
  "sayedazainab216@gmail.com",
  "sayedazainabali76@gmail.com"
];

export const RIDER_EMAILS = [
  "rider1@gmail.com",
  "delivery@frostybite.com"
];

export const RESTAURANT_WHATSAPP = "917735800239"; // Updated restaurant number

export type UserRole = 'admin' | 'rider' | 'customer';

export const getRoleFromEmail = (email: string | null): UserRole => {
  if (!email) return 'customer';
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return 'admin';
  if (RIDER_EMAILS.includes(email.toLowerCase())) return 'rider';
  return 'customer';
};

export const CATEGORIES = ['Cakes', 'Pastries', 'Breads', 'Cookies', 'Beverages'];

export const MENU_ITEMS: FoodItem[] = [
  {
    id: '1',
    name: 'Red Velvet Cake',
    description: 'Silky smooth crimson sponge layered with rich cream cheese frosting.',
    price: 1200,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1586788680434-30d3246718d0?auto=format&fit=crop&q=80&w=800',
    category: 'Cakes',
    stockQuantity: 10
  },
  {
    id: '2',
    name: 'Butter Croissant',
    description: 'Flaky, golden-brown layers of pure buttery goodness, baked fresh daily.',
    price: 180,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=800',
    category: 'Pastries',
    stockQuantity: 20
  },
  {
    id: '3',
    name: 'Sourdough Loaf',
    description: 'Naturally leavened with a 50-year-old starter for a perfect crust and tangy crumb.',
    price: 250,
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1585478282226-1d713204d95c?auto=format&fit=crop&q=80&w=800',
    category: 'Breads',
    stockQuantity: 15
  },
  {
    id: '4',
    name: 'Choco Chip Cookie',
    description: 'Soft-baked with oversized chunks of premium Belgian dark chocolate.',
    price: 90,
    rating: 4.6,
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=800',
    category: 'Cookies',
    stockQuantity: 50
  },
  {
    id: '5',
    name: 'Belgian Hot Chocolate',
    description: 'Thick, creamy hot cocoa made with melted dark chocolate and frothed milk.',
    price: 220,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1544787210-2211d44b5042?auto=format&fit=crop&q=80&w=800',
    category: 'Beverages',
    stockQuantity: 30
  }
];
