import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc,
  serverTimestamp,
  increment,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from './firestoreService';

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

export const rewardsService = {
  // Get all badge configurations ordered by priority
  async getBadgeConfigs(): Promise<BadgeConfig[]> {
    try {
      const q = query(collection(db, 'badge_configs'), orderBy('priority', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BadgeConfig));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'badge_configs');
      return [];
    }
  },

  // Calculate and update user tier based on stats
  async updateUserTier(userId: string): Promise<{ previousTier: string; newTier: string } | null> {
    try {
      return await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists()) return null;
        
        const userData = userSnap.data();
        const currentTier = userData.badge_tier || 'Foodie Starter';
        const totalOrders = userData.total_orders || 0;
        const lifetimeSpend = userData.lifetime_spend || 0;

        // Get all configs to find the highest eligible tier
        const badgeConfigsRef = collection(db, 'badge_configs');
        const badgeConfigsSnap = await getDocs(query(badgeConfigsRef, orderBy('priority', 'desc')));
        const badgeConfigs = badgeConfigsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BadgeConfig));

        let eligibleTier = 'Foodie Starter';
        for (const config of badgeConfigs) {
          if (totalOrders >= config.minOrders && lifetimeSpend >= config.minSpend) {
            eligibleTier = config.tierName;
            break;
          }
        }

        if (eligibleTier !== currentTier) {
          transaction.update(userRef, {
            badge_tier: eligibleTier,
            updated_at: serverTimestamp()
          });
          return { previousTier: currentTier, newTier: eligibleTier };
        }

        return null;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      return null;
    }
  },

  // Add order stats to user
  async processOrderForRewards(userId: string, orderTotal: number) {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        total_orders: increment(1),
        lifetime_spend: increment(orderTotal),
        points: increment(Math.floor(orderTotal / 10)), // 1 point for every 10 units spent
        updated_at: serverTimestamp()
      });
      
      // Attempt tier upgrade
      const upgradeResult = await this.updateUserTier(userId);
      return upgradeResult;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  },

  // Gift Management
  async getGifts(): Promise<GiftReward[]> {
    try {
      const snapshot = await getDocs(collection(db, 'gifts'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftReward));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'gifts');
      return [];
    }
  },

  async addGift(gift: Omit<GiftReward, 'id'>) {
    try {
      return await addDoc(collection(db, 'gifts'), {
        ...gift,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'gifts');
    }
  },

  async updateGift(id: string, gift: Partial<GiftReward>) {
    try {
      await updateDoc(doc(db, 'gifts', id), {
        ...gift,
        updated_at: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `gifts/${id}`);
    }
  },

  async deleteGift(id: string) {
    try {
      await deleteDoc(doc(db, 'gifts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `gifts/${id}`);
    }
  },

  async claimGift(userId: string, giftId: string): Promise<boolean> {
    try {
      return await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const giftRef = doc(db, 'gifts', giftId);
        
        const [userSnap, giftSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(giftRef)
        ]);

        if (!userSnap.exists() || !giftSnap.exists()) {
          throw new Error('User or Gift not found');
        }

        const userData = userSnap.data();
        const giftData = giftSnap.data() as GiftReward;

        // Check eligibility
        if (giftData.stock <= 0) throw new Error('Gift out of stock');
        if (!giftData.active) throw new Error('Gift is not active');
        
        // Check tier (needs to be equal or higher)
        const badgeConfigsRef = collection(db, 'badge_configs');
        const badgeConfigsSnap = await getDocs(query(badgeConfigsRef, orderBy('priority', 'asc')));
        const configs = badgeConfigsSnap.docs.map(d => d.data() as BadgeConfig);
        
        const userTierPriority = configs.find(c => c.tierName === userData.badge_tier)?.priority || 0;
        const requiredTierPriority = configs.find(c => c.tierName === giftData.requiredTier)?.priority || 0;

        if (userTierPriority < requiredTierPriority) {
          throw new Error(`Reach ${giftData.requiredTier} tier to claim this gift!`);
        }

        // Check points if applicable
        if (giftData.costPoints && (userData.points || 0) < giftData.costPoints) {
          throw new Error('Insufficient reward points');
        }

        // Process claim
        transaction.update(userRef, {
          points: increment(-(giftData.costPoints || 0)),
          claimedGifts: Array.isArray(userData.claimedGifts) 
            ? [...userData.claimedGifts, { giftId, claimedAt: new Date().toISOString() }]
            : [{ giftId, claimedAt: new Date().toISOString() }]
        });

        transaction.update(giftRef, {
          stock: increment(-1)
        });

        return true;
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to claim gift');
      return false;
    }
  }
};

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
