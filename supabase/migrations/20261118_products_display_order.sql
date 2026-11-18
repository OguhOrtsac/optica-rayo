-- Migration: Orden de exhibición del catálogo (products.display_order)
-- Date: 2026-11-18
--
-- Dictado del dueño (2026-11-18): el administrador / superadministrador
-- puede ARRASTRAR las tarjetas del catálogo público para reordenarlas,
-- y el orden guardado es el que ven los clientes. Hasta hoy el
-- catálogo salía ordenado por nombre (getProducts en lib/services.ts)
-- y no había forma de acomodarlo a mano.
--
-- Semántica:
--  * display_order = posición del producto en el catálogo (1 = primero).
--  * NULL = sin posición asignada: el servicio manda esos productos al
--    final y desempata por nombre, así que un producto recién creado
--    nunca rompe el orden guardado (aparece al final hasta que el
--    administrador lo acomode arrastrando).
--  * El relleno inicial numera por NOMBRE ascendente — exactamente el
--    orden que el catálogo ya mostraba — para que aplicar esta
--    migración no mueva nada visible. Solo rellena filas con
--    display_order NULL y continúa después del máximo ya asignado:
--    si la migración se corre otra vez, el orden guardado por el
--    administrador NO se pisa.
--
-- Escritura: saveProductsOrder() en lib/services.ts verifica el rol
-- del solicitante contra su fila de profiles (solo super_admin /
-- owner; 'dev' es el alias heredado de super_admin) antes de
-- escribir, y la política «Allow catalog managers to manage
-- products» ya limita el UPDATE de products a esos mismos roles.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS display_order INTEGER;

WITH base AS (
    SELECT COALESCE(MAX(display_order), 0) AS current_max
    FROM public.products
),
ranked AS (
    SELECT
        p.id,
        (SELECT current_max FROM base) + ROW_NUMBER() OVER (ORDER BY p.name ASC) AS rn
    FROM public.products p
    WHERE p.display_order IS NULL
)
UPDATE public.products p
SET display_order = ranked.rn
FROM ranked
WHERE p.id = ranked.id;
