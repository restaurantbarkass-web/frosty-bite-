-- Supabase Migration Script for Bakery App (Version 2)
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 0. Preparation: Drop policies that might block column type changes
DO $$ 
BEGIN
    -- Drop riders policies
    DROP POLICY IF EXISTS "Public Read Riders" ON public.riders;
    DROP POLICY IF EXISTS "Riders Manage Own Profile" ON public.riders;
    
    -- Drop orders policies
    DROP POLICY IF EXISTS "Public Read Orders" ON public.orders;
    DROP POLICY IF EXISTS "Users Insert Orders" ON public.orders;
    DROP POLICY IF EXISTS "Users Update Own Orders" ON public.orders;
    
    -- Drop users policies
    DROP POLICY IF EXISTS "Public Read Users" ON public.users;
    DROP POLICY IF EXISTS "Users Update Own Profile" ON public.users;
    DROP POLICY IF EXISTS "Users Insert Own Profile" ON public.users;
    DROP POLICY IF EXISTS "Users can manage their own profiles" ON public.users;
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
    
    -- Drop products policies
    DROP POLICY IF EXISTS "Public Read Products" ON public.products;
    DROP POLICY IF EXISTS "Admin Manage Products" ON public.products;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- 1. Ensure tables exist with correct base structure
CREATE TABLE IF NOT EXISTS public.users (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.products (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.orders (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.riders (id TEXT PRIMARY KEY);

-- 2. Users Table (Recreating to ensure schema cache is fresh and columns match)
DROP TABLE IF EXISTS public.users CASCADE;
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT UNIQUE, -- Nullable!
    supabase_uid TEXT UNIQUE, -- Added!
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'customer',
    avatar_url TEXT,
    avatar TEXT, -- Added
    phone TEXT,
    address TEXT,
    theme_name TEXT DEFAULT 'dark-premium',
    auth_methods TEXT[] DEFAULT '{}', -- Added
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT now(), -- Keep
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT now() -- Added
);

-- 3. Alter Products table columns
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;

-- 4. Alter Orders table columns
-- Drop incompatible foreign keys first if they exist
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_rider_id_fkey;

ALTER TABLE public.orders ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.orders ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS utr TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_screenshot TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_otp TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_delivery_time TEXT; -- Using TEXT to be safe for either timestamp or number
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_arrival TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_location JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gst NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 5. Alter Riders table columns
ALTER TABLE public.riders ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline';
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS location JSONB;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS vehicle_number TEXT;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS total_earnings NUMERIC DEFAULT 0;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS orders_completed INTEGER DEFAULT 0;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 6. Wishlist table (Recreating to refresh schema cache)
DROP TABLE IF EXISTS public.wishlist;
CREATE TABLE public.wishlist (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    item_details JSONB,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, product_id)
);

-- 6.5 Coupons Table
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'free_item')),
    value NUMERIC DEFAULT 0,
    min_order NUMERIC DEFAULT 0,
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    usage_limit INTEGER DEFAULT 100,
    usage_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    is_hidden BOOLEAN DEFAULT false,
    is_first_order_only BOOLEAN DEFAULT false,
    free_item_id TEXT,
    free_item_quantity INTEGER DEFAULT 1,
    gift_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Coupons Policies
DROP POLICY IF EXISTS "Public Read Coupons" ON public.coupons;
CREATE POLICY "Public Read Coupons" ON public.coupons FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin Manage Coupons" ON public.coupons;
CREATE POLICY "Admin Manage Coupons" ON public.coupons FOR ALL USING (true) WITH CHECK (true);

-- Ensure columns exist if table was already created
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS free_item_id TEXT;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS free_item_quantity INTEGER DEFAULT 1;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS gift_url TEXT;

-- Ensure constraints match
ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_type_check;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_type_check CHECK (type IN ('percentage', 'fixed', 'free_item'));

-- 7. Ensure RLS is enabled
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

-- 7. Permissive Access Policies
DROP POLICY IF EXISTS "wishlist_permissive_access" ON public.wishlist;
CREATE POLICY "wishlist_permissive_access" ON public.wishlist FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users Update Own Profile" ON public.users;
CREATE POLICY "Users Update Own Profile" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users Update Own Orders" ON public.orders;
CREATE POLICY "Users Update Own Orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Riders" ON public.riders;
CREATE POLICY "Public Read Riders" ON public.riders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Riders Manage Own Profile" ON public.riders;
CREATE POLICY "Riders Manage Own Profile" ON public.riders FOR ALL USING (true);

-- 7. Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 8. Banners Table
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    redirect_url TEXT,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_flash_deal BOOLEAN DEFAULT false,
    auto_apply_coupon TEXT,
    gift_url TEXT,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure columns exist if table was already created
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS is_flash_deal BOOLEAN DEFAULT false;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS auto_apply_coupon TEXT;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS gift_url TEXT;

-- 9. Banner Clicks Table
CREATE TABLE IF NOT EXISTS public.banner_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    banner_id UUID REFERENCES public.banners(id) ON DELETE CASCADE,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    user_id TEXT
);

-- Enable RLS for banners
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banner_clicks ENABLE ROW LEVEL SECURITY;

-- Banners Policies
DROP POLICY IF EXISTS "Public Read Banners" ON public.banners;
CREATE POLICY "Public Read Banners" ON public.banners FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin All Banners" ON public.banners;
CREATE POLICY "Admin All Banners" ON public.banners FOR ALL USING (true) WITH CHECK (true);

-- Banner Clicks Policies
DROP POLICY IF EXISTS "Public Insert Clicks" ON public.banner_clicks;
CREATE POLICY "Public Insert Clicks" ON public.banner_clicks FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admin Read Clicks" ON public.banner_clicks;
CREATE POLICY "Admin Read Clicks" ON public.banner_clicks FOR SELECT USING (true);

-- 10. Admins Table (Whitelisted admin emails)
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on admins
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Allow public read of admins (needed for auth check)
DROP POLICY IF EXISTS "Public Read Admins" ON public.admins;
CREATE POLICY "Public Read Admins" ON public.admins FOR SELECT USING (true);

-- 11. Storage Setup & Policies
-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- 12. Reviews Table
CREATE TABLE IF NOT EXISTS public.reviews (
    id BIGSERIAL PRIMARY KEY,
    order_id TEXT,
    user_id TEXT,
    customer_name TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Reviews Policies
DROP POLICY IF EXISTS "Public Read Reviews" ON public.reviews;
CREATE POLICY "Public Read Reviews" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users Insert Own Reviews" ON public.reviews;
CREATE POLICY "Users Insert Own Reviews" ON public.reviews FOR INSERT WITH CHECK (true);

-- STORAGE POLICIES (Critical for Image Upload)
-- 1. Allow public to view images
DROP POLICY IF EXISTS "Public View Banners" ON storage.objects;
CREATE POLICY "Public View Banners" ON storage.objects FOR SELECT USING (bucket_id = 'banners');

-- 2. Allow anyone to upload to banners (Simplified for now, you can restrict to auth.uid() later)
DROP POLICY IF EXISTS "Anonymous Upload Banners" ON storage.objects;
CREATE POLICY "Anonymous Upload Banners" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'banners');

-- 13. OTPs Table for Authentication with Security tracking
CREATE TABLE IF NOT EXISTS public.otps (
    email TEXT PRIMARY KEY,
    otp TEXT NOT NULL,
    expires_at BIGINT NOT NULL,
    attempts INTEGER DEFAULT 0,
    locked_until BIGINT DEFAULT 0,
    request_count INTEGER DEFAULT 0,
    last_request_at BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure columns exist if table was already created without them
ALTER TABLE public.otps ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE public.otps ADD COLUMN IF NOT EXISTS locked_until BIGINT DEFAULT 0;
ALTER TABLE public.otps ADD COLUMN IF NOT EXISTS request_count INTEGER DEFAULT 0;
ALTER TABLE public.otps ADD COLUMN IF NOT EXISTS last_request_at BIGINT DEFAULT 0;

-- 14. OTPs Table for Authentication with Security tracking
-- (OTPs table is already handled in section 13)

-- Ensure users table structure is updated with fallback alters (if table already existed)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS supabase_uid TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_methods TEXT[] DEFAULT '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_key ON public.users (firebase_uid);
CREATE UNIQUE INDEX IF NOT EXISTS users_supabase_uid_key ON public.users (supabase_uid);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Enable RLS
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow server to manage everything
DROP POLICY IF EXISTS "Service Role Manage OTPs" ON public.otps;
CREATE POLICY "Service Role Manage OTPs" ON public.otps FOR ALL USING (true);

DROP POLICY IF EXISTS "Service Role Manage Users" ON public.users;
CREATE POLICY "Service Role Manage Users" ON public.users FOR ALL USING (true);

-- Allow users to read their own profile
DROP POLICY IF EXISTS "Users view own profile" ON public.users;
CREATE POLICY "Users view own profile" ON public.users FOR SELECT USING (firebase_uid = auth.uid()::text OR supabase_uid = auth.uid()::text OR email = auth.jwt() ->> 'email');
