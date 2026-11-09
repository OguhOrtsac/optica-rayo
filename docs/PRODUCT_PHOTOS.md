# Fotos y ficha de producto

## Formato aceptado

- Formatos: **JPG, PNG, WebP o AVIF**.
- Peso máximo: **5 MB por foto**.
- Tamaño recomendado: **1600 × 1200 px**, horizontal 4:3.
- Tamaño mínimo útil: **800 × 600 px**; la aplicación avisa si la foto es más chica.
- Cantidad: **1 foto principal + hasta 5 de galería**.
- Fondo recomendado: claro y limpio, armazón completo y sin dedos, etiquetas ni reflejos fuertes.

## Cómo se guarda

- Las fotos binarias van al bucket público de Supabase Storage **`product-images`**.
- En `products`, la foto principal se guarda en `image_url` y la galería ordenada en `gallery_urls`.
- La base no guarda la imagen como texto base64 en operación real; base64 es solo el respaldo local de demostración cuando Supabase no está conectado.
- `image_alt` guarda un texto alternativo breve para accesibilidad y buscadores.

## Campos que llena el administrador

Obligatorios: nombre, SKU, categoría, precio y stock inicial.

Para que el catálogo ayude a vender: marca, material, color, forma del armazón, descripción visible, foto principal y galería.

Opcionales comerciales: precio especial de cliente, promoción y destacado.

La forma del armazón se selecciona de una lista (`round`, `square`, `rectangular`, `aviator`, `cat_eye`, `oval`, `other`). Ya no se adivina desde el nombre para productos nuevos.
