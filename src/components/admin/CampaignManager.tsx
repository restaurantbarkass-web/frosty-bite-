import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  ToggleLeft, 
  ToggleRight, 
  ExternalLink, 
  Save, 
  Loader2, 
  Calendar, 
  Ticket, 
  Sparkles, 
  Flame, 
  Search, 
  Tag, 
  ShoppingBag, 
  Check, 
  X, 
  Clock, 
  AlertCircle,
  Eye,
  Layers,
  ChevronRight,
  Filter,
  Upload,
  RotateCcw,
  IndianRupee,
  PlusCircle,
  Percent,
  Image as ImageIcon
} from 'lucide-react';
import { PromotionalCampaign, FoodItem, CampaignProductConfig } from '../../types';
import { CampaignService } from '../../services/CampaignService';
import { supabase } from '../../supabase';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { ImageUpload } from './ImageUpload';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { OptimizedImage } from '../ui/OptimizedImage';
import { uploadImage } from '../../utils/upload';
import { CATEGORIES } from '../../constants';

const BAKERY_IMAGE_PRESETS = [
  { label: 'Donut Mania', url: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Artisan Cakes', url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Fresh Pastries', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Chocolate Delights', url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Summer Coolers', url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1200&q=80' },
];

export const CampaignManager: React.FC = () => {
  const [campaigns, setCampaigns] = useState<PromotionalCampaign[]>([]);
  const [products, setProducts] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<PromotionalCampaign | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'scheduled' | 'expired' | 'inactive'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Form State
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    banner_image: string;
    is_active: boolean;
    is_flash_deal: boolean;
    start_at: string;
    end_at: string;
    priority: number;
    product_ids: string[];
    campaign_products: CampaignProductConfig[];
    hasCoupon: boolean;
    coupon_code: string;
    coupon_type: 'percentage' | 'fixed' | 'free_item';
    coupon_value: number;
    coupon_min_order: number;
    coupon_auto_apply: boolean;
  }>({
    title: '',
    description: '',
    banner_image: '',
    is_active: true,
    is_flash_deal: false,
    start_at: new Date().toISOString().slice(0, 16),
    end_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    priority: 5,
    product_ids: [],
    campaign_products: [],
    hasCoupon: true,
    coupon_code: '',
    coupon_type: 'percentage',
    coupon_value: 20,
    coupon_min_order: 0,
    coupon_auto_apply: true
  });

  // Product selector filter & customization within modal
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [productSearch, setProductSearch] = useState<string>('');
  const [treatsSubTab, setTreatsSubTab] = useState<'customize' | 'browse'>('customize');
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);

  // Sub-modal for creating a brand new treat directly from campaign manager
  const [isAddingNewTreat, setIsAddingNewTreat] = useState(false);
  const [newTreatData, setNewTreatData] = useState({
    name: '',
    category: 'Cakes',
    price: 299,
    campaign_price: 249,
    image: '',
    description: ''
  });
  const [newTreatUploading, setNewTreatUploading] = useState(false);

  // Load campaigns and products
  useEffect(() => {
    fetchData();

    // Subscribe to real-time changes
    const unsubscribe = CampaignService.subscribeToCampaigns(() => {
      fetchData();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [campaignList, productList] = await Promise.all([
        CampaignService.getAllCampaigns(),
        fetchProducts()
      ]);
      setCampaigns(campaignList);
      setProducts(productList);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (): Promise<FoodItem[]> => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (_) {}

    try {
      const { data } = await supabase
        .from('menu_items')
        .select('*')
        .order('name');
      if (data && data.length > 0) return data;
    } catch (_) {}

    // Fallback to cache if database empty
    try {
      const cached = localStorage.getItem('menu_items_cache');
      if (cached) return JSON.parse(cached);
    } catch (_) {}

    return [];
  };

  // Open modal for Create or Edit
  const handleOpenModal = (campaign?: PromotionalCampaign) => {
    if (campaign) {
      setEditingCampaign(campaign);
      const cProds = campaign.campaign_products && campaign.campaign_products.length > 0
        ? campaign.campaign_products
        : (campaign.product_ids || []).map(id => ({ product_id: id }));

      setFormData({
        title: campaign.title,
        description: campaign.description || '',
        banner_image: campaign.banner_image,
        is_active: campaign.is_active,
        is_flash_deal: !!campaign.is_flash_deal,
        start_at: campaign.start_at ? new Date(campaign.start_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
        end_at: campaign.end_at ? new Date(campaign.end_at).toISOString().slice(0, 16) : '',
        priority: campaign.priority ?? 5,
        product_ids: campaign.product_ids || [],
        campaign_products: cProds,
        hasCoupon: !!campaign.coupon,
        coupon_code: campaign.coupon?.code || '',
        coupon_type: campaign.coupon?.type || 'percentage',
        coupon_value: campaign.coupon?.value ?? 20,
        coupon_min_order: campaign.coupon?.min_order ?? 0,
        coupon_auto_apply: campaign.coupon?.auto_apply ?? true
      });
      setTreatsSubTab(campaign.product_ids && campaign.product_ids.length > 0 ? 'customize' : 'browse');
    } else {
      setEditingCampaign(null);
      setFormData({
        title: '',
        description: '',
        banner_image: BAKERY_IMAGE_PRESETS[0].url,
        is_active: true,
        is_flash_deal: false,
        start_at: new Date().toISOString().slice(0, 16),
        end_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        priority: 5,
        product_ids: [],
        campaign_products: [],
        hasCoupon: true,
        coupon_code: '',
        coupon_type: 'percentage',
        coupon_value: 20,
        coupon_min_order: 0,
        coupon_auto_apply: true
      });
      setTreatsSubTab('browse');
    }
    setProductCategoryFilter('all');
    setProductSearch('');
    setIsAddingNewTreat(false);
    setIsModalOpen(true);
  };

  // Helper to toggle product in campaign
  const toggleProductSelection = (productId: string) => {
    const isSelected = formData.product_ids.includes(productId);
    setFormData(prev => {
      if (isSelected) {
        return {
          ...prev,
          product_ids: prev.product_ids.filter(id => id !== productId),
          campaign_products: (prev.campaign_products || []).filter(cp => cp.product_id !== productId)
        };
      } else {
        return {
          ...prev,
          product_ids: [...prev.product_ids, productId],
          campaign_products: [
            ...(prev.campaign_products || []).filter(cp => cp.product_id !== productId),
            { product_id: productId }
          ]
        };
      }
    });
  };

  // Helper to update campaign price for a product
  const handleUpdateProductPrice = (productId: string, priceValue: string) => {
    const num = priceValue.trim() === '' ? null : Number(priceValue);
    setFormData(prev => {
      const existing = prev.campaign_products || [];
      const matchIndex = existing.findIndex(cp => cp.product_id === productId);
      const updated = [...existing];
      if (matchIndex >= 0) {
        updated[matchIndex] = { ...updated[matchIndex], campaign_price: num };
      } else {
        updated.push({ product_id: productId, campaign_price: num });
      }
      return { ...prev, campaign_products: updated };
    });
  };

  // Quick discount calculation for product
  const applyQuickDiscount = (productId: string, catalogPrice: number, percent: number) => {
    const discounted = Math.max(0, Math.round(catalogPrice - (catalogPrice * percent) / 100));
    handleUpdateProductPrice(productId, String(discounted));
    toast.success(`Set ${percent}% off (₹${discounted})`);
  };

  // Upload custom image for specific product in this campaign
  const handleProductImageUpload = async (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingProductId(productId);
      const toastId = toast.loading('Uploading campaign product image...');
      try {
        const url = await uploadImage(file);
        setFormData(prev => {
          const existing = prev.campaign_products || [];
          const matchIndex = existing.findIndex(cp => cp.product_id === productId);
          const updated = [...existing];
          if (matchIndex >= 0) {
            updated[matchIndex] = { ...updated[matchIndex], custom_image: url };
          } else {
            updated.push({ product_id: productId, custom_image: url });
          }
          return { ...prev, campaign_products: updated };
        });
        toast.success('Campaign product image updated!', { id: toastId });
      } catch (err: any) {
        toast.error(err.message || 'Failed to upload image', { id: toastId });
      } finally {
        setUploadingProductId(null);
      }
    }
  };

  // Reset product customization back to catalog defaults
  const resetProductCustomization = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      campaign_products: (prev.campaign_products || []).map(cp =>
        cp.product_id === productId ? { ...cp, custom_image: null, campaign_price: null } : cp
      )
    }));
    toast.success('Reset to catalog defaults');
  };

  // Upload image for brand new treat creation
  const handleNewTreatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewTreatUploading(true);
      const toastId = toast.loading('Uploading treat image...');
      try {
        const url = await uploadImage(file);
        setNewTreatData(prev => ({ ...prev, image: url }));
        toast.success('Image uploaded successfully!', { id: toastId });
      } catch (err: any) {
        toast.error(err.message || 'Failed to upload image', { id: toastId });
      } finally {
        setNewTreatUploading(false);
      }
    }
  };

  // Create new treat in database catalog and immediately add to campaign
  const handleCreateAndAddTreat = async () => {
    if (!newTreatData.name.trim()) {
      toast.error('Treat name is required');
      return;
    }
    const toastId = toast.loading('Creating treat...');
    try {
      const newProduct: any = {
        name: newTreatData.name.trim(),
        category: newTreatData.category,
        price: Number(newTreatData.price) || 199,
        image: newTreatData.image || BAKERY_IMAGE_PRESETS[1].url,
        description: newTreatData.description || 'Special campaign treat',
        available: true,
        stock_quantity: 50
      };

      // Try inserting into products table
      let createdItem: FoodItem | null = null;
      try {
        const { data, error } = await supabase.from('products').insert([newProduct]).select().single();
        if (!error && data) {
          createdItem = data;
        }
      } catch (_) {}

      // Fallback to menu_items or client-side ID
      if (!createdItem) {
        try {
          const { data, error } = await supabase.from('menu_items').insert([newProduct]).select().single();
          if (!error && data) {
            createdItem = data;
          }
        } catch (_) {}
      }

      if (!createdItem) {
        createdItem = {
          id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ...newProduct
        };
      }

      // Add to products list
      setProducts(prev => [createdItem!, ...prev]);

      // Add to form product_ids and campaign_products
      setFormData(prev => ({
        ...prev,
        product_ids: Array.from(new Set([...prev.product_ids, createdItem!.id])),
        campaign_products: [
          ...(prev.campaign_products || []).filter(cp => cp.product_id !== createdItem!.id),
          {
            product_id: createdItem!.id,
            campaign_price: newTreatData.campaign_price ? Number(newTreatData.campaign_price) : Number(newTreatData.price),
            custom_image: newTreatData.image || createdItem!.image,
            custom_name: createdItem!.name
          }
        ]
      }));

      toast.success('Treat created and added to campaign!', { id: toastId });
      setIsAddingNewTreat(false);
      setNewTreatData({ name: '', category: 'Cakes', price: 299, campaign_price: 249, image: '', description: '' });
      setTreatsSubTab('customize');
    } catch (err: any) {
      console.error('Failed to create treat:', err);
      toast.error(err.message || 'Failed to create treat', { id: toastId });
    }
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Please enter a campaign title');
      return;
    }
    if (!formData.banner_image.trim()) {
      toast.error('Please provide a banner image');
      return;
    }
    if (formData.product_ids.length === 0) {
      toast.error('Please select at least 1 product for this campaign');
      return;
    }
    if (formData.hasCoupon && !formData.coupon_code.trim()) {
      toast.error('Please specify a coupon code or disable the campaign coupon');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<PromotionalCampaign> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        banner_image: formData.banner_image.trim(),
        is_active: formData.is_active,
        is_flash_deal: formData.is_flash_deal,
        start_at: new Date(formData.start_at).toISOString(),
        end_at: formData.end_at ? new Date(formData.end_at).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        priority: Number(formData.priority) || 5,
        product_ids: formData.product_ids,
        campaign_products: formData.campaign_products,
        coupon: formData.hasCoupon ? {
          code: formData.coupon_code.trim().toUpperCase(),
          type: formData.coupon_type,
          value: Number(formData.coupon_value) || 0,
          min_order: Number(formData.coupon_min_order) || 0,
          auto_apply: formData.coupon_auto_apply
        } : undefined
      };

      if (editingCampaign) {
        payload.id = editingCampaign.id;
      }

      await CampaignService.saveCampaign(payload as PromotionalCampaign);
      toast.success(editingCampaign ? 'Campaign updated successfully!' : 'Campaign created successfully!');
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Failed to save campaign:', err);
      toast.error(err?.message || 'Failed to save campaign');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle active status
  const toggleActiveStatus = async (campaign: PromotionalCampaign) => {
    try {
      await CampaignService.toggleCampaignStatus(campaign.id, !campaign.is_active);
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, is_active: !c.is_active } : c));
      toast.success(`Campaign ${!campaign.is_active ? 'Activated' : 'Paused'}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // Delete Campaign
  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await CampaignService.deleteCampaign(deletingId);
      setCampaigns(prev => prev.filter(c => c.id !== deletingId));
      setDeletingId(null);
      toast.success('Campaign removed (Bakery products remain untouched)');
    } catch (err) {
      toast.error('Failed to delete campaign');
    }
  };

  // Helper for status classification
  const getCampaignStatus = (campaign: PromotionalCampaign) => {
    const now = new Date();
    const start = campaign.start_at ? new Date(campaign.start_at) : null;
    const end = campaign.end_at ? new Date(campaign.end_at) : null;

    if (!campaign.is_active) return 'inactive';
    if (end && end < now) return 'expired';
    if (start && start > now) return 'scheduled';
    return 'active';
  };

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const status = getCampaignStatus(c);
      const matchesTab = activeTab === 'all' || status === activeTab;
      const matchesSearch = !searchFilter.trim() || 
        c.title.toLowerCase().includes(searchFilter.toLowerCase()) || 
        (c.coupon?.code && c.coupon.code.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (c.description && c.description.toLowerCase().includes(searchFilter.toLowerCase()));
      return matchesTab && matchesSearch;
    });
  }, [campaigns, activeTab, searchFilter]);

  // Product categories for modal selector
  const productCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products within modal
  const modalFilteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = productCategoryFilter === 'all' || p.category === productCategoryFilter;
      const matchesSearch = !productSearch.trim() || 
        p.name.toLowerCase().includes(productSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, productCategoryFilter, productSearch]);

  // Selected products with their custom campaign config (price and custom image)
  const selectedCampaignProducts = useMemo(() => {
    return formData.product_ids.map(id => {
      const prod = products.find(p => p.id === id);
      const config = (formData.campaign_products || []).find(cp => cp.product_id === id);
      return { prod, config, id };
    }).filter(item => item.prod !== undefined) as Array<{
      prod: FoodItem;
      config?: CampaignProductConfig;
      id: string;
    }>;
  }, [formData.product_ids, formData.campaign_products, products]);

  // Quick preset dates helpers
  const applyDatePreset = (days: number) => {
    const start = new Date();
    const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    setFormData(prev => ({
      ...prev,
      start_at: start.toISOString().slice(0, 16),
      end_at: end.toISOString().slice(0, 16)
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
              Promotional Campaigns
            </h1>
            <span className="bg-[#E76A54]/10 text-[#E76A54] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#E76A54]/20">
              {campaigns.length} Total
            </span>
          </div>
          <p className="text-xs text-stone-500 font-medium mt-1">
            Create banners linked to dedicated campaign pages with strictly locked product-specific coupons.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="px-5 py-2.5 bg-[#E76A54] hover:bg-[#d65943] text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap self-start sm:self-auto"
        >
          <Plus size={16} /> New Campaign
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex overflow-x-auto gap-1.5 p-1 bg-white border border-stone-200 rounded-2xl">
          {[
            { id: 'all', label: 'All Campaigns' },
            { id: 'active', label: 'Active' },
            { id: 'scheduled', label: 'Scheduled' },
            { id: 'expired', label: 'Expired' },
            { id: 'inactive', label: 'Paused' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-stone-900 text-white shadow-xs' 
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search campaigns or coupon..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold placeholder:text-stone-400 focus:outline-none focus:border-[#E76A54]"
          />
        </div>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-[#E76A54] mx-auto" />
          <p className="text-xs font-bold text-stone-500">Loading campaign systems...</p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <Sparkles size={28} />
          </div>
          <h3 className="text-base font-bold text-stone-900">No campaigns found</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            {searchFilter ? 'Try clearing your search query' : 'Create your first promotional campaign with an exclusive banner, target treats, and locked coupons.'}
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="px-5 py-2.5 bg-[#E76A54] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#d65943] transition-all cursor-pointer"
          >
            Create First Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCampaigns.map((campaign) => {
            const status = getCampaignStatus(campaign);
            const assignedCount = campaign.product_ids?.length || 0;

            return (
              <div 
                key={campaign.id}
                className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                {/* Banner Thumbnail */}
                <div className="relative aspect-[21/9] w-full bg-stone-100 overflow-hidden">
                  <OptimizedImage
                    src={campaign.banner_image}
                    alt={campaign.title}
                    containerClassName="w-full h-full"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent" />

                  {/* Status Badges */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    {status === 'active' && (
                      <span className="px-2.5 py-0.5 bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Active
                      </span>
                    )}
                    {status === 'scheduled' && (
                      <span className="px-2.5 py-0.5 bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 shadow-xs">
                        <Clock size={10} /> Scheduled
                      </span>
                    )}
                    {status === 'expired' && (
                      <span className="px-2.5 py-0.5 bg-stone-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-xs">
                        Expired
                      </span>
                    )}
                    {status === 'inactive' && (
                      <span className="px-2.5 py-0.5 bg-amber-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-xs">
                        Paused
                      </span>
                    )}
                    {campaign.is_flash_deal && (
                      <span className="px-2.5 py-0.5 bg-amber-400 text-stone-950 font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 shadow-xs">
                        <Flame size={10} className="fill-stone-950" /> Flash Deal
                      </span>
                    )}
                  </div>

                  {/* Priority Tag */}
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold">
                    P{campaign.priority ?? 5}
                  </div>

                  {/* Title over banner */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h3 className="font-black text-lg tracking-tight truncate drop-shadow-sm">
                      {campaign.title}
                    </h3>
                  </div>
                </div>

                {/* Card Details */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    {campaign.description && (
                      <p className="text-xs text-stone-600 font-medium line-clamp-2 leading-relaxed">
                        {campaign.description}
                      </p>
                    )}

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {/* Products count */}
                      <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-2.5 flex items-center gap-2">
                        <ShoppingBag size={15} className="text-[#E76A54]" />
                        <div>
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Assigned Treats</p>
                          <p className="text-xs font-black text-stone-800">{assignedCount} Products</p>
                        </div>
                      </div>

                      {/* Coupon */}
                      <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-2.5 flex items-center gap-2">
                        <Tag size={15} className="text-[#E76A54]" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Campaign Coupon</p>
                          <p className="text-xs font-mono font-black text-stone-800 truncate">
                            {campaign.coupon ? campaign.coupon.code : 'None'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="text-[11px] text-stone-500 font-medium flex items-center gap-1.5 pt-1">
                      <Calendar size={13} className="text-stone-400" />
                      <span>
                        {new Date(campaign.start_at).toLocaleDateString()} — {new Date(campaign.end_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {/* View Customer Page */}
                      <a
                        href={`/campaign/${campaign.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                        title="Open customer campaign page"
                      >
                        <ExternalLink size={12} /> View Page
                      </a>

                      {/* Toggle status */}
                      <button
                        onClick={() => toggleActiveStatus(campaign)}
                        className={`px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1 cursor-pointer ${
                          campaign.is_active 
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' 
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {campaign.is_active ? 'Pause' : 'Activate'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenModal(campaign)}
                        className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                        title="Edit campaign"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => setDeletingId(campaign.id)}
                        className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="Delete campaign"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comprehensive Create / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-left my-6"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
                <div>
                  <h2 className="text-lg font-black text-stone-900 tracking-tight">
                    {editingCampaign ? 'Edit Campaign' : 'Create Promotional Campaign'}
                  </h2>
                  <p className="text-xs text-stone-500 font-medium">
                    Configure banner, scheduled timeline, product catalogue filter, and locked coupon.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSave} className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
                {/* 1. Basic Details */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[#E76A54]" /> 1. Campaign Identity
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1.5">
                        Campaign Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g. Weekend Donut Mania"
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-stone-900 text-xs font-bold focus:border-[#E76A54] outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1.5">
                        Priority Order (1-10)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={formData.priority}
                        onChange={e => setFormData({ ...formData, priority: Number(e.target.value) })}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-stone-900 text-xs font-bold focus:border-[#E76A54] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1.5">
                      Description / Subtitle
                    </label>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="e.g. Enjoy 30% OFF our hand-glazed premium donuts this Saturday and Sunday!"
                      className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2 text-stone-900 text-xs font-medium focus:border-[#E76A54] outline-none resize-none"
                    />
                  </div>

                  <div className="flex flex-wrap gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 rounded text-[#E76A54] accent-[#E76A54]"
                      />
                      <span>Active Immediately</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-amber-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.is_flash_deal}
                        onChange={e => setFormData({ ...formData, is_flash_deal: e.target.checked })}
                        className="w-4 h-4 rounded text-amber-500 accent-amber-500"
                      />
                      <span className="flex items-center gap-1">
                        <Flame size={13} className="fill-amber-500 text-amber-500" /> Flash Deal Ribbon
                      </span>
                    </label>
                  </div>
                </div>

                {/* 2. Banner Media */}
                <div className="space-y-3 pt-4 border-t border-stone-100">
                  <h4 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[#E76A54]" /> 2. Banner Visual
                  </h4>

                  <ImageUpload
                    onUploadComplete={(url) => setFormData({ ...formData, banner_image: url })}
                    currentImage={formData.banner_image}
                    label="Upload Banner (16:9 or 21:9 Recommended)"
                  />

                  {/* Preset Quick Select */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      Or pick a curated bakery preset:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {BAKERY_IMAGE_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setFormData({ ...formData, banner_image: preset.url })}
                          className={`px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                            formData.banner_image === preset.url
                              ? 'bg-[#E76A54] text-white border-[#E76A54]'
                              : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Schedule */}
                <div className="space-y-3 pt-4 border-t border-stone-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock size={14} className="text-[#E76A54]" /> 3. Campaign Timeline
                    </h4>
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-stone-400 font-bold uppercase">Quick Set:</span>
                      <button 
                        type="button" 
                        onClick={() => applyDatePreset(3)}
                        className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 rounded font-semibold text-stone-700 cursor-pointer"
                      >
                        3 Days
                      </button>
                      <button 
                        type="button" 
                        onClick={() => applyDatePreset(7)}
                        className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 rounded font-semibold text-stone-700 cursor-pointer"
                      >
                        1 Week
                      </button>
                      <button 
                        type="button" 
                        onClick={() => applyDatePreset(30)}
                        className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 rounded font-semibold text-stone-700 cursor-pointer"
                      >
                        1 Month
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1.5">
                        Start Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={formData.start_at}
                        onChange={e => setFormData({ ...formData, start_at: e.target.value })}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-stone-900 text-xs font-bold focus:border-[#E76A54] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1.5">
                        End Date & Time (Countdown target)
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={formData.end_at}
                        onChange={e => setFormData({ ...formData, end_at: e.target.value })}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-2.5 text-stone-900 text-xs font-bold focus:border-[#E76A54] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Product Catalog & Custom Price/Image Section */}
                <div className="space-y-3 pt-4 border-t border-stone-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                        <ShoppingBag size={14} className="text-[#E76A54]" /> 4. Campaign Treats, Custom Prices & Image Overrides
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Assign items, specify promotional campaign prices, and upload custom campaign-specific photos.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingNewTreat(prev => !prev)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isAddingNewTreat 
                            ? 'bg-[#E76A54] text-white shadow-xs' 
                            : 'bg-[#FAF8F5] hover:bg-[#F2ECE4] text-[#E76A54] border border-[#E76A54]/20'
                        }`}
                      >
                        <PlusCircle size={13} />
                        <span>{isAddingNewTreat ? 'Close Treat Form' : '+ Add New Treat to Campaign'}</span>
                      </button>

                      <div className="flex items-center bg-[#FAF8F5] border border-stone-200 rounded-xl p-0.5">
                        <button
                          type="button"
                          onClick={() => setTreatsSubTab('customize')}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                            treatsSubTab === 'customize'
                              ? 'bg-white text-stone-900 shadow-2xs'
                              : 'text-stone-500 hover:text-stone-900'
                          }`}
                        >
                          Customize Treats ({formData.product_ids.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTreatsSubTab('browse')}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                            treatsSubTab === 'browse'
                              ? 'bg-white text-stone-900 shadow-2xs'
                              : 'text-stone-500 hover:text-stone-900'
                          }`}
                        >
                          Browse Catalog
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inline Creation Drawer for Brand-New Treat */}
                  <AnimatePresence>
                    {isAddingNewTreat && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-[#FAF8F5] border-2 border-dashed border-[#E76A54]/30 rounded-2xl p-4 space-y-3 overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-[#E76A54]" />
                            <h5 className="text-xs font-black text-stone-900 uppercase">
                              Add New Bakery Treat Directly to Catalog & Campaign
                            </h5>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsAddingNewTreat(false)}
                            className="text-stone-400 hover:text-stone-700 p-1"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1">
                              Treat Name *
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Red Velvet Valentine Delight"
                              value={newTreatData.name}
                              onChange={(e) => setNewTreatData(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-900 outline-none focus:border-[#E76A54]"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1">
                              Category
                            </label>
                            <select
                              value={newTreatData.category}
                              onChange={(e) => setNewTreatData(prev => ({ ...prev, category: e.target.value }))}
                              className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-900 outline-none focus:border-[#E76A54]"
                            >
                              {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1">
                                Catalog Price (₹) *
                              </label>
                              <input
                                type="number"
                                min="1"
                                placeholder="299"
                                value={newTreatData.price}
                                onChange={(e) => setNewTreatData(prev => ({ ...prev, price: Number(e.target.value) }))}
                                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-900 outline-none focus:border-[#E76A54]"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1">
                                Campaign Price (₹)
                              </label>
                              <input
                                type="number"
                                min="0"
                                placeholder="249"
                                value={newTreatData.campaign_price}
                                onChange={(e) => setNewTreatData(prev => ({ ...prev, campaign_price: Number(e.target.value) }))}
                                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-black text-[#E76A54] outline-none focus:border-[#E76A54]"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Image Upload for New Treat */}
                        <div>
                          <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1">
                            Treat Image (Upload or Preset URL)
                          </label>
                          <div className="flex flex-col sm:flex-row items-center gap-3">
                            <label className="flex-1 w-full flex items-center justify-center gap-2 border-2 border-dashed border-stone-300 hover:border-[#E76A54] bg-white rounded-xl p-2.5 cursor-pointer transition-all">
                              <Upload size={14} className={newTreatUploading ? 'animate-bounce text-[#E76A54]' : 'text-stone-500'} />
                              <span className="text-xs font-bold text-stone-700">
                                {newTreatUploading ? 'Uploading Image to Cloudinary...' : 'Click or Drag to Upload Image'}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={newTreatUploading}
                                onChange={handleNewTreatImageUpload}
                              />
                            </label>
                            <input
                              type="url"
                              placeholder="Or paste image URL..."
                              value={newTreatData.image}
                              onChange={(e) => setNewTreatData(prev => ({ ...prev, image: e.target.value }))}
                              className="flex-1 w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 outline-none focus:border-[#E76A54]"
                            />
                            {newTreatData.image && (
                              <div className="w-10 h-10 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200 shadow-2xs">
                                <img src={newTreatData.image} alt="Preview" className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsAddingNewTreat(false)}
                            className="px-3 py-1.5 text-xs font-bold text-stone-600 hover:text-stone-900"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateAndAddTreat}
                            disabled={newTreatUploading}
                            className="px-4 py-1.5 bg-[#E76A54] hover:bg-[#D45943] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                          >
                            <Plus size={13} />
                            <span>Create & Assign to Campaign</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* TAB 1: CUSTOM PRICING & IMAGES VIEW */}
                  {treatsSubTab === 'customize' && (
                    <div className="space-y-2">
                      {selectedCampaignProducts.length === 0 ? (
                        <div className="border border-stone-200 rounded-2xl p-6 text-center bg-stone-50/50 space-y-3">
                          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                            <ShoppingBag size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-stone-800">No bakery treats selected for this campaign yet</p>
                            <p className="text-[11px] text-stone-500 max-w-sm mx-auto mt-0.5">
                              Switch to the "Browse Catalog" tab to assign treats, or click "+ Add New Treat to Campaign" above.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setTreatsSubTab('browse')}
                            className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold shadow-2xs"
                          >
                            Browse Catalog
                          </button>
                        </div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                          {selectedCampaignProducts.map(({ prod, config }) => {
                            const currentImg = config?.custom_image || prod.image;
                            const currentPrice = config?.campaign_price != null ? config.campaign_price : '';
                            const isUploadingThis = uploadingProductId === prod.id;
                            const hasCustomPrice = config?.campaign_price != null;
                            const hasCustomImage = !!config?.custom_image;

                            return (
                              <div
                                key={prod.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-stone-200 hover:border-stone-300 rounded-2xl shadow-2xs transition-all"
                              >
                                {/* Left: Image & Name */}
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                                    <OptimizedImage
                                      src={currentImg}
                                      alt={prod.name}
                                      className="w-full h-full object-cover"
                                    />
                                    {hasCustomImage && (
                                      <div className="absolute top-0 right-0 bg-[#E76A54] text-white p-0.5 rounded-bl-md">
                                        <Sparkles size={9} />
                                      </div>
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs font-bold text-stone-900 truncate">{prod.name}</p>
                                      {hasCustomImage && (
                                        <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                          Custom Photo
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-stone-400 font-semibold">
                                      Catalog: <span className="text-stone-700">₹{prod.price}</span> {prod.category ? `• ${prod.category}` : ''}
                                    </p>

                                    {/* Upload Custom Image for this item */}
                                    <div className="flex items-center gap-2 mt-1">
                                      <label className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md text-[10px] font-bold cursor-pointer transition-all">
                                        <Upload size={10} className={isUploadingThis ? 'animate-bounce text-[#E76A54]' : ''} />
                                        <span>{isUploadingThis ? 'Uploading...' : (hasCustomImage ? 'Change Image' : 'Upload Image')}</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          disabled={isUploadingThis}
                                          onChange={(e) => handleProductImageUpload(prod.id, e)}
                                        />
                                      </label>
                                      {hasCustomImage && (
                                        <button
                                          type="button"
                                          onClick={() => resetProductCustomization(prod.id)}
                                          className="text-[10px] text-stone-400 hover:text-red-500 underline cursor-pointer"
                                        >
                                          Reset Defaults
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Right: Price Configuration & Remove */}
                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">
                                        Campaign Price:
                                      </span>
                                      <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-[11px]">₹</span>
                                        <input
                                          type="number"
                                          min="0"
                                          placeholder={`₹${prod.price}`}
                                          value={currentPrice}
                                          onChange={(e) => handleUpdateProductPrice(prod.id, e.target.value)}
                                          className="w-24 pl-5 pr-2 py-1 bg-[#FAF8F5] border border-stone-200 rounded-lg text-xs font-black text-[#E76A54] outline-none focus:border-[#E76A54]"
                                        />
                                      </div>
                                    </div>

                                    {/* Quick discount chips */}
                                    <div className="flex items-center gap-1 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => applyQuickDiscount(prod.id, prod.price, 10)}
                                        className="px-1.5 py-0.5 bg-stone-100 hover:bg-[#E76A54]/10 hover:text-[#E76A54] text-stone-600 rounded text-[9px] font-bold"
                                      >
                                        10% Off
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => applyQuickDiscount(prod.id, prod.price, 20)}
                                        className="px-1.5 py-0.5 bg-stone-100 hover:bg-[#E76A54]/10 hover:text-[#E76A54] text-stone-600 rounded text-[9px] font-bold"
                                      >
                                        20% Off
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => applyQuickDiscount(prod.id, prod.price, 30)}
                                        className="px-1.5 py-0.5 bg-stone-100 hover:bg-[#E76A54]/10 hover:text-[#E76A54] text-stone-600 rounded text-[9px] font-bold"
                                      >
                                        30% Off
                                      </button>
                                      {hasCustomPrice && (
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateProductPrice(prod.id, '')}
                                          title="Reset to regular price"
                                          className="text-stone-400 hover:text-stone-600 p-0.5"
                                        >
                                          <RotateCcw size={10} />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => toggleProductSelection(prod.id)}
                                    title="Remove from this campaign"
                                    className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: BROWSE CATALOG GRID VIEW */}
                  {treatsSubTab === 'browse' && (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                          <input
                            type="text"
                            placeholder="Filter catalog treats..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#E76A54]"
                          />
                        </div>
                        {productCategories.length > 0 && (
                          <select
                            value={productCategoryFilter}
                            onChange={(e) => setProductCategoryFilter(e.target.value)}
                            className="bg-[#FAF8F5] border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-700 focus:outline-none"
                          >
                            <option value="all">All Categories</option>
                            {productCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        )}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const allIds = modalFilteredProducts.map(p => p.id);
                              setFormData(prev => ({
                                ...prev,
                                product_ids: Array.from(new Set([...prev.product_ids, ...allIds])),
                                campaign_products: [
                                  ...(prev.campaign_products || []),
                                  ...allIds
                                    .filter(id => !(prev.campaign_products || []).some(cp => cp.product_id === id))
                                    .map(id => ({ product_id: id }))
                                ]
                              }));
                            }}
                            className="text-[10px] font-bold text-stone-600 hover:text-stone-900 uppercase underline cursor-pointer"
                          >
                            Select Visible
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, product_ids: [], campaign_products: [] }))}
                            className="text-[10px] font-bold text-stone-400 hover:text-red-500 uppercase underline cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {/* Products Grid Selector */}
                      <div className="max-h-56 overflow-y-auto border border-stone-200 rounded-2xl p-2 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-50/50">
                        {modalFilteredProducts.map((prod) => {
                          const isSelected = formData.product_ids.includes(prod.id);
                          return (
                            <div
                              key={prod.id}
                              onClick={() => toggleProductSelection(prod.id)}
                              className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer select-none ${
                                isSelected 
                                  ? 'bg-emerald-50/80 border-emerald-300 shadow-2xs' 
                                  : 'bg-white border-stone-200 hover:border-stone-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
                              />
                              <div className="w-9 h-9 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                                <OptimizedImage
                                  src={prod.image}
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-stone-900 truncate">{prod.name}</p>
                                <p className="text-[10px] text-stone-400 font-semibold">
                                  ₹{prod.price} {prod.category ? `• ${prod.category}` : ''}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Campaign Coupon Configuration */}
                <div className="space-y-4 pt-4 border-t border-stone-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag size={14} className="text-[#E76A54]" /> 5. Campaign-Locked Coupon
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Restricts discount exclusively to the {formData.product_ids.length} selected campaign items above.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.hasCoupon}
                        onChange={e => setFormData({ ...formData, hasCoupon: e.target.checked })}
                        className="w-4 h-4 rounded text-[#E76A54] accent-[#E76A54]"
                      />
                      <span>Enable Coupon</span>
                    </label>
                  </div>

                  {formData.hasCoupon && (
                    <div className="bg-[#FAF8F5] border border-stone-200/90 rounded-2xl p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1">
                            Coupon Code *
                          </label>
                          <input
                            type="text"
                            required={formData.hasCoupon}
                            value={formData.coupon_code}
                            onChange={e => setFormData({ ...formData, coupon_code: e.target.value.toUpperCase() })}
                            placeholder="e.g. DONUT30"
                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono font-bold text-xs focus:border-[#E76A54] outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1">
                            Discount Type
                          </label>
                          <select
                            value={formData.coupon_type}
                            onChange={e => setFormData({ ...formData, coupon_type: e.target.value as any })}
                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-bold text-xs focus:border-[#E76A54] outline-none"
                          >
                            <option value="percentage">Percentage (% OFF)</option>
                            <option value="fixed">Fixed Amount (₹ Flat OFF)</option>
                            <option value="free_item">Free Item</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1">
                            {formData.coupon_type === 'percentage' ? 'Percent (e.g. 20%)' : 'Amount (₹)'}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={formData.coupon_value}
                            onChange={e => setFormData({ ...formData, coupon_value: Number(e.target.value) })}
                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-bold text-xs focus:border-[#E76A54] outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1">
                            Min. Campaign Subtotal (₹ Optional)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={formData.coupon_min_order}
                            onChange={e => setFormData({ ...formData, coupon_min_order: Number(e.target.value) })}
                            placeholder="0 for no minimum"
                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-bold text-xs focus:border-[#E76A54] outline-none"
                          />
                        </div>

                        <div className="flex items-center pt-5">
                          <label className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formData.coupon_auto_apply}
                              onChange={e => setFormData({ ...formData, coupon_auto_apply: e.target.checked })}
                              className="w-4 h-4 rounded text-[#E76A54] accent-[#E76A54]"
                            />
                            <span>Auto-apply coupon when users open campaign</span>
                          </label>
                        </div>
                      </div>

                      {/* Strict Enforcement Notice */}
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] leading-relaxed flex items-start gap-2">
                        <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                        <div>
                          <strong>Strict Server-Side Enforcement:</strong> This coupon will calculate discounts strictly on the subtotal of the {formData.product_ids.length} selected campaign treats. Any regular cakes or items in the customer's cart will remain full price.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Actions */}
                <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-[#E76A54] hover:bg-[#d65943] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {editingCampaign ? 'Save Changes' : 'Create Campaign'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Safe Deletion */}
      <ConfirmationModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Promotional Campaign?"
        description="Are you sure you want to delete this campaign? The banner and promo coupon will be removed, but all your bakery menu items will remain intact and unharmed."
        confirmText="Delete Campaign"
        variant="danger"
      />
    </div>
  );
};

export default CampaignManager;
