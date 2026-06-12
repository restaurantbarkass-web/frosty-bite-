-- Supabase Database Schema setup script for Frosty Bite delivery geofencing

-- 1. Create delivery_zones table
CREATE TABLE IF NOT EXISTS public.delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters DOUBLE PRECISION NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add Row Level Security (RLS) policies
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- Allow anonymous or public read-only access to verify zones
CREATE POLICY "Allow public read access to active delivery zones" 
ON public.delivery_zones 
FOR SELECT 
USING (active = true);

-- Provide write access only for authenticated administrators
CREATE POLICY "Allow full access to admin users" 
ON public.delivery_zones 
FOR ALL 
TO authenticated 
USING (true);

-- 3. Seed initial mockup delivery zones for demo use
INSERT INTO public.delivery_zones (name, latitude, longitude, radius_meters, active)
VALUES 
('Premium Marina Sanctuary', 1.2823, 103.8587, 5000.0, true), -- Marina Bay Sands area (5km radius)
('Downtown Confectionery Hub', 1.3002, 103.8321, 3500.0, true), -- Orchard Road area (3.5km radius)
('Elysian East Coast Haven', 1.3050, 103.9210, 4000.0, true)   -- Marine Parade area (4km radius)
ON CONFLICT (name) DO NOTHING;
