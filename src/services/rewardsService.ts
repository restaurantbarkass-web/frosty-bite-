import { supabase } from '../supabase';
import { toast } from 'react-hot-toast';

export interface BadgeConfig {
  id: string;
  tierName: string;
  minOrders: number;
  minSpend: number;
  benefits: string[];
  couponIds: string[];
  giftIds: string[];
  freeDelivery: boolean;
  cashbackPercent: number;
  prioritySupport: boolean;
  themeColor: string;
  badgeIcon: string;
  priority: number;
}

export interface UserRewards {
  badge_tier: string;
  total_orders: number;
  reward_points: number;
  activity_streak: number;
  lifetime_spend: number;
  points: number;
}

export interface GiftReward {
  id: string;
  title: string;
  image: string;
  description: string;
  requiredTier: string;
  stock: number;
  active: boolean;
  costPoints?: number;
}

const DEFAULT_BADGES: BadgeConfig[] = [
  {
    id: 'badge_starter',
    tierName: 'Foodie Starter',
    minOrders: 0,
    minSpend: 0,
    benefits: ['Earn 1 Reward Point per ₹10 spent', 'Access to exclusive flash sales'],
    couponIds: [],
    giftIds: [],
    freeDelivery: false,
    cashbackPercent: 0,
    prioritySupport: false,
    themeColor: '#6B7280',
    badgeIcon: 'Utensils',
    priority: 1
  },
  {
    id: 'badge_bronze',
    tierName: 'Bronze Eater',
    minOrders: 5,
    minSpend: 1000,
    benefits: ['Earn 1 Reward Point per ₹10 spent', 'Bronze birthday surprise dessert coupon', '5% Off on premium ice creams'],
    couponIds: ['BRONZE_BDAY'],
    giftIds: [],
    freeDelivery: false,
    cashbackPercent: 2,
    prioritySupport: false,
    themeColor: '#CD7F32',
    badgeIcon: 'Coffee',
    priority: 2
  },
  {
    id: 'badge_silver',
    tierName: 'Silver Gourmet',
    minOrders: 15,
    minSpend: 3500,
    benefits: ['Earn 1.2x Reward Points per ₹10 spent', 'Silver birthday exclusive meal coupon', 'Free delivery on orders above ₹300', '5% Cashback on all orders'],
    couponIds: ['SILVER_BDAY'],
    giftIds: ['gift_silver_shaker'],
    freeDelivery: true,
    cashbackPercent: 5,
    prioritySupport: false,
    themeColor: '#C0C0C0',
    badgeIcon: 'Cake',
    priority: 3
  },
  {
    id: 'badge_gold',
    tierName: 'Gold Connoisseur',
    minOrders: 30,
    minSpend: 8000,
    benefits: ['Earn 1.5x Reward Points per ₹10 spent', 'Gold VIP exclusive rewards', 'Free delivery on orders above ₹199', '10% Cashback on all orders', '24/7 Priority chat support'],
    couponIds: ['GOLD_BDAY', 'GOLD_VIP_10'],
    giftIds: ['gift_gold_mug'],
    freeDelivery: true,
    cashbackPercent: 10,
    prioritySupport: true,
    themeColor: '#FFD700',
    badgeIcon: 'Award',
    priority: 4
  },
  {
    id: 'badge_platinum',
    tierName: 'Platinum Legend',
    minOrders: 60,
    minSpend: 15000,
    benefits: ['Earn 2x Reward Points per ₹10 spent', 'Platinum private custom events invitation', 'Always Free Delivery', '15% Cashback on all orders', 'Dedicated 24/7 VIP Concierge Manager'],
    couponIds: ['PLATINUM_BDAY', 'PLATINUM_VIP_15', 'PLATINUM_FREE_SHAKE'],
    giftIds: ['gift_platinum_hamper'],
    freeDelivery: true,
    cashbackPercent: 15,
    prioritySupport: true,
    themeColor: '#E5E4E2',
    badgeIcon: 'Crown',
    priority: 5
  }
];

const DEFAULT_GIFTS: GiftReward[] = [
  {
    id: 'gift_silver_shaker',
    title: 'Frosty Bite Metallic Shaker',
    image: 'https://images.unsplash.com/photo-1574158622643-69d34d72650a?w=500',
    description: 'A premium, insulated double-wall metallic shaker to keep your thick milkshakes ice cold for up to 12 hours.',
    requiredTier: 'Silver Gourmet',
    stock: 25,
    active: true,
    costPoints: 200
  },
  {
    id: 'gift_gold_mug',
    title: 'Gold Connoisseur Embossed Mug',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500',
    description: 'A luxurious custom-embossed matte ceramic mug featuring safe heat-reactive gold-flake patterns.',
    requiredTier: 'Gold Connoisseur',
    stock: 12,
    active: true,
    costPoints: 500
  },
  {
    id: 'gift_platinum_hamper',
    title: 'Platinum Legend Limited Gift Hamper',
    image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=500',
    description: 'An ultimate VIP gift hamper consisting of a premium insulated steel flask, custom brand apron, and hand-crafted artisanal chocolate truffles.',
    requiredTier: 'Platinum Legend',
    stock: 5,
    active: true,
    costPoints: 1200
  }
];

export const rewardsService = {
  // Get all badge configurations ordered by priority
  async getBadgeConfigs(): Promise<BadgeConfig[]> {
    try {
      const cached = localStorage.getItem('rewards_badges_cache');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}
    return DEFAULT_BADGES;
  },

  async addBadge(badge: Omit<BadgeConfig, 'id'>) {
    const id = `badge_${Date.now()}`;
    const newBadge = { id, ...badge };
    try {
      const current = await this.getBadgeConfigs();
      const updated = [...current, newBadge].sort((a, b) => a.priority - b.priority);
      localStorage.setItem('rewards_badges_cache', JSON.stringify(updated));
    } catch (e) {}
    return { id };
  },

  async updateBadge(id: string, badge: Partial<BadgeConfig>) {
    try {
      const current = await this.getBadgeConfigs();
      const updated = current.map(b => b.id === id ? { ...b, ...badge } : b).sort((a, b) => a.priority - b.priority);
      localStorage.setItem('rewards_badges_cache', JSON.stringify(updated));
    } catch (e) {}
  },

  async deleteBadge(id: string) {
    try {
      const current = await this.getBadgeConfigs();
      const updated = current.filter(b => b.id !== id);
      localStorage.setItem('rewards_badges_cache', JSON.stringify(updated));
    } catch (e) {}
  },

  // Calculate and update user tier based on stats
  async updateUserTier(userId: string): Promise<{ previousTier: string; newTier: string } | null> {
    try {
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (userErr || !user) return null;

      const currentTier = user.badge_tier || 'Foodie Starter';
      const totalOrders = user.total_orders || 0;
      const lifetimeSpend = user.lifetime_spend || 0;

      let eligibleTier = 'Foodie Starter';
      const badges = await this.getBadgeConfigs();
      // Find highest eligible tier
      for (const config of [...badges].reverse()) {
        if (totalOrders >= config.minOrders && lifetimeSpend >= config.minSpend) {
          eligibleTier = config.tierName;
          break;
        }
      }

      if (eligibleTier !== currentTier) {
        await supabase
          .from('users')
          .update({
            badge_tier: eligibleTier,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
        return { previousTier: currentTier, newTier: eligibleTier };
      }

      return null;
    } catch (error) {
      console.error('[RewardsService] Error updating user tier:', error);
      return null;
    }
  },

  // Add order stats to user
  async processOrderForRewards(userId: string, orderTotal: number) {
    try {
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (userErr || !user) return null;

      const updatedOrders = (user.total_orders || 0) + 1;
      const updatedSpend = (user.lifetime_spend || 0) + orderTotal;
      const pointsEarned = Math.floor(orderTotal / 10);
      const updatedPoints = (user.points || 0) + pointsEarned;

      await supabase
        .from('users')
        .update({
          total_orders: updatedOrders,
          lifetime_spend: updatedSpend,
          points: updatedPoints,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      const upgradeResult = await this.updateUserTier(userId);
      return upgradeResult;
    } catch (error) {
      console.error('[RewardsService] Error processing order rewards:', error);
    }
  },

  // Gift Management
  async getGifts(): Promise<GiftReward[]> {
    try {
      const cached = localStorage.getItem('rewards_gifts_cache');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}
    return DEFAULT_GIFTS;
  },

  async addGift(gift: Omit<GiftReward, 'id'>) {
    const id = `gift_${Date.now()}`;
    const newGift = { id, ...gift };
    try {
      const current = await this.getGifts();
      const updated = [...current, newGift];
      localStorage.setItem('rewards_gifts_cache', JSON.stringify(updated));
    } catch (e) {}
    return { id };
  },

  async updateGift(id: string, gift: Partial<GiftReward>) {
    try {
      const current = await this.getGifts();
      const updated = current.map(g => g.id === id ? { ...g, ...gift } : g);
      localStorage.setItem('rewards_gifts_cache', JSON.stringify(updated));
    } catch (e) {}
  },

  async deleteGift(id: string) {
    try {
      const current = await this.getGifts();
      const updated = current.filter(g => g.id !== id);
      localStorage.setItem('rewards_gifts_cache', JSON.stringify(updated));
    } catch (e) {}
  },

  async claimGift(userId: string, giftId: string): Promise<boolean> {
    try {
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (userErr || !user) {
        throw new Error('User not found');
      }

      const giftsList = await this.getGifts();
      const giftIndex = giftsList.findIndex(g => g.id === giftId);
      if (giftIndex === -1) {
        throw new Error('Gift reward not found');
      }
      const giftData = giftsList[giftIndex];

      if (giftData.stock <= 0) throw new Error('Gift out of stock');
      if (!giftData.active) throw new Error('Gift is not active');

      const badges = await this.getBadgeConfigs();
      const userTierPriority = badges.find(c => c.tierName === (user.badge_tier || 'Foodie Starter'))?.priority || 0;
      const requiredTierPriority = badges.find(c => c.tierName === giftData.requiredTier)?.priority || 0;

      if (userTierPriority < requiredTierPriority) {
        throw new Error(`Reach ${giftData.requiredTier} tier to claim this gift!`);
      }

      if (giftData.costPoints && (user.points || 0) < giftData.costPoints) {
        throw new Error('Insufficient reward points');
      }

      const updatedPoints = (user.points || 0) - (giftData.costPoints || 0);
      const claimedGifts = Array.isArray(user.claimedGifts) 
        ? [...user.claimedGifts, { giftId, claimedAt: new Date().toISOString() }]
        : [{ giftId, claimedAt: new Date().toISOString() }];

      // Deduct points and save claimed gift
      await supabase
        .from('users')
        .update({
          points: updatedPoints,
          claimedGifts,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      // Decrement stock in local cache
      giftData.stock = Math.max(0, giftData.stock - 1);
      giftsList[giftIndex] = giftData;
      localStorage.setItem('rewards_gifts_cache', JSON.stringify(giftsList));

      toast.success('Successfully claimed gift reward!');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to claim gift');
      return false;
    }
  }
};
