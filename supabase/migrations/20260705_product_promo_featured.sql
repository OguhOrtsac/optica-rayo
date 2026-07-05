-- Migration to add is_promo and is_featured to products table.
-- Date: 2026-07-05

ALTER TABLE public.products
ADD COLUMN is_promo BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN public.products.is_promo IS 'Whether the product is currently in promotion.';
COMMENT ON COLUMN public.products.is_featured IS 'Whether the product is featured in the main carousel.';
