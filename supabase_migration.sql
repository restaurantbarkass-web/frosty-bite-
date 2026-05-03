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

-- 2. Alter Users table columns
ALTER TABLE public.users ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

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
ALTER TABLE public.orders ALTER COLUMN user_id TYPE TEXT USING user_id::text;
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

-- Ensure RLS is enabled
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
