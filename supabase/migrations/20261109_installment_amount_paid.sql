-- Partial payments on installments.
-- Until now a payment of ANY amount marked the installment as fully 'paid'.
-- amount_paid accumulates what has really been paid toward the installment;
-- the status only becomes 'paid' when amount_paid covers the full amount.
-- Date: 2026-11-09

ALTER TABLE public.payment_installments
    ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Installments already settled keep their full amount as paid.
UPDATE public.payment_installments
SET amount_paid = amount
WHERE status = 'paid' AND amount_paid = 0;

COMMENT ON COLUMN public.payment_installments.amount_paid IS
    'Accumulated amount actually paid toward this installment. status becomes paid only when amount_paid >= amount.';
