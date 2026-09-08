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
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 shadow-xs">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight uppercase">REWARDS & LOYALTY ENGINE</h2>
          <p className="text-stone-500 text-xs sm:text-sm font-medium mt-0.5">Configure high-loyalty custom tiers, reward gifts, and member benefits.</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Button 
            variant="outline" 
            onClick={loadData}
            className="flex items-center gap-2 border-stone-200 bg-[#FAF8F5] text-stone-700 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
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
            className="bg-[#E76A54] hover:bg-[#d55b45] text-white font-bold tracking-wide flex items-center gap-2 shadow-md shadow-[#E76A54]/25 cursor-pointer"
          >
            <Plus size={16} /> {activeTab === 'badges' ? 'Add Tier' : 'Add Gift'}
          </Button>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-stone-200 gap-6">
        <button
          onClick={() => setActiveTab('badges')}
          className={cn(
            "pb-3.5 font-black tracking-wider text-xs uppercase border-b-2 transition-all duration-200 cursor-pointer",
            activeTab === 'badges' ? "border-[#E76A54] text-[#E76A54]" : "border-transparent text-stone-400 hover:text-stone-700"
          )}
        >
          Tiers & Badges ({badges.length})
        </button>
        <button
          onClick={() => setActiveTab('gifts')}
          className={cn(
            "pb-3.5 font-black tracking-wider text-xs uppercase border-b-2 transition-all duration-200 cursor-pointer",
            activeTab === 'gifts' ? "border-[#E76A54] text-[#E76A54]" : "border-transparent text-stone-400 hover:text-stone-700"
          )}
        >
          Claimable Gifts ({gifts.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCw className="animate-spin text-[#E76A54]" size={36} />
        </div>
      ) : activeTab === 'badges' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            {badges.map((badge) => (
              <div 
                key={badge.id}
                className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-6 relative overflow-hidden shadow-xs"
              >
                <div 
                  className="absolute top-0 right-0 w-24 h-24 blur-3xl rounded-full opacity-30"
                  style={{ backgroundColor: badge.themeColor || '#E76A54' }}
                />
                
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center border text-lg shrink-0"
                      style={{ 
                        borderColor: (badge.themeColor || '#E76A54') + '30',
                        color: badge.themeColor || '#E76A54',
                        backgroundColor: (badge.themeColor || '#E76A54') + '15' 
                      }}
                    >
                      <Award size={22} />
                    </div>
                    <div>
                      <h4 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">{badge.tierName}</h4>
                      <p className="text-stone-400 text-xs font-medium">Priority Index: {badge.priority}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setBadgeForm(badge);
                        setIsEditingBadge(badge.id);
                      }}
                      className="p-2 text-stone-500 hover:text-stone-900 bg-[#FAF8F5] hover:bg-stone-100 border border-stone-200 rounded-xl cursor-pointer"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => setDeletingBadgeId(badge.id)}
                      className="p-2 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-5 py-3.5 border-y border-stone-100">
                  <div>
                    <span className="text-[10px] text-stone-400 block uppercase font-mono font-bold tracking-wider">Min Spend</span>
                    <span className="text-sm font-black text-stone-900">₹{badge.minSpend}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block uppercase font-mono font-bold tracking-wider">Min Orders</span>
                    <span className="text-sm font-black text-stone-900">{badge.minOrders}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block uppercase font-mono font-bold tracking-wider">Cashback</span>
                    <span className="text-sm font-black text-emerald-600">{badge.cashbackPercent}%</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <span className="text-[10px] text-stone-400 block uppercase font-mono font-bold tracking-wider mb-2">Privileges & Benefits</span>
                  {badge.benefits?.map((benefit, bIdx) => (
                    <div key={bIdx} className="flex items-center gap-2 text-xs text-stone-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E76A54]" />
                      {benefit}
                    </div>
                  ))}
                  {badge.freeDelivery && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold">
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
                className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-6 space-y-5 h-fit shadow-sm"
              >
                <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                  <h3 className="text-xl font-black text-stone-900 tracking-tight">
                    {isEditingBadge === 'new' ? 'CREATE TIER' : 'EDIT TIER'}
                  </h3>
                  <button onClick={() => setIsEditingBadge(null)} className="text-stone-400 hover:text-stone-700 cursor-pointer">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-1">Tier Title Name</label>
                    <input 
                      type="text" 
                      value={badgeForm.tierName || ''}
                      onChange={e => setBadgeForm(p => ({ ...p, tierName: e.target.value }))}
                      className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 font-medium focus:outline-none focus:border-[#E76A54]"
                      placeholder="e.g., Gold Connoisseur"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-1">Min Orders Required</label>
                      <input 
                        type="number" 
                        value={badgeForm.minOrders || 0}
                        onChange={e => setBadgeForm(p => ({ ...p, minOrders: Number(e.target.value) }))}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-[#E76A54]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-1">Min Spend Required (₹)</label>
                      <input 
                        type="number" 
                        value={badgeForm.minSpend || 0}
                        onChange={e => setBadgeForm(p => ({ ...p, minSpend: Number(e.target.value) }))}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-[#E76A54]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-1">Priority Rank</label>
                      <input 
                        type="number" 
                        value={badgeForm.priority || 1}
                        onChange={e => setBadgeForm(p => ({ ...p, priority: Number(e.target.value) }))}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-[#E76A54]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-1">Cashback %</label>
                      <input 
                        type="number" 
                        value={badgeForm.cashbackPercent || 0}
                        onChange={e => setBadgeForm(p => ({ ...p, cashbackPercent: Number(e.target.value) }))}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-[#E76A54]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-1">Theme Color</label>
                      <input 
                        type="text" 
                        value={badgeForm.themeColor || '#E76A54'}
                        onChange={e => setBadgeForm(p => ({ ...p, themeColor: e.target.value }))}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 font-mono focus:outline-none focus:border-[#E76A54]"
                        placeholder="#E76A54"
                      />
                    </div>
                  </div>

                  <div className="flex gap-6 py-1">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={badgeForm.freeDelivery || false}
                        onChange={e => setBadgeForm(p => ({ ...p, freeDelivery: e.target.checked }))}
                        className="rounded border-stone-300 text-[#E76A54] focus:ring-[#E76A54]"
                      />
                      <span className="text-xs font-medium text-stone-700">Always Free Delivery</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={badgeForm.prioritySupport || false}
                        onChange={e => setBadgeForm(p => ({ ...p, prioritySupport: e.target.checked }))}
                        className="rounded border-stone-300 text-[#E76A54] focus:ring-[#E76A54]"
                      />
                      <span className="text-xs font-medium text-stone-700">24/7 VIP Chat Support</span>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-1">Benefits (Comma-separated)</label>
                    <textarea 
                      value={badgeForm.benefits?.join(', ') || ''}
                      onChange={e => setBadgeForm(p => ({ ...p, benefits: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                      className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 h-20 focus:outline-none focus:border-[#E76A54]"
                      placeholder="e.g., Double reward points, Private invite, Instant service"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setIsEditingBadge(null)} className="flex-1 border-stone-200 text-stone-700">Cancel</Button>
                  <Button onClick={handleSaveBadge} className="flex-1 bg-[#E76A54] hover:bg-[#d55b45] text-white font-bold shadow-md shadow-[#E76A54]/25">
                    <Save size={16} className="mr-2" /> Save Tier
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            {gifts.map((gift) => (
              <div 
                key={gift.id}
                className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row gap-5 relative shadow-xs"
              >
                <img 
                  src={gift.image} 
                  alt={gift.title} 
                  className="w-24 h-24 object-cover rounded-2xl border border-stone-200 shrink-0"
                  referrerPolicy="no-referrer"
                />
                
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">{gift.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#E76A54]/10 border border-[#E76A54]/20 text-[#E76A54] font-bold">
                          {gift.requiredTier}
                        </span>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-md font-bold uppercase",
                          gift.active ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-rose-50 border border-rose-200 text-rose-700"
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
                        className="p-2 text-stone-500 hover:text-stone-900 bg-[#FAF8F5] hover:bg-stone-100 border border-stone-200 rounded-xl cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => setDeletingGiftId(gift.id)}
                        className="p-2 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-stone-500 leading-relaxed font-medium">{gift.description}</p>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-stone-100">
                    <div>
                      <span className="text-[10px] text-stone-400 block uppercase font-mono font-bold">Available Stock</span>
                      <span className="text-sm font-black text-stone-900">{gift.stock} remaining</span>
                    </div>
                    {gift.costPoints && (
                      <div>
                        <span className="text-[10px] text-stone-400 block uppercase font-mono font-bold">Cost Points</span>
                        <span className="text-sm font-black text-[#E76A54]">{gift.costPoints} PTS</span>
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
                className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-6 space-y-5 h-fit shadow-sm"
              >
                <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                  <h3 className="text-xl font-black text-stone-900 tracking-tight">
                    {isEditingGift === 'new' ? 'CREATE GIFT' : 'EDIT GIFT'}
                  </h3>
                  <button onClick={() => setIsEditingGift(null)} className="text-stone-400 hover:text-stone-700 cursor-pointer">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-1">Gift Title</label>
                    <input 
                      type="text" 
                      value={giftForm.title || ''}
                      onChange={e => setGiftForm(p => ({ ...p, title: e.target.value }))}
                      className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-[#E76A54]"
                      placeholder="e.g., Steel Thermal Bottle"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-1">Gift Image URL</label>
                    <input 
                      type="text" 
                      value={giftForm.image || ''}
                      onChange={e => setGiftForm(p => ({ ...p, image: e.target.value }))}
                      className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-[#E76A54]"
                      placeholder="https://images.unsplash.com..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-1">Required Member Tier</label>
                      <select 
                        value={giftForm.requiredTier || 'Silver Gourmet'}
                        onChange={e => setGiftForm(p => ({ ...p, requiredTier: e.target.value }))}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-[#E76A54]"
                      >
                        <option value="Foodie Starter">Foodie Starter</option>
                        <option value="Bronze Eater">Bronze Eater</option>
                        <option value="Silver Gourmet">Silver Gourmet</option>
                        <option value="Gold Connoisseur">Gold Connoisseur</option>
                        <option value="Platinum Legend">Platinum Legend</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-1">Reward Points Cost</label>
                      <input 
                        type="number" 
                        value={giftForm.costPoints || 100}
                        onChange={e => setGiftForm(p => ({ ...p, costPoints: Number(e.target.value) }))}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-[#E76A54]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-1">Available Stock Units</label>
                      <input 
                        type="number" 
                        value={giftForm.stock || 10}
                        onChange={e => setGiftForm(p => ({ ...p, stock: Number(e.target.value) }))}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-[#E76A54]"
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={giftForm.active ?? true}
                          onChange={e => setGiftForm(p => ({ ...p, active: e.target.checked }))}
                          className="rounded border-stone-300 text-[#E76A54] focus:ring-[#E76A54]"
                        />
                        <span className="text-xs font-medium text-stone-700">Gift Active in Store</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-1">Description</label>
                    <textarea 
                      value={giftForm.description || ''}
                      onChange={e => setGiftForm(p => ({ ...p, description: e.target.value }))}
                      className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 h-20 focus:outline-none focus:border-[#E76A54]"
                      placeholder="Give a charming brief description of this product..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setIsEditingGift(null)} className="flex-1 border-stone-200 text-stone-700">Cancel</Button>
                  <Button onClick={handleSaveGift} className="flex-1 bg-[#E76A54] hover:bg-[#d55b45] text-white font-bold shadow-md shadow-[#E76A54]/25">
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
