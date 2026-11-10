-- Low-stock alerts in the staff notification bell.
-- 1) notifications.type learns 'low_stock'.
-- 2) The threshold lives in app_settings ('low_stock_threshold',
--    default 5): staff alert when a product's stock reaches it.
-- 3) A trigger on products fires ONCE per crossing (from above the
--    threshold to at/below it), plus when a product is created already
--    at/below it. Recipients: the full staff list INCLUDING super_admin
--    (the fixed enumeration — see 20261109_notifications_include_super_admin).

ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_type_check,
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('general', 'payment_reminder', 'lens_request', 'appointment', 'low_stock'));

INSERT INTO public.app_settings (key, value)
VALUES ('low_stock_threshold', '5')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.low_stock_threshold()
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COALESCE(
    (SELECT NULLIF(value, '')::int FROM public.app_settings WHERE key = 'low_stock_threshold'),
    5
  )
$function$;

CREATE OR REPLACE FUNCTION public.notify_low_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    threshold INT := public.low_stock_threshold();
    staff_profile RECORD;
BEGIN
    IF NEW.stock IS NULL OR NEW.stock > threshold THEN
        RETURN NEW;
    END IF;
    -- Fire only on the crossing (or on creation already low), never on
    -- every later change while the product stays low.
    IF TG_OP = 'UPDATE' AND OLD.stock IS NOT NULL AND OLD.stock <= threshold THEN
        RETURN NEW;
    END IF;

    FOR staff_profile IN
        SELECT id FROM public.profiles
        WHERE role IN ('owner', 'seller', 'dev', 'super_admin')
    LOOP
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            staff_profile.id,
            'Stock bajo',
            'Quedan ' || NEW.stock || ' piezas de «' || NEW.name ||
              '» (aviso al llegar a ' || threshold || '). Conviene resurtir.',
            'low_stock'
        );
    END LOOP;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_low_stock ON public.products;
CREATE TRIGGER trg_notify_low_stock
AFTER INSERT OR UPDATE OF stock ON public.products
FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();
