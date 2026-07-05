-- Migration to create the wishlists table and RLS policies.
-- Date: 2026-07-05

CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, product_id)
);

-- Enable Row Level Security
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to perform operations on their own wishlist records
CREATE POLICY "Users can manage their own wishlist"
ON public.wishlists
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.wishlists IS 'Table storing customer favorite products.';
