-- Migration to support partial payments, pending balances, and payment methods in sales table.
-- Date: 2026-07-05

ALTER TABLE public.sales
ADD COLUMN paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
ADD COLUMN pending_balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (pending_balance >= 0),
ADD COLUMN payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'transfer'));

-- Comment on columns for documentation
COMMENT ON COLUMN public.sales.paid_amount IS 'The amount paid by the customer at the time of sale (anticipo/seña)';
COMMENT ON COLUMN public.sales.pending_balance IS 'The remaining balance to be paid by the customer';
COMMENT ON COLUMN public.sales.payment_method IS 'The method of payment: cash, card or bank transfer';
