-- Migration: Appointments — nuevo estatus 'completed' («Realizada»)
-- Date: 2026-11-19
--
-- Pedido del dueño: en la Agenda del staff, cada cita activa lleva un
-- botón «Realizada» que la marca como atendida. Eso exige un cuarto
-- estatus además de pending/confirmed/cancelled (el CHECK original de
-- 20261109_appointments.sql solo admite esos tres).
--
-- Aditiva y segura: solo se amplía el CHECK de `appointments.status`.
-- No se tocan datos ni el índice anti doble reserva: una cita realizada
-- SIGUE ocupando su horario (el examen sí ocurrió a esa hora), igual
-- que una confirmada; solo las canceladas liberan el horario.
--
-- Hasta que esta migración se aplique, marcar «Realizada» en producción
-- devolverá el error real del CHECK (la pantalla lo muestra tal cual);
-- en modo demo (sin base) el flujo funciona sin esta migración.

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed'));
