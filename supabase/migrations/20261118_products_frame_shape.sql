-- Migration: Forma del armazón (products.frame_shape) — escáner de rostro
-- Date: 2026-11-18
--
-- Dictado del dueño (2026-11-18): el catálogo gana un ESCÁNER DE
-- ROSTRO que detecta la forma de la cara del cliente (en su propio
-- teléfono, sin subir la foto) y le sugiere armazones del catálogo
-- según la forma guardada de cada producto.
--
-- ⚠️ ESTADO REAL DE LA BASE (verificado en el repo): la columna
-- products.frame_shape YA EXISTE — la creó la migración
-- 20261109_roles_and_product_media.sql como TEXT con CHECK de
-- vocabulario EN INGLÉS:
--   frame_shape IS NULL OR frame_shape IN
--     ('round', 'square', 'rectangular', 'aviator', 'cat_eye',
--      'oval', 'other')
-- y ya hay filas reales etiquetadas con esos valores, el formulario
-- del admin ya la captura («Forma del armazón») y los tipos de la
-- app ya la exponen.
--
-- Por eso esta migración NO redefine la columna ni su CHECK: un
-- CHECK nuevo con vocabulario en español RECHAZARÍA las filas ya
-- etiquetadas en inglés y rompería la base al aplicarse. El
-- vocabulario español de la recomendación ('rectangular',
-- 'cuadrado', 'redondo', 'ovalado', 'aviador', 'ojo_de_gato') vive
-- en la capa de lógica (lib/face-shape.ts) y se traduce al
-- vocabulario de la base en UN solo lugar:
-- PRODUCT_FRAME_SHAPE_VALUE de ese mismo archivo.
--
-- Lo único ejecutable aquí es el ADD COLUMN idempotente, por si
-- esta migración llegara a una base donde la de 20261109 no se
-- hubiera aplicado: en ese caso la columna nace SIN el check (la
-- app tolera cualquier valor y el admin solo ofrece los válidos).

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS frame_shape TEXT;

COMMENT ON COLUMN public.products.frame_shape IS
    'Forma del armazón para la guía por forma de rostro. Valores: round, square, rectangular, aviator, cat_eye, oval, other (vocabulario fijado en 20261109). La recomendación del escáner (lib/face-shape.ts) traduce su vocabulario en español a estos valores.';
