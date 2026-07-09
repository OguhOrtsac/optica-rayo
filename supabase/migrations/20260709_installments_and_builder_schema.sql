-- Migration: Installment Payments, Notifications and Lens Builder Requests
-- Date: 2026-07-09

-- ============================================================
-- 1. PAYMENT INSTALLMENTS (Cuotas de pago a plazos)
-- ============================================================
CREATE TABLE public.payment_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    payment_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 2. NOTIFICATIONS (Alertas y avisos en el sistema)
-- ============================================================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'payment_reminder', 'lens_request')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 3. LENS BUILDER REQUESTS (Solicitudes de clientes para armar lentes)
-- ============================================================
CREATE TABLE public.lens_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    frame_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    lens_material_id UUID REFERENCES public.lens_materials(id) ON DELETE SET NULL,
    treatment_ids UUID[] DEFAULT '{}'::UUID[],
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'completed')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 4. ENABLE RLS
-- ============================================================
ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lens_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

-- Payment Installments Policies
CREATE POLICY "Customers can read their own installments"
    ON public.payment_installments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = payment_installments.sale_id
            AND s.customer_id = auth.uid()
        )
    );

CREATE POLICY "Staff can view and manage all installments"
    ON public.payment_installments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

-- Notifications Policies
CREATE POLICY "Users can view and manage their own notifications"
    ON public.notifications FOR ALL
    USING (auth.uid() = user_id);

-- Lens Requests Policies
CREATE POLICY "Customers can read and insert their own requests"
    ON public.lens_requests FOR SELECT
    USING (auth.uid() = customer_id);

CREATE POLICY "Customers can insert their own requests"
    ON public.lens_requests FOR INSERT
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Staff can view and manage all lens requests"
    ON public.lens_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner', 'seller', 'dev')
        )
    );

-- ============================================================
-- 6. AUTOMATED NOTIFICATIONS LOGIC
-- ============================================================

-- Function: Check upcoming installments and insert notifications (runs 3 days before due date)
CREATE OR REPLACE FUNCTION public.check_upcoming_installments()
RETURNS void AS $$
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
            SELECT id FROM public.profiles WHERE role IN ('owner', 'seller', 'dev')
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function & Trigger: Notify staff of new lensRequests
CREATE OR REPLACE FUNCTION public.notify_new_lens_request()
RETURNS TRIGGER AS $$
DECLARE
    cust_profile RECORD;
    owner_profile RECORD;
BEGIN
    SELECT * INTO cust_profile FROM public.profiles WHERE id = NEW.customer_id;
    
    FOR owner_profile IN 
        SELECT id FROM public.profiles WHERE role IN ('owner', 'seller', 'dev')
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_lens_request_created
    AFTER INSERT ON public.lens_requests
    FOR EACH ROW EXECUTE FUNCTION public.notify_new_lens_request();
