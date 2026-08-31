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
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS estimated_delivery_time INTEGER DEFAULT 30;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS estimated_delivery_time_unit TEXT DEFAULT 'mins';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_date TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_day TEXT;

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
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'none'; -- none, pending_refund, refunded, failed
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC;


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
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Public Read Products" ON public.products;
CREATE POLICY "Public Read Products" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin Manage Products" ON public.products;
CREATE POLICY "Admin Manage Products" ON public.products FOR ALL USING (true) WITH CHECK (true);

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

-- 13b. WhatsApp OTPs Table for Authentication with Security Tracking
CREATE TABLE IF NOT EXISTS public.whatsapp_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    otp_code TEXT NOT NULL, -- Hashed secure token representation
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on whatsapp_otps
ALTER TABLE public.whatsapp_otps ENABLE ROW LEVEL SECURITY;

-- Allow full access to whatsapp_otps for the service_role key (server-side logic)
DROP POLICY IF EXISTS "Service Role Manage WhatsApp OTPs" ON public.whatsapp_otps;
CREATE POLICY "Service Role Manage WhatsApp OTPs" ON public.whatsapp_otps FOR ALL USING (true);


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

-- Allow public/guest/any client to select the system settings row
DROP POLICY IF EXISTS "Allow public read of system settings" ON public.users;
CREATE POLICY "Allow public read of system settings" ON public.users FOR SELECT USING (email = 'system_settings_v1@frostybite.internal');

-- Allow authenticated admins to update the system settings row
DROP POLICY IF EXISTS "Allow admins to update system settings" ON public.users;
CREATE POLICY "Allow admins to update system settings" ON public.users FOR UPDATE USING (
  (auth.jwt() ->> 'email') IN (SELECT email FROM public.admins)
  OR (auth.jwt() ->> 'email') IN (
    'restaurantbarkass@gmail.com',
    'wasifmd924@gmail.com',
    'sayedazainab216@gmail.com',
    'sayedazainabali76@gmail.com'
  )
) WITH CHECK (
  (auth.jwt() ->> 'email') IN (SELECT email FROM public.admins)
  OR (auth.jwt() ->> 'email') IN (
    'restaurantbarkass@gmail.com',
    'wasifmd924@gmail.com',
    'sayedazainab216@gmail.com',
    'sayedazainabali76@gmail.com'
  )
);

-- Allow users to read their own profile
DROP POLICY IF EXISTS "Users view own profile" ON public.users;
CREATE POLICY "Users view own profile" ON public.users FOR SELECT USING (firebase_uid = auth.uid()::text OR supabase_uid = auth.uid()::text OR email = auth.jwt() ->> 'email');

-- 15. Cancellation Logs for enterprise tracking
CREATE TABLE IF NOT EXISTS public.cancellation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL,
    user_id TEXT,
    reason TEXT,
    cancelled_by TEXT DEFAULT 'customer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.cancellation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Select Logs" ON public.cancellation_logs;
CREATE POLICY "Public Select Logs" ON public.cancellation_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone Insert Logs" ON public.cancellation_logs;
CREATE POLICY "Anyone Insert Logs" ON public.cancellation_logs FOR INSERT WITH CHECK (true);

-- 16. Delivery Areas, Service Pincodes, and Service Zones for Supabase Realtime
CREATE TABLE IF NOT EXISTS public.delivery_areas (
    id TEXT PRIMARY KEY,
    area_name TEXT NOT NULL,
    pincode TEXT NOT NULL,
    is_deliverable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_pincodes (
    id TEXT PRIMARY KEY,
    pincode TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_zones (
    id TEXT PRIMARY KEY,
    city_name TEXT NOT NULL,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    radius_meters NUMERIC NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_pincodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_zones ENABLE ROW LEVEL SECURITY;

-- Permissive All Policies for Development/Preview
DROP POLICY IF EXISTS "permissive_all_delivery_areas" ON public.delivery_areas;
CREATE POLICY "permissive_all_delivery_areas" ON public.delivery_areas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "permissive_all_service_pincodes" ON public.service_pincodes;
CREATE POLICY "permissive_all_service_pincodes" ON public.service_pincodes FOR ALL USING (true) WITH CHECK (true);

-- Allow anonymous read to service_pincodes for general accessibility
DROP POLICY IF EXISTS "read_all_service_pincodes" ON public.service_pincodes;
CREATE POLICY "read_all_service_pincodes" ON public.service_pincodes FOR SELECT USING (true);

DROP POLICY IF EXISTS "permissive_all_service_zones" ON public.service_zones;
CREATE POLICY "permissive_all_service_zones" ON public.service_zones FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime Publication
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Safely add tables to publication if not already added
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_namespace n ON c.relnamespace = n.oid 
            WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime') 
            AND n.nspname = 'public' AND c.relname = 'users'
        ) THEN
            ALTER publication supabase_realtime ADD TABLE public.users;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_namespace n ON c.relnamespace = n.oid 
            WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime') 
            AND n.nspname = 'public' AND c.relname = 'delivery_areas'
        ) THEN
            ALTER publication supabase_realtime ADD TABLE public.delivery_areas;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_namespace n ON c.relnamespace = n.oid 
            WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime') 
            AND n.nspname = 'public' AND c.relname = 'service_pincodes'
        ) THEN
            ALTER publication supabase_realtime ADD TABLE public.service_pincodes;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_namespace n ON c.relnamespace = n.oid 
            WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime') 
            AND n.nspname = 'public' AND c.relname = 'service_zones'
        ) THEN
            ALTER publication supabase_realtime ADD TABLE public.service_zones;
        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- ============================================================================
-- GEOFENCING V2: POSTGIS DATABASE FOUNDATION MIGRATION
-- ============================================================================

-- 1. ENABLE POSTGIS EXTENSION
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. REUSABLE UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. CREATE CITIES TABLE
CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    state TEXT,
    country TEXT NOT NULL DEFAULT 'India',
    is_active BOOLEAN NOT NULL DEFAULT true,
    boundary GEOMETRY(MULTIPOLYGON, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_cities_geometry CHECK (boundary IS NULL OR (ST_IsValid(boundary) AND ST_SRID(boundary) = 4326))
);

-- 4. CREATE PINCODES TABLE
CREATE TABLE IF NOT EXISTS public.pincodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
    pincode TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    boundary GEOMETRY(MULTIPOLYGON, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_city_pincode UNIQUE (city_id, pincode),
    CONSTRAINT pincode_format_check CHECK (pincode ~ '^[0-9]{6}$'),
    CONSTRAINT check_pincodes_geometry CHECK (boundary IS NULL OR (ST_IsValid(boundary) AND ST_SRID(boundary) = 4326))
);

-- 5. CREATE LOCALITIES TABLE
CREATE TABLE IF NOT EXISTS public.localities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
    pincode_id UUID REFERENCES public.pincodes(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    minimum_order NUMERIC(10,2) NOT NULL DEFAULT 0,
    estimated_delivery_minutes INTEGER,
    boundary GEOMETRY(MULTIPOLYGON, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_city_locality_name UNIQUE (city_id, name),
    CONSTRAINT delivery_fee_non_negative CHECK (delivery_fee >= 0),
    CONSTRAINT minimum_order_non_negative CHECK (minimum_order >= 0),
    CONSTRAINT est_delivery_mins_positive CHECK (estimated_delivery_minutes IS NULL OR estimated_delivery_minutes > 0),
    CONSTRAINT check_localities_geometry CHECK (boundary IS NULL OR (ST_IsValid(boundary) AND ST_SRID(boundary) = 4326))
);

-- 6. CREATE SERVICE AREAS TABLE (GLOBAL SERVICE BOUNDARY)
CREATE TABLE IF NOT EXISTS public.service_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    boundary GEOMETRY(MULTIPOLYGON, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_service_areas_geometry CHECK (boundary IS NULL OR (ST_IsValid(boundary) AND ST_SRID(boundary) = 4326))
);

-- 7. SPATIAL GIST INDEXES
CREATE INDEX IF NOT EXISTS idx_service_areas_boundary ON public.service_areas USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_cities_boundary ON public.cities USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_pincodes_boundary ON public.pincodes USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_localities_boundary ON public.localities USING GIST (boundary);

-- 8. STANDARD B-TREE INDEXES
CREATE INDEX IF NOT EXISTS idx_cities_is_active ON public.cities (is_active);
CREATE INDEX IF NOT EXISTS idx_pincodes_city_id ON public.pincodes (city_id);
CREATE INDEX IF NOT EXISTS idx_pincodes_is_active ON public.pincodes (is_active);
CREATE INDEX IF NOT EXISTS idx_localities_city_id ON public.localities (city_id);
CREATE INDEX IF NOT EXISTS idx_localities_pincode_id ON public.localities (pincode_id);
CREATE INDEX IF NOT EXISTS idx_localities_is_active ON public.localities (is_active);

-- 9. UPDATED_AT TRIGGERS
DROP TRIGGER IF EXISTS update_cities_updated_at ON public.cities;
CREATE TRIGGER update_cities_updated_at BEFORE UPDATE ON public.cities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pincodes_updated_at ON public.pincodes;
CREATE TRIGGER update_pincodes_updated_at BEFORE UPDATE ON public.pincodes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_localities_updated_at ON public.localities;
CREATE TRIGGER update_localities_updated_at BEFORE UPDATE ON public.localities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_areas_updated_at ON public.service_areas;
CREATE TRIGGER update_service_areas_updated_at BEFORE UPDATE ON public.service_areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pincodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.localities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;

-- Public / Customer Read Policies (Active records only)
DROP POLICY IF EXISTS "public_read_active_cities" ON public.cities;
CREATE POLICY "public_read_active_cities" ON public.cities FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "public_read_active_pincodes" ON public.pincodes;
CREATE POLICY "public_read_active_pincodes" ON public.pincodes FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "public_read_active_localities" ON public.localities;
CREATE POLICY "public_read_active_localities" ON public.localities FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "public_read_active_service_areas" ON public.service_areas;
CREATE POLICY "public_read_active_service_areas" ON public.service_areas FOR SELECT USING (is_active = true);

-- Permissive All Access for Admins & Service Role / Dev Environment
DROP POLICY IF EXISTS "admin_all_cities" ON public.cities;
CREATE POLICY "admin_all_cities" ON public.cities FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_pincodes" ON public.pincodes;
CREATE POLICY "admin_all_pincodes" ON public.pincodes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_localities" ON public.localities;
CREATE POLICY "admin_all_localities" ON public.localities FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_service_areas" ON public.service_areas;
CREATE POLICY "admin_all_service_areas" ON public.service_areas FOR ALL USING (true) WITH CHECK (true);

-- 11. SUPABASE REALTIME PUBLICATION
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_namespace n ON c.relnamespace = n.oid 
            WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime') 
            AND n.nspname = 'public' AND c.relname = 'cities'
        ) THEN
            ALTER publication supabase_realtime ADD TABLE public.cities;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_namespace n ON c.relnamespace = n.oid 
            WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime') 
            AND n.nspname = 'public' AND c.relname = 'pincodes'
        ) THEN
            ALTER publication supabase_realtime ADD TABLE public.pincodes;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_namespace n ON c.relnamespace = n.oid 
            WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime') 
            AND n.nspname = 'public' AND c.relname = 'localities'
        ) THEN
            ALTER publication supabase_realtime ADD TABLE public.localities;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_namespace n ON c.relnamespace = n.oid 
            WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime') 
            AND n.nspname = 'public' AND c.relname = 'service_areas'
        ) THEN
            ALTER publication supabase_realtime ADD TABLE public.service_areas;
        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 12. INITIAL SEED DATA (CITY ONLY)
INSERT INTO public.cities (name, slug, state, country, is_active)
VALUES ('Cuttack', 'cuttack', 'Odisha', 'India', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 17. FROSTYPAY PAYMENT VERIFICATION TABLES & SECURITY (PHASE 2)
-- ============================================================================

-- Payment Verification Events Table (Android verifier detection notifications)
CREATE TABLE IF NOT EXISTS public.payment_verification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT,
    order_id TEXT,
    amount_paise BIGINT NOT NULL,
    upi_reference TEXT,
    source_package TEXT,
    source_type TEXT NOT NULL,
    transaction_time TIMESTAMPTZ DEFAULT now(),
    device_id TEXT NOT NULL,
    matched BOOLEAN DEFAULT false,
    processed BOOLEAN DEFAULT false,
    match_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure event_id and all columns exist if table was previously created without them
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS event_id TEXT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS amount_paise BIGINT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS upi_reference TEXT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS source_package TEXT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS transaction_time TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS matched BOOLEAN DEFAULT false;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS match_reason TEXT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_verification_events_event_id ON public.payment_verification_events (event_id);
CREATE INDEX IF NOT EXISTS idx_payment_verification_events_upi_ref ON public.payment_verification_events (upi_reference);
CREATE INDEX IF NOT EXISTS idx_payment_verification_events_amount ON public.payment_verification_events (amount_paise);
CREATE INDEX IF NOT EXISTS idx_payment_verification_events_order_id ON public.payment_verification_events (order_id);

-- Payment Attempts Table (Order checkout payment sessions)
CREATE TABLE IF NOT EXISTS public.payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT,
    amount_paise BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting', -- waiting, matched, expired, cancelled
    upi_reference TEXT,
    expires_at TIMESTAMPTZ,
    matched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS amount_paise BIGINT;
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waiting';
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS upi_reference TEXT;
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ;
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_payment_attempts_status_amount ON public.payment_attempts (status, amount_paise);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_order_id ON public.payment_attempts (order_id);

-- Enable RLS and define server-side policies
ALTER TABLE public.payment_verification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service Role Manage Payment Events" ON public.payment_verification_events;
CREATE POLICY "Service Role Manage Payment Events" ON public.payment_verification_events FOR ALL USING (true);

DROP POLICY IF EXISTS "Service Role Manage Payment Attempts" ON public.payment_attempts;
CREATE POLICY "Service Role Manage Payment Attempts" ON public.payment_attempts FOR ALL USING (true);



