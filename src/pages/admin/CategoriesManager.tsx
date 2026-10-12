import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Package, 
  Image as ImageIcon, 
  Check, 
  X, 
  RefreshCw, 
  Eye, 
  Upload, 
  Layers,
  ArrowUp,
  ArrowDown,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { categoryService, Category } from '../../services/categoryService';
import { supabase } from '../../supabase';
import { FoodItem } from '../../types';
import { uploadImage } from '../../utils/upload';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';

// Curated high-res bakery photography presets for instant 1-tap category creation
const BAKERY_IMAGE_PRESETS = [
  { name: 'Cakes', url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800' },
  { name: 'Cheesecakes', url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&q=80&w=800' },
  { name: 'Pastries', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800' },
  { name: 'Cupcakes', url: 'https://images.unsplash.com/photo-1587668178277-295251f900ce?auto=format&fit=crop&q=80&w=800' },
  { name: 'Brownies', url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=800' },
  { name: 'Cookies', url: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=800' },
  { name: 'Desserts', url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800' },
  { name: 'Breads', url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&q=80&w=800' },
  { name: 'Macarons', url: 'https://images.unsplash.com/photo-1569864358642-9d1684040f43?auto=format&fit=crop&q=80&w=800' },
  { name: 'Tarts', url: 'https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&q=80&w=800' },
  { name: 'Beverages', url: 'https://images.unsplash.com/photo-1544787210-2211d44b5042?auto=format&fit=crop&q=80&w=800' },
  { name: 'Savory', url: 'https://images.unsplash.com/photo-1585478282226-1d713204d95c?auto=format&fit=crop&q=80&w=800' },
];

export const CategoriesManager: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<FoodItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [managingProductsCategory, setManagingProductsCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formProductIds, setFormProductIds] = useState<string[]>([]);
  const [productSearchInModal, setProductSearchInModal] = useState('');

  // Inline Quick Add Product to this Category
  const [isAddingNewProductInline, setIsAddingNewProductInline] = useState(false);
  const [inlineProductName, setInlineProductName] = useState('');
  const [inlineProductPrice, setInlineProductPrice] = useState('');
  const [inlineProductImage, setInlineProductImage] = useState('');
  const [isSavingInlineProduct, setIsSavingInlineProduct] = useState(false);

  // Fetch categories and products
  const loadData = useCallback(async (force = false) => {
    setIsLoading(true);
    try {
      const [cats, productsRes] = await Promise.all([
        categoryService.getCategories(force),
        supabase.from('products').select('*').order('name')
      ]);

      setCategories(cats);

      if (productsRes.data) {
        setAllProducts(productsRes.data.map((p: any) => ({
          id: String(p.id),
          name: p.name,
          price: Number(p.price),
          image: p.image,
          category: p.category || 'General',
          description: p.description || '',
          rating: p.rating || 5,
          stock_quantity: p.stock_quantity || 0,
        })));
      }
    } catch (err: any) {
      console.error('[CategoriesManager] Error loading data:', err);
      toast.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = categoryService.subscribe((updated) => {
      setCategories(updated);
    });
    return () => unsubscribe();
  }, [loadData]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormName('');
    setFormImage(BAKERY_IMAGE_PRESETS[0].url);
    setFormDescription('');
    setFormIsActive(true);
    setFormProductIds([]);
    setProductSearchInModal('');
    setIsAddingNewProductInline(false);
    setInlineProductName('');
    setInlineProductPrice('');
    setInlineProductImage('');
    setEditingCategory(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (cat: Category) => {
    setFormName(cat.name);
    setFormImage(cat.image);
    setFormDescription(cat.description || '');
    setFormIsActive(cat.is_active);
    
    // Find products currently in this category
    const currentProducts = allProducts.filter(
      p => p.category?.toLowerCase() === cat.name.toLowerCase() || (cat.product_ids || []).includes(p.id)
    ).map(p => p.id);

    setFormProductIds(Array.from(new Set([...(cat.product_ids || []), ...currentProducts])));
    setProductSearchInModal('');
    setIsAddingNewProductInline(false);
    setInlineProductName('');
    setInlineProductPrice('');
    setInlineProductImage('');
    setEditingCategory(cat);
    setIsCreateModalOpen(true);
  };

  // Open Product Management Modal for specific category
  const handleOpenProductManagement = (cat: Category) => {
    const currentProducts = allProducts.filter(
      p => p.category?.toLowerCase() === cat.name.toLowerCase() || (cat.product_ids || []).includes(p.id)
    ).map(p => p.id);

    setFormProductIds(Array.from(new Set([...(cat.product_ids || []), ...currentProducts])));
    setProductSearchInModal('');
    setManagingProductsCategory(cat);
  };

  // Handle Image File Upload
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading('Uploading category image...');
    try {
      const uploadedUrl = await uploadImage(file);
      setFormImage(uploadedUrl);
      toast.success('Category image uploaded!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Image upload failed', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  // Toggle Product Selection in Category Form
  const toggleProductSelection = (productId: string) => {
    setFormProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Select / Deselect all products in search view
  const handleToggleSelectAll = (filteredIds: string[]) => {
    const allSelected = filteredIds.every(id => formProductIds.includes(id));
    if (allSelected) {
      setFormProductIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setFormProductIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  // Quick Create New Product inside Category Form
  const handleCreateProductInline = async () => {
    if (!inlineProductName.trim()) {
      toast.error('Enter product name');
      return;
    }
    const priceNum = parseFloat(inlineProductPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Enter a valid price');
      return;
    }

    setIsSavingInlineProduct(true);
    const toastId = toast.loading('Adding product...');
    try {
      const prodImg = inlineProductImage.trim() || formImage || BAKERY_IMAGE_PRESETS[0].url;
      const targetCategory = formName.trim() || 'General';

      const { data, error } = await supabase.from('products').insert({
        name: inlineProductName.trim(),
        price: priceNum,
        image: prodImg,
        category: targetCategory,
        available: true,
        stock_quantity: 50,
        description: `Handcrafted ${inlineProductName.trim()} from our ${targetCategory} bakery collection.`,
      }).select().single();

      if (error) throw error;

      if (data) {
        const newProd: FoodItem = {
          id: String(data.id),
          name: data.name,
          price: Number(data.price),
          image: data.image,
          category: data.category,
          description: data.description,
          rating: 5,
          stock_quantity: data.stock_quantity,
        };

        setAllProducts(prev => [newProd, ...prev]);
        setFormProductIds(prev => [...prev, newProd.id]);
        setInlineProductName('');
        setInlineProductPrice('');
        setInlineProductImage('');
        setIsAddingNewProductInline(false);
        toast.success(`"${newProd.name}" added to this category!`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add product', { id: toastId });
    } finally {
      setIsSavingInlineProduct(false);
    }
  };

  // Save Category (Create or Update)
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Please enter a category name');
      return;
    }
    if (!formImage.trim()) {
      toast.error('Please provide or select a category image');
      return;
    }

    setIsSaving(true);
    try {
      if (editingCategory) {
        await categoryService.updateCategory(editingCategory.id, {
          name: formName.trim(),
          image: formImage.trim(),
          description: formDescription.trim(),
          is_active: formIsActive,
          product_ids: formProductIds
        });
        toast.success(`Category "${formName.trim()}" updated successfully!`);
      } else {
        await categoryService.createCategory({
          name: formName.trim(),
          image: formImage.trim(),
          description: formDescription.trim(),
          is_active: formIsActive,
          product_ids: formProductIds
        });
        toast.success(`Category "${formName.trim()}" created successfully!`);
      }

      setIsCreateModalOpen(false);
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  // Save Dedicated Product Assignment Modal
  const handleSaveProductAssignments = async () => {
    if (!managingProductsCategory) return;
    setIsSaving(true);
    try {
      await categoryService.updateCategory(managingProductsCategory.id, {
        product_ids: formProductIds
      });
      toast.success(`Assigned ${formProductIds.length} products to "${managingProductsCategory.name}"!`);
      setManagingProductsCategory(null);
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update product assignments');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Category
  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    try {
      await categoryService.deleteCategory(deletingCategory.id);
      toast.success(`Category "${deletingCategory.name}" removed.`);
      setDeletingCategory(null);
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category');
    }
  };

  // Reorder category priority (Move Up / Down)
  const handleMoveCategoryOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newCategories = [...categories];
    const temp = newCategories[index];
    newCategories[index] = newCategories[targetIndex];
    newCategories[targetIndex] = temp;

    newCategories.forEach((c, i) => {
      c.sort_order = i + 1;
    });

    setCategories([...newCategories]);

    try {
      await Promise.all([
        categoryService.updateCategory(newCategories[index].id, { sort_order: newCategories[index].sort_order }),
        categoryService.updateCategory(newCategories[targetIndex].id, { sort_order: newCategories[targetIndex].sort_order })
      ]);
      toast.success('Category order updated!');
    } catch (err: any) {
      toast.error('Failed to update category order');
      await loadData(true);
    }
  };

  // Filter Categories by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.description || '').toLowerCase().includes(q)
    );
  }, [categories, searchQuery]);

  // Filter Products inside modal by search
  const filteredProductsInModal = useMemo(() => {
    if (!productSearchInModal.trim()) return allProducts;
    const q = productSearchInModal.toLowerCase();
    return allProducts.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.category || '').toLowerCase().includes(q)
    );
  }, [allProducts, productSearchInModal]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-stone-200/90 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold uppercase tracking-wider mb-2">
            <Layers size={13} />
            <span>Storefront Catalog</span>
          </div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">Category Management</h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1 max-w-xl">
            Create categories with high-definition imagery and assign menu products directly. Changes reflect instantly across the customer storefront and smooth sliders.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => loadData(true)}
            className="p-3 rounded-2xl border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors cursor-pointer"
            title="Refresh categories"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-5 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
            id="btn_create_category"
          >
            <Plus size={18} />
            <span>Create Category</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-stone-200/90 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Total Categories</p>
            <p className="text-2xl font-black text-stone-900 mt-0.5">{categories.length}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Layers size={22} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200/90 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Active on Store</p>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">
              {categories.filter(c => c.is_active).length}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Eye size={22} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200/90 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Catalog Products</p>
            <p className="text-2xl font-black text-stone-900 mt-0.5">{allProducts.length}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Package size={22} />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-sm focus:outline-none focus:border-orange-500 transition-colors shadow-xs"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Category Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 rounded-3xl bg-white border border-stone-200 animate-pulse" />
          ))}
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-stone-200 space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <Layers size={28} />
          </div>
          <h3 className="text-lg font-bold text-stone-900">No categories found</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {searchQuery ? `No category matching "${searchQuery}"` : 'Get started by creating your first artisanal category.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold text-xs"
          >
            Create Category
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredCategories.map((cat, index) => {
            const assignedCount = allProducts.filter(
              p => p.category?.toLowerCase() === cat.name.toLowerCase() || (cat.product_ids || []).includes(p.id)
            ).length;

            return (
              <motion.div
                key={cat.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group flex flex-col justify-between rounded-3xl bg-white border border-stone-200/90 hover:border-orange-500/40 hover:shadow-lg transition-all duration-300 overflow-hidden relative"
              >
                {/* Category Header Image */}
                <div className="relative h-44 w-full overflow-hidden bg-stone-100">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent" />

                  {/* Top Control Bar: Active Status & Order Buttons */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${
                      cat.is_active 
                        ? 'bg-emerald-500/90 text-white shadow-xs' 
                        : 'bg-stone-800/80 text-stone-300'
                    }`}>
                      {cat.is_active ? 'Active' : 'Hidden'}
                    </span>

                    {/* Reorder Arrows */}
                    <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-xl p-0.5 text-white">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveCategoryOrder(index, 'up')}
                        className="p-1 hover:bg-white/20 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Move category earlier in slide"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={index === categories.length - 1}
                        onClick={() => handleMoveCategoryOrder(index, 'down')}
                        className="p-1 hover:bg-white/20 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Move category later in slide"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Assigned Products Counter & Name */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                    <h3 className="text-xl font-black tracking-tight drop-shadow-md truncate pr-2">
                      {cat.name}
                    </h3>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/20 backdrop-blur-md text-xs font-bold shrink-0">
                      <Package size={13} />
                      <span>{assignedCount} items</span>
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                    {cat.description || 'No description provided for this category.'}
                  </p>

                  <div className="pt-2 border-t border-stone-100 space-y-2">
                    {/* Manage Products Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenProductManagement(cat)}
                      className="w-full py-2 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Package size={14} />
                      <span>Manage Products ({assignedCount})</span>
                      <ChevronRight size={13} />
                    </button>

                    {/* Edit & Delete Action Row */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(cat)}
                        className="flex-1 py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Edit category details"
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingCategory(cat)}
                        className="p-2 rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete category"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: CREATE OR EDIT CATEGORY (NAME, IMAGE, DESCRIPTION, PRODUCTS)
          ========================================================================= */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSaveCategory}>
                {/* Modal Header */}
                <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
                      <Layers size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-stone-900">
                        {editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create New Category'}
                      </h2>
                      <p className="text-xs text-stone-500">
                        Specify category branding, upload hero images, and select products.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="p-2 rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {/* Category Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Category Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Gourmet Cheesecakes"
                      className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-sm font-semibold focus:outline-none focus:border-orange-500 transition-colors shadow-xs"
                    />
                  </div>

                  {/* Category Image Preview & Uploader */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center justify-between">
                      <span>Category Image <span className="text-red-500">*</span></span>
                      <span className="text-[11px] text-stone-400 lowercase font-normal">URL or File Upload</span>
                    </label>

                    {/* Preview Banner */}
                    <div className="relative h-44 w-full rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
                      {formImage ? (
                        <img 
                          src={formImage} 
                          alt="Preview" 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = BAKERY_IMAGE_PRESETS[0].url;
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 gap-2">
                          <ImageIcon size={32} />
                          <span className="text-xs font-semibold">No image selected</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute bottom-3 left-3 text-white">
                        <span className="text-xs font-bold bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-xs">
                          Live Storefront Slide Preview
                        </span>
                      </div>
                    </div>

                    {/* Upload / URL Input */}
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={formImage}
                        onChange={(e) => setFormImage(e.target.value)}
                        placeholder="Paste image URL..."
                        className="flex-1 px-4 py-2.5 rounded-2xl border border-stone-200 text-xs focus:outline-none focus:border-orange-500 font-mono"
                      />

                      <label className="px-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
                        <Upload size={14} />
                        <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageFileChange}
                          disabled={isUploading}
                        />
                      </label>
                    </div>

                    {/* 1-Tap Bakery Presets */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-stone-500">Quick Bakery Photography Presets:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {BAKERY_IMAGE_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => setFormImage(preset.url)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                              formImage === preset.url
                                ? 'bg-orange-50 border-orange-500 text-orange-600 font-bold shadow-xs'
                                : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                            }`}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Description (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Short description displayed on category pages..."
                      className="w-full px-4 py-2.5 rounded-2xl border border-stone-200 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                    <div>
                      <p className="text-xs font-bold text-stone-800">Publish Category on Storefront</p>
                      <p className="text-[11px] text-stone-500">Customers can browse and filter products in this category.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600" />
                    </label>
                  </div>

                  {/* Add Products in it Section */}
                  <div className="space-y-3 pt-2 border-t border-stone-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                          Add Products In This Category ({formProductIds.length} selected)
                        </h4>
                        <p className="text-[11px] text-stone-500">
                          Select the menu products to include in this category.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsAddingNewProductInline(prev => !prev)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-500 cursor-pointer flex items-center gap-1"
                        >
                          <Plus size={13} />
                          <span>{isAddingNewProductInline ? 'Hide New Item Form' : 'Add New Product'}</span>
                        </button>

                        {filteredProductsInModal.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleToggleSelectAll(filteredProductsInModal.map(p => p.id))}
                            className="text-xs font-bold text-orange-600 hover:text-orange-500 cursor-pointer"
                          >
                            {filteredProductsInModal.every(p => formProductIds.includes(p.id)) ? 'Deselect All' : 'Select All'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quick Create New Product Inline Drawer */}
                    {isAddingNewProductInline && (
                      <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-blue-950">Quick-Add New Product to "{formName || 'New Category'}"</h5>
                          <span className="text-[10px] text-blue-600 font-medium">Saves directly to catalog</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Product name (e.g. Lotus Cheesecake)"
                            value={inlineProductName}
                            onChange={(e) => setInlineProductName(e.target.value)}
                            className="px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs focus:outline-none focus:border-blue-500 font-medium"
                          />
                          <input
                            type="number"
                            placeholder="Price (₹)"
                            value={inlineProductPrice}
                            onChange={(e) => setInlineProductPrice(e.target.value)}
                            className="px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            placeholder="Product image URL (optional, defaults to category image)"
                            value={inlineProductImage}
                            onChange={(e) => setInlineProductImage(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                          />
                          <button
                            type="button"
                            disabled={isSavingInlineProduct}
                            onClick={handleCreateProductInline}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {isSavingInlineProduct ? 'Adding...' : 'Add Product'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Product Search Box */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="text"
                        value={productSearchInModal}
                        onChange={(e) => setProductSearchInModal(e.target.value)}
                        placeholder="Filter catalog products..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    {/* Product Selection List */}
                    <div className="max-h-52 overflow-y-auto space-y-1.5 border border-stone-200 rounded-2xl p-2 bg-stone-50/50 custom-scrollbar">
                      {filteredProductsInModal.length === 0 ? (
                        <p className="text-center text-xs text-stone-400 py-4">No products found</p>
                      ) : (
                        filteredProductsInModal.map((product) => {
                          const isSelected = formProductIds.includes(product.id);
                          return (
                            <div
                              key={product.id}
                              onClick={() => toggleProductSelection(product.id)}
                              className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-orange-50 border-orange-500 text-orange-950 font-bold'
                                  : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-8 h-8 rounded-lg object-cover border border-stone-200 shrink-0"
                                />
                                <div className="truncate">
                                  <p className="text-xs truncate">{product.name}</p>
                                  <p className="text-[10px] text-stone-400 font-mono">₹{product.price}</p>
                                </div>
                              </div>

                              <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                isSelected ? 'bg-orange-600 border-orange-600 text-white' : 'border-stone-300 bg-white'
                              }`}>
                                {isSelected && <Check size={12} strokeWidth={3} />}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-stone-100 flex items-center justify-end gap-3 bg-stone-50/50">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-5 py-2.5 rounded-2xl border border-stone-200 text-stone-600 hover:bg-stone-100 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          MODAL 2: DEDICATED PRODUCT ASSIGNMENT MODAL
          ========================================================================= */}
      <AnimatePresence>
        {managingProductsCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                <div className="flex items-center gap-3">
                  <img
                    src={managingProductsCategory.image}
                    alt={managingProductsCategory.name}
                    className="w-10 h-10 rounded-2xl object-cover border border-stone-200"
                  />
                  <div>
                    <h2 className="text-lg font-black text-stone-900">
                      Manage Products for "{managingProductsCategory.name}"
                    </h2>
                    <p className="text-xs text-stone-500">
                      Check items to include them in this category.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setManagingProductsCategory(null)}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-600">
                    {formProductIds.length} of {allProducts.length} products assigned
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(filteredProductsInModal.map(p => p.id))}
                    className="text-xs font-bold text-orange-600 hover:text-orange-500 cursor-pointer"
                  >
                    {filteredProductsInModal.every(p => formProductIds.includes(p.id)) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={productSearchInModal}
                    onChange={(e) => setProductSearchInModal(e.target.value)}
                    placeholder="Search menu items..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 border border-stone-200 rounded-2xl p-2 bg-stone-50/50 custom-scrollbar">
                  {filteredProductsInModal.map((product) => {
                    const isSelected = formProductIds.includes(product.id);
                    return (
                      <div
                        key={product.id}
                        onClick={() => toggleProductSelection(product.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-orange-50 border-orange-500 text-orange-950 font-bold'
                            : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-10 h-10 rounded-xl object-cover border border-stone-200 shrink-0"
                          />
                          <div className="truncate">
                            <p className="text-xs font-bold truncate">{product.name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-stone-400 font-mono">
                              <span>₹{product.price}</span>
                              <span>•</span>
                              <span>Current: {product.category}</span>
                            </div>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                          isSelected ? 'bg-orange-600 border-orange-600 text-white' : 'border-stone-300 bg-white'
                        }`}>
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 border-t border-stone-100 flex items-center justify-end gap-3 bg-stone-50/50">
                <button
                  type="button"
                  onClick={() => setManagingProductsCategory(null)}
                  className="px-5 py-2.5 rounded-2xl border border-stone-200 text-stone-600 hover:bg-stone-100 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveProductAssignments}
                  className="px-6 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Updating...' : 'Save Product Assignments'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deletingCategory}
        title={`Delete Category "${deletingCategory?.name}"?`}
        description="Are you sure you want to delete this category? Products in this category will remain available under 'General'."
        confirmText="Delete Category"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingCategory(null)}
      />
    </div>
  );
};
export default CategoriesManager;
