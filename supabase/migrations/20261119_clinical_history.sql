-- Migration: Historia clínica (formato real en papel del negocio)
-- Adds ONE JSONB column to clinical_exams holding the paper form's
-- fields (antecedentes, agudeza visual S/C y C/C, retinoscopía, DIP
-- monocular, RX inicial y observaciones de la hoja), in the sheet's
-- order. The vigente graduation (RX FINAL) keeps living in the
-- existing columns (od_sphere, oi_sphere, ...) untouched.
--
-- Additive and idempotent: safe to run more than once, touches no
-- existing data. The application works BEFORE and AFTER this runs:
-- when the column is missing, the exam save retries without the
-- history (same silent-degradation pattern as products.display_order).

ALTER TABLE public.clinical_exams
    ADD COLUMN IF NOT EXISTS clinical_history JSONB;

COMMENT ON COLUMN public.clinical_exams.clinical_history IS
    'Historia clínica (hoja en papel del negocio): antecedentes, AV S/C y C/C, retinoscopía, DIP por ojo, RX inicial y observaciones. La graduación vigente (RX Final) sigue en las columnas de siempre.';
