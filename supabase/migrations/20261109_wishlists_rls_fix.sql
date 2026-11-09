-- Fix: the original wishlists policy ("Users can manage their own wishlist")
-- was created with USING (true) / WITH CHECK (true), which lets ANY
-- authenticated user read, edit and delete EVERY user's wishlist.
-- Replace it with a policy actually scoped to the owner of each row.
-- Date: 2026-11-09

DROP POLICY IF EXISTS "Users can manage their own wishlist" ON public.wishlists;

CREATE POLICY "Users can manage their own wishlist"
ON public.wishlists
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can manage their own wishlist" ON public.wishlists
IS 'Each authenticated user can only access wishlist rows whose user_id matches their own auth id.';
