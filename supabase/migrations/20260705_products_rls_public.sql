-- Migration to enable public SELECT access to products table (RLS Policy).
-- Date: 2026-07-05

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone (authenticated or anonymous) to view products.
CREATE POLICY "Allow public select access on products"
ON public.products
FOR SELECT
TO public
USING (true);

COMMENT ON POLICY "Allow public select access on products" ON public.products IS 'Allow read-only access to the products catalog for all visitors.';
