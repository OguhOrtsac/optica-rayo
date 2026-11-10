-- Public best-sellers ranking for the catalog carousel.
-- sale_items is staff-only by RLS (it exposes sales detail), so the
-- public catalog cannot rank products by units sold on its own. This
-- view exposes ONLY the aggregate (product + units, real sales only:
-- Cotizacion excluded), never who bought or for how much.
CREATE OR REPLACE VIEW public.product_sales_ranking AS
SELECT si.product_id AS product_id, SUM(si.quantity) AS units_sold
FROM public.sale_items si
JOIN public.sales s ON s.id = si.sale_id
WHERE si.product_id IS NOT NULL AND s.status <> 'Cotizacion'
GROUP BY si.product_id;

GRANT SELECT ON public.product_sales_ranking TO anon, authenticated;
