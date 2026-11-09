-- Member pricing (owner's decision: BOTH mechanisms).
-- 1) products.client_price: optional per-product special price that only
--    logged-in customers see (offers, birthdays, campaigns).
-- 2) app_settings.member_discount_percent: general discount percent
--    applied to the visitor price for logged-in customers when a product
--    has no client_price. Seeded with the owner's example value (20).
-- Date: 2026-11-09

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS client_price NUMERIC(10, 2)
    CHECK (client_price IS NULL OR client_price >= 0);

COMMENT ON COLUMN public.products.client_price IS 'Special price for logged-in customers; NULL means use the general member discount percent.';

INSERT INTO public.app_settings (key, value) VALUES
    ('member_discount_percent', '20')
ON CONFLICT (key) DO NOTHING;
