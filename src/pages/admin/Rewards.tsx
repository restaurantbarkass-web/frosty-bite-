import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Award, Gift, Star, Shield, Trophy, Crown, Plus, Trash2, 
  Edit2, Save, X, Check, Search, TrendingUp, Sparkles, 
  Zap, Heart, Coffee, Pizza, IceCream, MessageSquare, 
  ChevronRight, ArrowRight, Settings, Users, Percent,
  ArrowUpCircle, Info, RefreshCw
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { Button } from '../../components/Button';
import { BadgeConfig } from '../../services/rewardsService';

interface GiftReward {
  id: string;
  title: string;
  image: string;
  description: string;
  requiredTier: string;
  stock: number;
  active: boolean;
  costPoints?: number;
}

const DEFAULT_BADGES: Partial<BadgeConfig>[] = [
  { tierName: 'Foodie Starter', minOrders: 0, minSpend: 0, priority: 1, themeColor: '#94A3B8', badgeIcon: 'Star', benefits: ['Standard Menu Access'] },
  { tierName: 'Snack Hunter', minOrders: 5, minSpend: 1000, priority: 2, themeColor: '#FB923C', badgeIcon: 'Zap', benefits: ['5% Cashback', 'Priority Order Processing'] },
  { tierName: 'Midnight Explorer', minOrders: 15, minSpend: 3000, priority: 3, themeColor: '#818CF8', badgeIcon: 'Moon', benefits: ['Free Midnight Delivery', '10% Cashback'] },
  { tierName: 'Gold Craver', minOrders: 30, minSpend: 7000, priority: 4, themeColor: '#FBBF24', badgeIcon: 'Crown', benefits: ['20% OFF Coupons', 'Birthday Gift', 'Exclusive Menu'] },
  { tierName: 'Platinum Foodie', minOrders: 60, minSpend: 15000, priority: 5, themeColor: '#E2E8F0', badgeIcon: 'Shield', benefits: ['VIP Support', 'Hidden Premium Dishes', 'Personal Concierge'] },
  { tierName: 'Diamond Gourmet', minOrders: 120, minSpend: 35000, priority: 6, themeColor: '#2DD4BF', badgeIcon: 'Award', benefits: ['Chef Table Invites', 'Custom Menu Orders', 'Zero Delivery Fee'] },
  { tierName: 'Elite Taste Master', minOrders: 250, minSpend: 75000, priority: 7, themeColor: '#F472B6', badgeIcon: 'Trophy', benefits: ['Lifetime Membership Card', 'Private Event Invites', 'Elite Concierge 24/7'] },
];

export const RewardsManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'badges' | 'gifts'>('badges');
  const [badges, setBadges] = useState<BadgeConfig[]>([]);
  const [gifts, setGifts] = useState<GiftReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingBadge, setIsEditingBadge] = useState<string | null>(null);
  const [isEditingGift, setIsEditingGift] = useState<string | null>(null);

  const [badgeForm, setBadgeForm] = useState<Partial<BadgeConfig>>({});
  const [giftForm, setGiftForm] = useState<Partial<GiftReward>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const bSnapshot = await getDocs(query(collection(db, 'badge_configs'), orderBy('priority', 'asc')));
      setBadges(bSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as BadgeConfig)));

      const gSnapshot = await getDocs(collection(db, 'gifts'));
      setGifts(gSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as GiftReward)));
    } catch (error) {
      console.error(error);
      toast.error('Failed to load rewards data');
    }
    setLoading(false);
  };

  const seedDefaultBadges = async () => {
    if (!window.confirm('This will seed the default tiers. Proceed?')) return;
    try {
      const batch = writeBatch(db);
      DEFAULT_BADGES.forEach(badge => {
        const ref = doc(collection(db, 'badge_configs'));
        batch.set(ref, {
          ...badge,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
      });
      await batch.commit();
      toast.success('Default tiers seeded');
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to seed tiers');
    }
  };

  const handleSaveBadge = async () => {
    try {
      if (isEditingBadge === 'new') {
        await addDoc(collection(db, 'badge_configs'), {
          ...badgeForm,
          priority: Number(badgeForm.priority),
          minOrders: Number(badgeForm.minOrders),
          minSpend: Number(badgeForm.minSpend),
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
        toast.success('Badge created');
      } else if (isEditingBadge) {
        await updateDoc(doc(db, 'badge_configs', isEditingBadge), {
          ...badgeForm,
          priority: Number(badgeForm.priority),
          minOrders: Number(badgeForm.minOrders),
          minSpend: Number(badgeForm.minSpend),
          updated_at: serverTimestamp()
        });
        toast.success('Badge updated');
      }
      setIsEditingBadge(null);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Operation failed');
    }
  };

  const handleSaveGift = async () => {
    try {
      const giftData = {
        ...giftForm,
        stock: Number(giftForm.stock),
        costPoints: Number(giftForm.costPoints || 0),
        active: giftForm.active ?? true,
      };

      if (isEditingGift === 'new') {
        await addDoc(collection(db, 'gifts'), {
          ...giftData,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
        toast.success('Gift created');
      } else if (isEditingGift) {
        await updateDoc(doc(db, 'gifts', isEditingGift), {
          ...giftData,
          updated_at: serverTimestamp()
        });
        toast.success('Gift updated');
      }
      setIsEditingGift(null);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Gift operation failed');
    }
  };

  const handleDeleteBadge = async (id: string) => {
    if (!window.confirm('Delete this tier configuration?')) return;
    try {
      await deleteDoc(doc(db, 'badge_configs', id));
      toast.success('Tier deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete tier');
    }
  };

  const handleDeleteGift = async (id: string) => {
    if (!window.confirm('Delete this gift?')) return;
    try {
      await deleteDoc(doc(db, 'gifts', id));
      toast.success('Gift deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete gift');
    }
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter italic uppercase">REWARDS ENGINE</h2>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mt-1">Manage Loyalty Tiers & Rewards</p>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={seedDefaultBadges}
            className="rounded-2xl border-white/10 hover:bg-white/5"
          >
            <RefreshCw size={16} className="mr-2" /> Seed Tiers
          </Button>
          <Button 
            variant="primary" 
            onClick={() => {
              if (activeTab === 'badges') {
                setIsEditingBadge('new');
                setBadgeForm({ priority: badges.length + 1, benefits: [] });
              } else {
                setIsEditingGift('new');
                setGiftForm({ active: true, stock: 10, requiredTier: badges[0]?.tierName || 'Foodie Starter' });
              }
            }}
            className="rounded-2xl shadow-xl shadow-primary/20"
          >
            <Plus size={16} className="mr-2" /> {activeTab === 'badges' ? 'New Tier' : 'New Gift'}
          </Button>
        </div>
      </div>

      <div className="flex p-1.5 bg-white/5 rounded-full w-fit mb-10">
        {(['badges', 'gifts'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === tab ? "bg-white text-black" : "text-zinc-500 hover:text-white"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'badges' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {badges.map(badge => (
            <motion.div
              layout
              key={badge.id}
              className="glass-dark border border-white/5 rounded-[2.5rem] p-8 group relative overflow-hidden"
            >
              <div 
                className="absolute inset-0 opacity-5 pointer-events-none"
                style={{ background: `linear-gradient(135deg, ${badge.themeColor}, transparent)` }}
              />
              
              <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start">
                <div 
                  className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl relative shrink-0"
                  style={{ backgroundColor: badge.themeColor }}
                >
                  <Award size={48} className="text-white" />
                  <div className="absolute -top-2 -right-2 bg-black text-white text-[10px] font-black w-8 h-8 rounded-full flex items-center justify-center border border-white/10">
                    #{badge.priority}
                  </div>
                </div>

                <div className="flex-1 space-y-6 text-center md:text-left">
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight uppercase italic">{badge.tierName}</h3>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-2">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                        Min Orders: <span className="text-white">{badge.minOrders}</span>
                      </span>
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                        Min Spend: <span className="text-white">₹{badge.minSpend}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    {badge.benefits?.map((benefit, i) => (
                      <span key={i} className="px-3 py-1 bg-white/5 rounded-full text-[9px] font-bold text-zinc-400 border border-white/5 uppercase">
                        ✓ {benefit}
                      </span>
                    ))}
                  </div>

                   <div className="flex justify-center md:justify-start gap-3">
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setIsEditingBadge(badge.id);
                        setBadgeForm(badge);
                      }}
                      className="rounded-xl hover:bg-white/10"
                    >
                      <Edit2 size={14} className="mr-2" /> Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleDeleteBadge(badge.id)}
                      className="rounded-xl hover:bg-red-500/10 text-red-500"
                    >
                      <Trash2 size={14} className="mr-2" /> Delete
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {gifts.length > 0 ? (
            gifts.map(gift => (
              <motion.div
                layout
                key={gift.id}
                className="glass-dark border border-white/5 rounded-[2.5rem] overflow-hidden group"
              >
                <div className="h-48 relative">
                  <img src={gift.image} alt={gift.title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-6">
                    <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
                      {gift.requiredTier}
                    </span>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="text-xl font-black text-white italic uppercase tracking-tight">{gift.title}</h3>
                    <p className="text-zinc-500 text-xs mt-1 line-clamp-2">{gift.description}</p>
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <span>Stock: <span className="text-white">{gift.stock}</span></span>
                    <span>Cost: <span className="text-white">{gift.costPoints || 0} pts</span></span>
                  </div>

                   <div className="flex gap-2 pt-2">
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setIsEditingGift(gift.id);
                        setGiftForm(gift);
                      }}
                      className="flex-1 rounded-xl hover:bg-white/10"
                    >
                      <Edit2 size={14} className="mr-2" /> Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleDeleteGift(gift.id)}
                      className="rounded-xl hover:bg-red-500/10 text-red-500"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-20 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
              <Gift size={48} className="text-zinc-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-zinc-500 uppercase tracking-widest italic">Inventory Empty</h3>
              <p className="text-zinc-600 text-xs mt-2">Create exclusive gifts for your loyal customers</p>
            </div>
          )}
        </div>
      )}

      {/* Badge Edit Modal */}
      <AnimatePresence>
        {isEditingBadge && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setIsEditingBadge(null)}
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl glass-dark border border-white/10 rounded-[2.5rem] p-10 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">
                  {isEditingBadge === 'new' ? 'Create Tier' : 'Edit Tier'}
                </h3>
                <button onClick={() => setIsEditingBadge(null)} className="p-2 hover:bg-white/10 rounded-full text-white">
                  <X />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Tier Name</label>
                  <input 
                    type="text" 
                    value={badgeForm.tierName || ''}
                    onChange={e => setBadgeForm({...badgeForm, tierName: e.target.value})}
                    placeholder="Elite Foodie"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Priority (1 = Starter)</label>
                  <input 
                    type="number" 
                    value={badgeForm.priority || ''}
                    onChange={e => setBadgeForm({...badgeForm, priority: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Min Orders</label>
                  <input 
                    type="number" 
                    value={badgeForm.minOrders || ''}
                    onChange={e => setBadgeForm({...badgeForm, minOrders: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Min Spend (₹)</label>
                  <input 
                    type="number" 
                    value={badgeForm.minSpend || ''}
                    onChange={e => setBadgeForm({...badgeForm, minSpend: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Theme Color (Hex)</label>
                  <input 
                    type="text" 
                    value={badgeForm.themeColor || ''}
                    onChange={e => setBadgeForm({...badgeForm, themeColor: e.target.value})}
                    placeholder="#F97316"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Badge Icon</label>
                  <input 
                    type="text" 
                    value={badgeForm.badgeIcon || ''}
                    onChange={e => setBadgeForm({...badgeForm, badgeIcon: e.target.value})}
                    placeholder="Crown"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Benefits (Comma separated)</label>
                  <textarea 
                    value={badgeForm.benefits?.join(', ') || ''}
                    onChange={e => setBadgeForm({...badgeForm, benefits: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                    placeholder="Free Delivery, 20% OFF, Priority Support"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none h-24"
                  />
                </div>
              </div>

              <div className="mt-10 flex gap-4">
                <Button variant="ghost" onClick={() => setIsEditingBadge(null)} className="flex-1 rounded-2xl">Cancel</Button>
                <Button variant="primary" onClick={handleSaveBadge} className="flex-1 rounded-2xl shadow-xl shadow-primary/20">
                  <Save size={16} className="mr-2" /> {isEditingBadge === 'new' ? 'Create' : 'Save Changes'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Gift Edit Modal */}
      <AnimatePresence>
        {isEditingGift && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setIsEditingGift(null)}
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl glass-dark border border-white/10 rounded-[2.5rem] p-10 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">
                  {isEditingGift === 'new' ? 'Create Gift' : 'Edit Gift'}
                </h3>
                <button onClick={() => setIsEditingGift(null)} className="p-2 hover:bg-white/10 rounded-full text-white">
                  <X />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Gift Title</label>
                  <input 
                    type="text" 
                    value={giftForm.title || ''}
                    onChange={e => setGiftForm({...giftForm, title: e.target.value})}
                    placeholder="Gourmet Dessert Box"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Image URL</label>
                  <input 
                    type="text" 
                    value={giftForm.image || ''}
                    onChange={e => setGiftForm({...giftForm, image: e.target.value})}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Required Tier</label>
                  <select 
                    value={giftForm.requiredTier || ''}
                    onChange={e => setGiftForm({...giftForm, requiredTier: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none appearance-none"
                  >
                    {badges.map(b => (
                      <option key={b.id} value={b.tierName} className="bg-zinc-900">{b.tierName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Stock</label>
                  <input 
                    type="number" 
                    value={giftForm.stock || ''}
                    onChange={e => setGiftForm({...giftForm, stock: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Cost (Points)</label>
                  <input 
                    type="number" 
                    value={giftForm.costPoints || ''}
                    onChange={e => setGiftForm({...giftForm, costPoints: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Status</label>
                  <div className="flex gap-4 p-1 bg-white/5 rounded-xl">
                    <button 
                      onClick={() => setGiftForm({...giftForm, active: true})}
                      className={cn("flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", giftForm.active ? "bg-primary text-white" : "text-zinc-500 font-bold")}
                    >Active</button>
                    <button 
                      onClick={() => setGiftForm({...giftForm, active: false})}
                      className={cn("flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", !giftForm.active ? "bg-red-500 text-white" : "text-zinc-500 font-bold")}
                    >Inactive</button>
                  </div>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Description</label>
                  <textarea 
                    value={giftForm.description || ''}
                    onChange={e => setGiftForm({...giftForm, description: e.target.value})}
                    placeholder="Describe the reward..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none h-24"
                  />
                </div>
              </div>

              <div className="mt-10 flex gap-4">
                <Button variant="ghost" onClick={() => setIsEditingGift(null)} className="flex-1 rounded-2xl">Cancel</Button>
                <Button variant="primary" onClick={handleSaveGift} className="flex-1 rounded-2xl shadow-xl shadow-primary/20">
                  <Save size={16} className="mr-2" /> {isEditingGift === 'new' ? 'Create Gift' : 'Save Changes'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RewardsManager;
