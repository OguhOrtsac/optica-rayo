-- Migración: el registro de envíos admite el aviso de «pedido listo»
-- (dictado del dueño, 2026-11-19).
--
-- `message_send_log` nació (20261119_notification_independence) con el
-- CHECK `kind IN ('birthday', 'payment_reminder')`. La pantalla nueva
-- «Pedidos en proceso» registra además el aviso de WhatsApp «ya está
-- listo» al tocar su botón, con kind 'order_ready' y el sale_id del
-- pedido, para pintar el sello «Cliente avisado por …». Esta migración
-- amplía el CHECK a los tres tipos; nada más cambia (la tabla, sus
-- índices y sus políticas RLS quedan como están).
--
-- El nombre del constraint es el que Postgres generó para el CHECK en
-- línea de la creación: message_send_log_kind_check. Se retira con
-- IF EXISTS y se recrea con el mismo nombre y la lista ampliada.

ALTER TABLE public.message_send_log
  DROP CONSTRAINT IF EXISTS message_send_log_kind_check;

ALTER TABLE public.message_send_log
  ADD CONSTRAINT message_send_log_kind_check
  CHECK (kind IN ('birthday', 'payment_reminder', 'order_ready'));

COMMENT ON TABLE public.message_send_log IS
  'Registro de envíos de WhatsApp hechos por el personal (felicitaciones de cumpleaños, recordatorios de cobro y avisos de pedido listo): quién lo mandó, a qué cliente, de qué venta si aplica y cuándo. Alimenta el sello «ya enviado por …».';
