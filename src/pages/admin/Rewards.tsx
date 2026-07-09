import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Award, Gift, Star, Plus, Trash2, 
  Edit2, Save, X, RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { Button } from '../../components/Button';
import { rewardsService, BadgeConfig, GiftReward } from '../../services/rewardsService';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';

export const RewardsManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'badges' | 'gifts'>('badges');
  const [badges, setBadges] = useState<BadgeConfig[]>([]);
  const [gifts, setGifts] = useState<GiftReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingBadge, setIsEditingBadge] = useState<string | null>(null);
  const [isEditingGift, setIsEditingGift] = useState<string | null>(null);

  const [deletingBadgeId, setDeletingBadgeId] = useState<string | null>(null);
  const [deletingGiftId, setDeletingGiftId] = useState<string | null>(null);
  const [isSeedingConfirmOpen, setIsSeedingConfirmOpen] = useState(false);
  const [isSeedingLoading, setIsSeedingLoading] = useState(false);

  const [badgeForm, setBadgeForm] = useState<Partial<BadgeConfig>>({});
  const [giftForm, setGiftForm] = useState<Partial<GiftReward>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const b = await rewardsService.getBadgeConfigs();
      setBadges(b);
      const g = await rewardsService.getGifts();
      setGifts(g);
    } catch (e) {
      console.warn('Failed loading rewards config:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveBadge = async () => {
    const priorityNum = Number(badgeForm.priority || 1);
    const minOrdersNum = Number(badgeForm.minOrders || 0);
    const minSpendNum = Number(badgeForm.minSpend || 0);

    const payload = {
      ...badgeForm,
      priority: priorityNum,
      minOrders: minOrdersNum,
      minSpend: minSpendNum,
      tierName: badgeForm.tierName || 'Custom Tier',
      themeColor: badgeForm.themeColor || '#f97316',
      badgeIcon: badgeForm.badgeIcon || 'Award',
      benefits: badgeForm.benefits || [],
      couponIds: badgeForm.couponIds || [],
      giftIds: badgeForm.giftIds || [],
      freeDelivery: badgeForm.freeDelivery ?? false,
      cashbackPercent: Number(badgeForm.cashbackPercent || 0),
      prioritySupport: badgeForm.prioritySupport ?? false,
    } as BadgeConfig;

    try {
      if (isEditingBadge === 'new') {
        await rewardsService.addBadge(payload);
        toast.success('Tier badge created successfully');
      } else if (isEditingBadge) {
        await rewardsService.updateBadge(isEditingBadge, payload);
        toast.success('Tier badge updated successfully');
      }
      setIsEditingBadge(null);
      loadData();
    } catch (error) {
      toast.error('Failed to save tier badge configuration');
    }
  };

  const handleSaveGift = async () => {
    const payload = {
      ...giftForm,
      title: giftForm.title || 'New Reward Gift',
      image: giftForm.image || 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=500',
      description: giftForm.description || '',
      requiredTier: giftForm.requiredTier || 'Silver Gourmet',
      stock: Number(giftForm.stock || 10),
      active: giftForm.active ?? true,
      costPoints: Number(giftForm.costPoints || 100)
    } as GiftReward;

    try {
      if (isEditingGift === 'new') {
        await rewardsService.addGift(payload);
        toast.success('Reward gift created successfully');
      } else if (isEditingGift) {
        await rewardsService.updateGift(isEditingGift, payload);
        toast.success('Reward gift updated successfully');
      }
      setIsEditingGift(null);
      loadData();
    } catch (error) {
      toast.error('Failed to save reward gift');
    }
  };

  const handleDeleteBadge = async () => {
    if (!deletingBadgeId) return;
    try {
      await rewardsService.deleteBadge(deletingBadgeId);
      toast.success('Tier deleted successfully');
      setDeletingBadgeId(null);
      loadData();
    } catch (error) {
      toast.error('Failed to delete tier');
    }
  };

  const handleDeleteGift = async () => {
    if (!deletingGiftId) return;
    try {
      await rewardsService.deleteGift(deletingGiftId);
      toast.success('Gift deleted successfully');
      setDeletingGiftId(null);
      loadData();
    } catch (error) {
      toast.error('Failed to delete gift');
    }
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter italic uppercase">REWARDS ENGINE</h2>
          <p className="text-zinc-400 text-sm font-sans">Configure high-loyalty custom tiers, reward gifts, and system benefits.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={loadData}
            className="flex items-center gap-2 border-white/10 text-zinc-300 hover:text-white"
          >
            <RefreshCw size={15} /> Sync
          </Button>
          <Button 
            onClick={() => {
              if (activeTab === 'badges') {
                setBadgeForm({ benefits: [], couponIds: [], giftIds: [], freeDelivery: false, cashbackPercent: 0, prioritySupport: false });
                setIsEditingBadge('new');
              } else {
                setGiftForm({ active: true, stock: 10, costPoints: 100 });
                setIsEditingGift('new');
              }
            }}
            className="bg-orange-600 hover:bg-orange-500 text-white font-bold tracking-wide flex items-center gap-2"
          >
            <Plus size={16} /> {activeTab === 'badges' ? 'Add Tier' : 'Add Gift'}
          </Button>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-white/5 gap-6">
        <button
          onClick={() => setActiveTab('badges')}
          className={cn(
            "pb-4 font-black tracking-widest text-xs uppercase border-b-2 transition-all duration-200 cursor-pointer",
            activeTab === 'badges' ? "border-orange-500 text-orange-500" : "border-transparent text-zinc-400 hover:text-white"
          )}
        >
          Tiers & Badges
        </button>
        <button
          onClick={() => setActiveTab('gifts')}
          className={cn(
            "pb-4 font-black tracking-widest text-xs uppercase border-b-2 transition-all duration-200 cursor-pointer",
            activeTab === 'gifts' ? "border-orange-500 text-orange-500" : "border-transparent text-zinc-400 hover:text-white"
          )}
        >
          Claimable Gifts
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCw className="animate-spin text-orange-500" size={36} />
        </div>
      ) : activeTab === 'badges' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="space-y-6">
            {badges.map((badge) => (
              <div 
                key={badge.id}
                className="bg-zinc-900/50 backdrop-blur border border-white/5 rounded-3xl p-6 relative overflow-hidden"
              >
                <div 
                  className="absolute top-0 right-0 w-24 h-24 blur-3xl rounded-full"
                  style={{ backgroundColor: badge.themeColor + '15' }}
                />
                
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center border text-lg"
                      style={{ 
                        borderColor: badge.themeColor + '30',
                        color: badge.themeColor,
                        backgroundColor: badge.themeColor + '10' 
                      }}
                    >
                      <Award size={20} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white tracking-tight">{badge.tierName}</h4>
                      <p className="text-zinc-500 text-xs">Priority Index: {badge.priority}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setBadgeForm(badge);
                        setIsEditingBadge(badge.id);
                      }}
                      className="p-2 text-zinc-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.08] border border-white/5 rounded-xl"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => setDeletingBadgeId(badge.id)}
                      className="p-2 text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 rounded-xl"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-6 py-4 border-y border-white/5">
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-mono tracking-widest">Min Spend</span>
                    <span className="text-sm font-black text-white">₹{badge.minSpend}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-mono tracking-widest">Min Orders</span>
                    <span className="text-sm font-black text-white">{badge.minOrders}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-mono tracking-widest">Cashback</span>
                    <span className="text-sm font-black text-emerald-400">{badge.cashbackPercent}%</span>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  <span className="text-[10px] text-zinc-400 block uppercase font-mono tracking-widest mb-3">Privileges & Benefits</span>
                  {badge.benefits?.map((benefit, bIdx) => (
                    <div key={bIdx} className="flex items-center gap-2 text-xs text-zinc-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      {benefit}
                    </div>
                  ))}
                  {badge.freeDelivery && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Free standard home deliveries
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <AnimatePresence>
            {isEditingBadge && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-zinc-900 border border-white/5 rounded-3xl p-6 space-y-6 h-fit"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black text-white tracking-tight">
                    {isEditingBadge === 'new' ? 'CREATE TIER' : 'EDIT TIER'}
                  </h3>
                  <button onClick={() => setIsEditingBadge(null)} className="text-zinc-500 hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Tier Title Name</label>
                    <input 
                      type="text" 
                      value={badgeForm.tierName || ''}
                      onChange={e => setBadgeForm(p => ({ ...p, tierName: e.target.value }))}
                      className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white"
                      placeholder="e.g., Gold Connoisseur"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Min Orders Required</label>
                      <input 
                        type="number" 
                        value={badgeForm.minOrders || 0}
                        onChange={e => setBadgeForm(p => ({ ...p, minOrders: Number(e.target.value) }))}
                        className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Min Spend Required (₹)</label>
                      <input 
                        type="number" 
                        value={badgeForm.minSpend || 0}
                        onChange={e => setBadgeForm(p => ({ ...p, minSpend: Number(e.target.value) }))}
                        className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Priority Rank</label>
                      <input 
                        type="number" 
                        value={badgeForm.priority || 1}
                        onChange={e => setBadgeForm(p => ({ ...p, priority: Number(e.target.value) }))}
                        className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Cashback %</label>
                      <input 
                        type="number" 
                        value={badgeForm.cashbackPercent || 0}
                        onChange={e => setBadgeForm(p => ({ ...p, cashbackPercent: Number(e.target.value) }))}
                        className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Theme Color Code</label>
                      <input 
                        type="text" 
                        value={badgeForm.themeColor || '#f97316'}
                        onChange={e => setBadgeForm(p => ({ ...p, themeColor: e.target.value }))}
                        className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white"
                        placeholder="#ff6b00"
                      />
                    </div>
                  </div>

                  <div className="flex gap-6 py-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={badgeForm.freeDelivery || false}
                        onChange={e => setBadgeForm(p => ({ ...p, freeDelivery: e.target.checked }))}
                        className="rounded border-white/5 text-orange-500 bg-zinc-950"
                      />
                      <span className="text-xs text-zinc-300">Always Free Delivery</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={badgeForm.prioritySupport || false}
                        onChange={e => setBadgeForm(p => ({ ...p, prioritySupport: e.target.checked }))}
                        className="rounded border-white/5 text-orange-500 bg-zinc-950"
                      />
                      <span className="text-xs text-zinc-300">24/7 VIP Chat Support</span>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Benefits (Comma-separated)</label>
                    <textarea 
                      value={badgeForm.benefits?.join(', ') || ''}
                      onChange={e => setBadgeForm(p => ({ ...p, benefits: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                      className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white h-20"
                      placeholder="e.g., Double reward points, Private invite, Instant service"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setIsEditingBadge(null)} className="flex-1">Cancel</Button>
                  <Button onClick={handleSaveBadge} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold">
                    <Save size={16} className="mr-2" /> Save Tier
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="space-y-6">
            {gifts.map((gift) => (
              <div 
                key={gift.id}
                className="bg-zinc-900/50 backdrop-blur border border-white/5 rounded-3xl p-6 flex flex-col sm:flex-row gap-6 relative"
              >
                <img 
                  src={gift.image} 
                  alt={gift.title} 
                  className="w-24 h-24 object-cover rounded-2xl border border-white/5"
                  referrerPolicy="no-referrer"
                />
                
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xl font-bold text-white tracking-tight">{gift.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/10 text-orange-400 font-mono">
                          {gift.requiredTier}
                        </span>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded font-mono",
                          gift.active ? "bg-emerald-500/10 border border-emerald-500/10 text-emerald-400" : "bg-red-500/10 border border-red-500/10 text-red-400"
                        )}>
                          {gift.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setGiftForm(gift);
                          setIsEditingGift(gift.id);
                        }}
                        className="p-2 text-zinc-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.08] border border-white/5 rounded-xl"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => setDeletingGiftId(gift.id)}
                        className="p-2 text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 rounded-xl"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">{gift.description}</p>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5">
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase font-mono">Available Stock</span>
                      <span className="text-sm font-black text-white">{gift.stock} remaining</span>
                    </div>
                    {gift.costPoints && (
                      <div>
                        <span className="text-[10px] text-zinc-500 block uppercase font-mono">Cost Points</span>
                        <span className="text-sm font-black text-orange-400">{gift.costPoints} PTS</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <AnimatePresence>
            {isEditingGift && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-zinc-900 border border-white/5 rounded-3xl p-6 space-y-6 h-fit"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black text-white tracking-tight">
                    {isEditingGift === 'new' ? 'CREATE GIFT' : 'EDIT GIFT'}
                  </h3>
                  <button onClick={() => setIsEditingGift(null)} className="text-zinc-500 hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Gift Title</label>
                    <input 
                      type="text" 
                      value={giftForm.title || ''}
                      onChange={e => setGiftForm(p => ({ ...p, title: e.target.value }))}
                      className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white"
                      placeholder="e.g., Steel Thermal Bottle"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Gift Image URL</label>
                    <input 
                      type="text" 
                      value={giftForm.image || ''}
                      onChange={e => setGiftForm(p => ({ ...p, image: e.target.value }))}
                      className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white"
                      placeholder="https://images.unsplash.com..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Required Member Tier</label>
                      <select 
                        value={giftForm.requiredTier || 'Silver Gourmet'}
                        onChange={e => setGiftForm(p => ({ ...p, requiredTier: e.target.value }))}
                        className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white"
                      >
                        <option value="Foodie Starter">Foodie Starter</option>
                        <option value="Bronze Eater">Bronze Eater</option>
                        <option value="Silver Gourmet">Silver Gourmet</option>
                        <option value="Gold Connoisseur">Gold Connoisseur</option>
                        <option value="Platinum Legend">Platinum Legend</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Reward Points Cost</label>
                      <input 
                        type="number" 
                        value={giftForm.costPoints || 100}
                        onChange={e => setGiftForm(p => ({ ...p, costPoints: Number(e.target.value) }))}
                        className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Available Stock Units</label>
                      <input 
                        type="number" 
                        value={giftForm.stock || 10}
                        onChange={e => setGiftForm(p => ({ ...p, stock: Number(e.target.value) }))}
                        className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white"
                      />
                    </div>
                    <div className="flex items-end pb-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={giftForm.active ?? true}
                          onChange={e => setGiftForm(p => ({ ...p, active: e.target.checked }))}
                          className="rounded border-white/5 text-orange-500 bg-zinc-950"
                        />
                        <span className="text-xs text-zinc-300">Gift Active in Store</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Description</label>
                    <textarea 
                      value={giftForm.description || ''}
                      onChange={e => setGiftForm(p => ({ ...p, description: e.target.value }))}
                      className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white h-20"
                      placeholder="Give a charming brief description of this product..."
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setIsEditingGift(null)} className="flex-1">Cancel</Button>
                  <Button onClick={handleSaveGift} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold">
                    <Save size={16} className="mr-2" /> Save Gift
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={!!deletingBadgeId}
        onClose={() => setDeletingBadgeId(null)}
        onConfirm={handleDeleteBadge}
        title="Delete Tier Badge?"
        description="Are you sure you want to permanently delete this member tier? Eligible members will lose their associated privileges."
        confirmText="Delete Tier"
        variant="danger"
      />

      <ConfirmationModal
        isOpen={!!deletingGiftId}
        onClose={() => setDeletingGiftId(null)}
        onConfirm={handleDeleteGift}
        title="Delete Reward Gift?"
        description="Are you sure you want to permanently delete this reward gift item from the catalog?"
        confirmText="Delete Gift"
        variant="danger"
      />
    </div>
  );
};
