-- Migration: Free-text complements on sale items (POS «Complementos», 2026-11-18)
-- When a product is sold, the seller can attach free-text complements
-- (e.g. «Fotocromático») with their own price — 0 means the complement is
-- free («Gratis»). Each complement is stored as its OWN sale_items row so
-- it travels with the sale everywhere items are listed (POS history,
-- customer purchases, customer file):
--   * product_id      = NULL (it is not a catalog product)
--   * quantity        = quantity of the parent product in the sale
--   * price           = unit price of the complement (0 = Gratis)
--   * is_complement   = true (distinguishes the row from product rows)
--   * complement_name = the free-text name the seller typed
--   * complement_for  = name of the parent product it belongs to
-- complement_name is required in addition to the two flag columns: the
-- free-text name has no other column to live in (sale_items has no name
-- column and product_id is NULL for these rows).

ALTER TABLE public.sale_items
    ADD COLUMN IF NOT EXISTS is_complement boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS complement_name text,
    ADD COLUMN IF NOT EXISTS complement_for text;

COMMENT ON COLUMN public.sale_items.is_complement IS
    'true when this row is a free-text complement attached to a product of the same sale, not a catalog product.';
COMMENT ON COLUMN public.sale_items.complement_name IS
    'Free-text name of the complement (e.g. Fotocromático). Only set when is_complement is true.';
COMMENT ON COLUMN public.sale_items.complement_for IS
    'Name of the parent product this complement belongs to. Only set when is_complement is true.';
