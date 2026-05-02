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
ALTER TABLE public.users ALTER COLUMN id TYPE TEXT;
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

ALTER TABLE public.orders ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.orders ALTER COLUMN user_id TYPE TEXT;
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
ALTER TABLE public.riders ALTER COLUMN id TYPE TEXT;
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

-- Ensure NOT NULL constraints for critical fields (after adding columns)
-- Use a DO block to avoid errors if columns are already populated with nulls
DO $$ 
BEGIN
    ALTER TABLE public.orders ALTER COLUMN customer_name SET NOT NULL;
    ALTER TABLE public.orders ALTER COLUMN phone SET NOT NULL;
    ALTER TABLE public.orders ALTER COLUMN total SET NOT NULL;
    ALTER TABLE public.orders ALTER COLUMN address SET NOT NULL;
EXCEPTION
    WHEN others THEN 
        RAISE NOTICE 'Could not set NOT NULL constraints. Make sure existing data is valid.';
END $$;

-- 5. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;

-- 6. Re-create Policies
-- Products
CREATE POLICY "Public Read Products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admin Manage Products" ON public.products FOR ALL USING (true);

-- Users
CREATE POLICY "Public Read Users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users Insert Own Profile" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users Update Own Profile" ON public.users FOR UPDATE USING (id = auth.uid()::text);

-- Orders
CREATE POLICY "Public Read Orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Users Insert Orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Users Update Own Orders" ON public.orders FOR UPDATE USING (true);

-- Riders
CREATE POLICY "Public Read Riders" ON public.riders FOR SELECT USING (true);
CREATE POLICY "Riders Manage Own Profile" ON public.riders FOR ALL USING (true); -- Simplified for dev

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
