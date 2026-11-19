# Estado del proyecto — Óptica Rayo

**Última actualización: 2026-11-19 (cierre del día).**
Producción: https://optica-rayo.vercel.app — despliega desde `master`.
Rama de trabajo: `fase-a-cimientos` (mismo contenido que `master` al cierre).

Este archivo es la foto del proyecto al momento del commit: qué incluye la
app, qué quedó verificado y qué sigue pendiente. El detalle por tanda vive
en el plan de trabajo del proyecto (fuera del repo).

## Qué incluye la app hoy

- **Catálogo público** con filtros en una sola tarjeta (categoría, marca
  multiselección, forma de rostro), reordenable arrastrando (solo admin),
  escáner de rostro (MediaPipe, en el dispositivo) y aviso de cliente
  descartable. Paquete nativo iPhone (splashes, áreas seguras).
- **Clientes**: alta completa y registros rápidos (POS, Agenda, examen)
  con selector de prefijo telefónico (+52 sin el «1» por default, +1 u
  otro) y normalizador único para los enlaces de WhatsApp. Ficha con
  pestañas Datos · Clínica · Ventas · Cobranza y botón «Actualizar datos».
- **Exámenes**: formato de historia clínica real de la óptica
  (`clinical_exams.clinical_history`), responsable clínico y folio en el
  encabezado; la graduación NUNCA viaja al navegador del cliente (solo ve
  fechas y recomendaciones).
- **Agenda**: citas con anti doble reserva, horario por día configurable,
  botón «Realizada» (estatus `completed`, solo admin) y «Realizar examen»
  con el cliente precargado. Avisos de citas de hoy en la campanita, sin
  duplicados.
- **Ventas (POS)**: complementos libres por producto, descuento manual
  (% o precio final) excluyente con el cupón, cupones con límite de usos
  opcional, buscador de cliente estilo Agenda, **plan de pagos al vender**
  (número libre; semanal/quincenal/mensual; solo con cliente registrado),
  resumen tipo nota sin desglose de IVA, y **ticket como imagen** (PNG)
  con envío por WhatsApp (imagen + texto por la hoja de compartir; el
  chat directo lleva el texto). La plantilla del ticket es editable en
  Mensajes.
- **Cobranza**: abonos sobre saldo, **reestructuración de pagos** (solo
  administrador, con recargo opcional e historial estructurado en
  `sale_refinancings`), recordatorios por WhatsApp.
- **Finanzas y Reportes**: gastos del día y fijos en modelo de caja (el
  fijo cuenta solo cuando se registra su pago; sin prorrateos), rangos de
  fechas, utilidad del periodo.
- **Roles con menús propios y rutas con puerta de servidor**: super_admin
  y owner (paridad salvo Usuarios, donde el owner no ve cuentas
  super_admin), optometrista (solo mundo clínico, sin dinero ni pestaña
  Cobranza), vendedor (ventas, abonos, clientes, alta de productos y
  precios sin borrar ni reordenar; «Realizada» no), cliente (lo suyo,
  con campanita propia) e invitado.
- **Notificaciones**: campanita con avisos por usuario (cada quien borra
  y marca solo los suyos); cumpleaños con descarte personal y sello
  «Felicitación ya enviada por {nombre}»; registro de envíos
  (`message_send_log`) también para recordatorios de cobro.
- **Mensajes**: las plantillas de WhatsApp editables (incluida la del
  ticket) y la configuración de recordatorios de revisión a 6 meses.

## Verificación (2026-11-19)

- Tres tandas subidas y verificadas en producción el mismo día
  (verificación punto por punto contra la base real, con limpieza de los
  datos de prueba): tanda de historia clínica/roles/caja, tanda de
  prefijo/plan/reestructuración/cupones y tanda de ticket/notificaciones.
- Suites locales: regresión 41/41 y lógica 17/17; `tsc --noEmit` limpio;
  build de producción OK.
- Todas las migraciones del día aplicadas y verificadas en Supabase:
  `clinical_history`, `appointments completed`,
  `20261119_products_seller_access`, `20261119_coupons_max_uses`,
  `20261119_sale_refinancings`, `20261119_notification_independence`.

## Pendientes conocidos

- Sesiones reales de vendedor y optometrista por probar en producción
  (aún no existen cuentas con esos roles).
- Inventario como módulo propio (página, entradas/ajustes con motivo e
  historial de movimientos): analizado, esperando visto bueno de diseño.
- Datos reales por cargar (clientes, inventario, datos de la óptica y
  WhatsApp del negocio): hoy la base trae datos demo + un cliente de
  prueba del dueño («Prueba WhatsApp») para calar los botones.
- Reconectar la llave del conector de Supabase (la guardada devuelve 401;
  las operaciones SQL se hacen por el panel web).
