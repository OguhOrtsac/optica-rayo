-- Migration: Performance Optimizations
-- Date: 2026-07-10
-- Author: Performance Engineer
-- Scope: RLS caching via STABLE role helper with JWT fallback and PostgreSQL indexing.

-- ============================================================
-- 1. OPTIMIZE get_my_role() TO PREVENT RLS N+1 QUERYING
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
DECLARE
  _role TEXT;
BEGIN
  -- Try to extract the custom role metadata directly from the transaction's JWT claims
  -- This is extremely fast because it happens in-memory without querying any tables.
  _role := coalesce(
    current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role',
    null
  );
  
  -- Fallback to physical query only if JWT claims are not present (e.g. database migration or console execution)
  IF _role IS NULL THEN
    SELECT role INTO _role FROM public.profiles WHERE id = auth.uid();
  END IF;
  
  RETURN coalesce(_role, 'customer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- 2. CREATE INDEXES TO ACCELERATE JOINS AND SEARCHES
-- ============================================================

-- Profiles Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles(full_name);

-- Clinical Exams Indexes
CREATE INDEX IF NOT EXISTS idx_clinical_exams_customer_id ON public.clinical_exams(customer_id);
CREATE INDEX IF NOT EXISTS idx_clinical_exams_examiner_id ON public.clinical_exams(examiner_id);
CREATE INDEX IF NOT EXISTS idx_clinical_exams_date_desc ON public.clinical_exams(exam_date DESC);

-- Sales Indexes
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller_id ON public.sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at_desc ON public.sales(created_at DESC);

-- Sale Items Indexes
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);

-- Payment Installments Indexes
CREATE INDEX IF NOT EXISTS idx_payment_installments_sale_id ON public.payment_installments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_installments_due_date ON public.payment_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_installments_status ON public.payment_installments(status);

-- Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at_desc ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Reminders Indexes
CREATE INDEX IF NOT EXISTS idx_reminders_customer_id ON public.reminders(customer_id);
CREATE INDEX IF NOT EXISTS idx_reminders_next_visit ON public.reminders(next_suggested_visit);
