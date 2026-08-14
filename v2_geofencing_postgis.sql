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
