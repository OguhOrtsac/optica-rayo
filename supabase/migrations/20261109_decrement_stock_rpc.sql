-- ============================================================
-- RPC decrement_stock: descuento atómico de inventario
-- ------------------------------------------------------------
-- createLinkedSaleAction (app/customers/actions.ts) ya llamaba
--   .rpc('decrement_stock', { product_id, qty })
-- en cada venta ligada, pero la función nunca se creó en la base:
-- cada llamada fallaba y el código caía a una actualización manual
-- (leer stock -> restar -> guardar) que (a) no era atómica — dos
-- ventas simultáneas del mismo armazón podían pisarse — y (b) ni
-- siquiera revisaba el error de su propio UPDATE.
--
-- Semántica elegida: resta `qty` con piso en 0 (greatest(stock-qty,0)).
-- Se prefiere el piso a bloquear la operación cuando stock < qty por
-- dos razones:
--   1. products.stock tiene CHECK (stock >= 0): un decremento sin piso
--      violaría el constraint y la venta quedaría sin descuento alguno.
--   2. La app no impide vender sin existencias (ni el POS ni la venta
--      ligada validan disponibilidad antes de cobrar), igual que el
--      descuento manual del POS, que ya usa Math.max(0, stock - qty).
--      Bloquear aquí dejaría ventas ya cobradas sin su decremento.
-- El piso mantiene el stock sano (>= 0) y la operación nunca falla por
-- existencias; el faltante queda visible como stock en 0.
--
-- SECURITY INVOKER (el modo por defecto): el RPC hereda exactamente
-- los permisos/RLS del usuario que lo invoca — los mismos con los que
-- ya corría la actualización manual — sin ampliar privilegios.
-- Devuelve el stock resultante (NULL si el producto no existe).
-- ============================================================

CREATE OR REPLACE FUNCTION public.decrement_stock(product_id uuid, qty integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_stock integer;
BEGIN
  IF qty IS NULL OR qty <= 0 THEN
    SELECT stock INTO new_stock FROM public.products WHERE id = product_id;
    RETURN new_stock;
  END IF;

  UPDATE public.products
  SET stock = GREATEST(stock - qty, 0)
  WHERE id = product_id
  RETURNING stock INTO new_stock;

  RETURN new_stock;
END;
$$;

-- La venta ligada la invoca el personal con sesión real (authenticated);
-- service_role por si algún proceso de servidor la usa en el futuro.
-- No se otorga a anon: nadie sin sesión debe poder mover inventario.
GRANT EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) TO authenticated, service_role;

-- PostgREST cachea el esquema: pedirle que lo recargue para que el RPC
-- quede visible sin esperar al siguiente reinicio.
NOTIFY pgrst, 'reload schema';
