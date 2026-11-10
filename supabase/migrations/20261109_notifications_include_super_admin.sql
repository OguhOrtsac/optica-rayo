-- Notification fan-outs must include the Super Admin.
-- notify_new_lens_request and check_upcoming_installments were written
-- before the super_admin role existed and enumerated only
-- ('owner','seller','dev'), so the Super Admin received NO staff
-- notifications at all (his notification bell rendered empty while the
-- owners had unread items). Same disease already cured in RLS
-- policies; the appointment trigger (20261109) already includes him.
-- Bodies are identical to the live definitions except the role lists.

CREATE OR REPLACE FUNCTION public.notify_new_lens_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    cust_profile RECORD;
    owner_profile RECORD;
BEGIN
    SELECT * INTO cust_profile FROM public.profiles WHERE id = NEW.customer_id;

    FOR owner_profile IN
        SELECT id FROM public.profiles WHERE role IN ('owner', 'seller', 'dev', 'super_admin')
    LOOP
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            owner_profile.id,
            'Nueva Solicitud de Lentes',
            'El cliente ' || cust_profile.full_name || ' ha diseñado y solicitado una cotización de lentes armados.',
            'lens_request'
        );
    END LOOP;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_upcoming_installments()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    inst RECORD;
    cust_profile RECORD;
    owner_profile RECORD;
BEGIN
    FOR inst IN
        SELECT pi.*, s.customer_id
        FROM public.payment_installments pi
        JOIN public.sales s ON pi.sale_id = s.id
        WHERE pi.status = 'pending'
          AND pi.due_date = (CURRENT_DATE + INTERVAL '3 days')::DATE
    LOOP
        -- Get customer profile
        SELECT * INTO cust_profile FROM public.profiles WHERE id = inst.customer_id;

        -- Notification to customer
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            inst.customer_id,
            'Recordatorio de Pago',
            'Hola ' || cust_profile.full_name || ', te recordamos que tu cuota #' || inst.installment_number || ' de $' || inst.amount || ' vence en 3 días (el ' || to_char(inst.due_date, 'DD/MM/YYYY') || ').',
            'payment_reminder'
        );

        -- Notification to staff
        FOR owner_profile IN
            SELECT id FROM public.profiles WHERE role IN ('owner', 'seller', 'dev', 'super_admin')
        LOOP
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                owner_profile.id,
                'Vencimiento de Cuota de Cliente',
                'El cliente ' || cust_profile.full_name || ' tiene la cuota #' || inst.installment_number || ' de $' || inst.amount || ' por vencer en 3 días (el ' || to_char(inst.due_date, 'DD/MM/YYYY') || ').',
                'payment_reminder'
            );
        END LOOP;
    END LOOP;
END;
$function$;
