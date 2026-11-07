# Configurar el panel privado de Rosa

El catálogo puede ser público, pero publicar y administrar productos requiere la cuenta de Rosa. El panel usa Supabase Auth, una lista privada con la única cuenta autorizada, reglas RLS en la base de datos y almacenamiento público solo para servir los archivos publicados. Las imágenes y los videos no se guardan en el navegador.

El esquema y la autorización del correo ya están configurados en el proyecto Supabase conectado de Rosabel. Esta guía sirve como referencia para el siguiente paso del proyecto o para volver a preparar otro entorno.

## Preparar la cuenta

1. En **Authentication → URL Configuration**, añade `https://leonardochaponan3011-gif.github.io/ROSABEL/` a **Redirect URLs** para que el enlace de correo vuelva a Rosabel.
2. En **SQL Editor**, ejecuta el contenido de `supabase/setup.sql`.
3. En el mismo SQL Editor, autoriza solo el correo de Rosa (reemplaza el texto entre comillas):

   ```sql
   insert into private.rosabel_owner_emails (email)
   values (lower('CORREO_DE_ROSA'))
   on conflict do nothing;
   ```

4. En **Project Settings → API**, copia la **Project URL** y la clave **publishable** (o la clave pública `anon` heredada). Colócalas en `rosabel-config.js`. El correo de Rosa queda en la tabla privada de Supabase, no en el código público. Estas credenciales públicas no sustituyen las reglas RLS. **No uses ni publiques una clave `secret` o `service_role`.**
5. Guarda `rosabel-config.js` y publica de nuevo la página. Rosa entra desde **Acceso de Rosa** con un enlace de acceso seguro enviado a su correo; no necesita guardar una contraseña en esta web.

## Qué podrá hacer Rosa

- Publicar, editar y retirar sus productos. Cada publicación incluye una foto principal, fotos adicionales, un video de hasta 60 segundos y variantes de diseño/color con su foto propia y precio opcional.
- Ver el producto como una galería: miniaturas a un lado en pantallas grandes, miniaturas desplazables en celulares y controles de reproducción para el video.
- Las clientas eligen una variante desde el detalle del producto y luego hacen su pedido por WhatsApp.

Los videos aceptados son MP4 o WebM, de hasta 25 MB y 60 segundos. Las fotos admiten JPG, PNG o WebP, de hasta 8 MB cada una.

## Acceso exclusivo

Las reglas RLS de `supabase/setup.sql` verifican el correo autorizado desde la base de datos y el almacenamiento. Aunque otra persona abra o modifique la interfaz, no podrá publicar sin iniciar sesión con el correo permitido. La clave pública del navegador nunca debe tener permisos de `service_role`.
