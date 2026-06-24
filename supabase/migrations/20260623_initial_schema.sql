-- Relational Database Schema for Optica Rayo
-- Creates tables, sets relationships, configures RLS, and sets auto-triggers.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE ROLES ENUM
-- Profiles table will use a check constraint for simple roles.

-- 3. CREATE TABLES

-- PROFILES
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('dev', 'owner', 'seller', 'customer')),
    temporal_password_changed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PRODUCTS (Inventory & Catalog)
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    category TEXT NOT NULL CHECK (category IN ('frames', 'lenses', 'contact_lenses', 'accessories')),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SALES
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SALE ITEMS (Items details)
CREATE TABLE public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0)
);

-- COUPONS
CREATE TABLE public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- REMINDERS
CREATE TABLE public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    last_visit_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    next_suggested_visit TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES

-- PROFILES POLICIES
CREATE POLICY "Allow users to read their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Allow management roles to view all profiles"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

CREATE POLICY "Allow users to update certain fields of their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow dev and owner to delete/update any profile"
    ON public.profiles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'dev')
        )
    );

-- PRODUCTS POLICIES
CREATE POLICY "Allow anyone (customers and guests) to view products"
    ON public.products FOR SELECT
    USING (true);

CREATE POLICY "Allow owner, seller, and dev to manage products"
    ON public.products FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

-- SALES POLICIES
CREATE POLICY "Allow customers to view their own sales"
    ON public.sales FOR SELECT
    USING (auth.uid() = customer_id);

CREATE POLICY "Allow staff and dev to view all sales"
    ON public.sales FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

CREATE POLICY "Allow staff and dev to create sales"
    ON public.sales FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

-- SALE ITEMS POLICIES
CREATE POLICY "Allow customers to view their own sale items"
    ON public.sale_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.sales
            WHERE sales.id = sale_items.sale_id
            AND sales.customer_id = auth.uid()
        )
    );

CREATE POLICY "Allow staff and dev to view all sale items"
    ON public.sale_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

CREATE POLICY "Allow staff and dev to insert sale items"
    ON public.sale_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

-- COUPONS POLICIES
CREATE POLICY "Allow authenticated users to view coupons"
    ON public.coupons FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow staff and dev to manage coupons"
    ON public.coupons FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

-- REMINDERS POLICIES
CREATE POLICY "Allow customers to view their own reminders"
    ON public.reminders FOR SELECT
    USING (auth.uid() = customer_id);

CREATE POLICY "Allow staff and dev to manage reminders"
    ON public.reminders FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

-- 6. AUTOMATIC TRIGGER FOR USER SIGN UP
-- When a user signs up on Supabase Auth, create a public profile automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, temporal_password_changed)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Cliente Nuevo'),
    COALESCE(new.raw_user_meta_data->>'role', 'customer'),
    -- If created by staff, they might enforce password change.
    -- If self-signup, they don't have a temporal password, so we mark it as true.
    -- However, for the security rule "client account created with temporal password Rayo_name forces change",
    -- we default temporal_password_changed to false if a role is 'customer' and created by admin
    -- (indicated by temporal_password metadata or similar).
    -- By default we set it to true for self-signup, and false if metadata says otherwise.
    COALESCE((new.raw_user_meta_data->>'temporal_password_changed')::boolean, true)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
