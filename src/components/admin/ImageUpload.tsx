import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../supabase';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  currentImage?: string;
  bucket?: string;
  label?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ 
  onUploadComplete, 
  currentImage, 
  bucket = 'banners',
  label = 'Banner Image'
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('File size should be less than 5MB');
      return;
    }

    setIsUploading(true);
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (error) {
        if (error.message.includes('Bucket not found')) {
          throw new Error('Storage bucket "banners" not found. Please create it in Supabase Dashboard with public access.');
        }
        throw error;
      }

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      onUploadComplete(publicUrl);
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload image');
      setPreview(currentImage || null); // Revert preview on failure
    } finally {
      setIsUploading(false);
    }
  };

  const clearImage = () => {
    setPreview(null);
    onUploadComplete('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">{label}</label>
      
      <div 
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={cn(
          "relative aspect-[21/9] rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center gap-2 group",
          preview ? "border-white/20" : "border-white/10 hover:border-primary/50 hover:bg-primary/5",
          isUploading && "pointer-events-none opacity-80"
        )}
      >
        {preview ? (
          <>
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
               <div className="flex flex-col items-center gap-2">
                 <Upload className="text-white" size={24} />
                 <span className="text-[10px] font-black text-white uppercase tracking-widest">Change Image</span>
               </div>
            </div>
            {isUploading && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                clearImage();
              }}
              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-rose-500 rounded-full text-white transition-colors"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-primary group-hover:scale-110 transition-all">
              <Upload size={24} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white uppercase tracking-tight">Click to upload</p>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">PNG, JPG up to 5MB</p>
            </div>
          </div>
        )}
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />
      </div>

      {preview && !isUploading && (
        <div className="flex items-center gap-2 text-emerald-500">
          <CheckCircle2 size={12} />
          <span className="text-[9px] font-black uppercase tracking-widest">Image Ready</span>
        </div>
      )}
    </div>
  );
};
