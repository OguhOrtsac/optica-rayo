# Roles y permisos de Óptica Rayo

Este documento es la definición oficial de perfiles. El código comparte la misma definición en `lib/roles.ts`.

| Perfil | Quién es | Puede hacer | No puede hacer |
|---|---|---|---|
| **Super Administrador** (`super_admin`) | Equipo desarrollador de la plataforma | Mantener la aplicación, crear cuentas privilegiadas, apoyar en configuración y corregir incidencias | Operar como si fuera el negocio en el día a día |
| **Administrador / Dueño** (`owner`) | Dueño o responsable de la óptica | Personal operativo, catálogo, precios, promociones, finanzas, clientes, exámenes y recordatorios | Crear otro Super Administrador |
| **Optometrista** (`optometrist`) | Personal clínico | Expedientes, exámenes, graduaciones, historial clínico y seguimiento de revisiones | Finanzas, cuentas de personal, precios ni configuración del negocio |
| **Vendedor POS / Cajero** (`seller`) | Personal de mostrador | Ventas, abonos, alta y consulta de clientes, consulta de inventario y recordatorios operativos | Cambiar el catálogo maestro, finanzas globales ni cuentas |
| **Cliente / Paciente** (`customer`) | Persona registrada | Su perfil, compras, recetas, favoritos, promociones y precios de cliente | Ver datos de otras personas o información interna |
| **Invitado** (`guest`) | Visitante sin sesión | Catálogo público y consulta por WhatsApp | Precios de cliente, favoritos persistentes y cualquier dato interno |

## Reglas de aplicación

- `dev` es un valor heredado y se interpreta como `super_admin`; no se usa para cuentas nuevas.
- El Optometrista ya no se mezcla con Desarrollador.
- Una persona tiene un rol principal. Si el dueño también atiende como optometrista, eso se registra en sus funciones clínicas, no duplicando permisos administrativos en otra cuenta.
- El catálogo público es de lectura para invitados y clientes. La administración del catálogo corresponde a Dueño y Super Administrador.
- Los precios de cliente solo aparecen con sesión de Cliente.
- La definición de permisos de interfaz vive en `ROLE_DEFINITIONS` y `canAccess` dentro de `lib/roles.ts`.
