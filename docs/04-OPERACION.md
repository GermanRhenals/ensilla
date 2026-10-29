# 04 · Operación

Guía para quien despliega, mantiene y hereda el sistema. Está escrita para que
otra persona pueda operar sin depender de quien lo construyó.

## Ambientes

| Ambiente | Frontend | Base de datos |
| --- | --- | --- |
| Local | `npm run dev` (3000) | Proyecto de Supabase de desarrollo |
| Producción | GitHub Pages | Proyecto de Supabase de producción |

Recomendación: usar **dos proyectos de Supabase** (desarrollo y producción).
Si se usa uno solo, los datos de prueba conviven con datos reales y el seed
puede pisar la operación.

## Configuración inicial de producción

### 1. Supabase

1. Crear el proyecto. Anotar la región y guardar la contraseña de la base.
2. En **Authentication > Sign In / Providers > Email**, desactivar
   **Allow new users to sign up** y activar **Confirm email**. El alta
   autoservicio crea la cuenta con la Edge Function `shop-signup`, no con el
   registro público, y exige confirmar el correo antes de entrar.
3. En **Authentication > URL Configuration**, definir el sitio de GitHub Pages
   como `Site URL` y agregarlo a `Redirect URLs`, junto con las rutas de
   recuperación y confirmación
   (`https://<sitio>/restablecer/`, `https://<sitio>/confirmar/`,
   `http://localhost:3000/restablecer/` y `http://localhost:3000/confirmar/`).
   Sin la barra final y sin esas entradas, los enlaces del correo no funcionan.
4. Aplicar las migraciones:

   ```bash
   npx supabase link --project-ref <ref-de-produccion>
   npx supabase db push
   ```

5. Desplegar las Edge Functions:

   ```bash
   npx supabase functions deploy admin-users
   npx supabase functions deploy send-reminder
   npx supabase functions deploy shop-signup
   ```

   Verificar que `admin-users` tenga `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY` en **Edge Functions > Secrets**. Supabase las
   inyecta por defecto; si el proyecto usa claves nuevas, confirmarlas.
   `shop-signup` también necesita la clave de servicio y las variables de correo
   del paso siguiente.

### 2. Correo transaccional (Brevo o Resend)

Hay dos caminos. Brevo sirve para operar sin dominio propio; Resend da mejor
remitente cuando ya hay uno verificado.

**Brevo, sin dominio**

1. Crear una cuenta en <https://www.brevo.com>.
2. En Settings > Senders, agregar el correo remitente y confirmar el código de
   seis dígitos que llega a esa casilla.
3. Crear una API key en Settings > SMTP & API > API Keys (empieza con
   `xkeysib-`; la de SMTP no sirve).
4. En Settings > Security > Authorised IPs, dejar **desactivado** el bloqueo de
   IPs desconocidas. Brevo lo activa solo a los 30 días y las Edge Functions
   salen por IPs que cambian en cada invocación: con el bloqueo prendido los
   envíos fallan con `401 unrecognised IP address`. Autorizar una IP no alcanza.
5. Configurar los secretos:

   ```bash
   npx supabase secrets set \
     BREVO_API_KEY=xkeysib-... \
     REMINDER_FROM_EMAIL=tu-correo@gmail.com \
     REMINDER_FROM_NAME="En-silla" \
     APP_BASE_URL=https://<usuario>.github.io/<repositorio>
   ```

   Brevo reescribe el remitente por uno de su dominio para cumplir con SPF y
   DMARC, así que el "De" no mostrará el dominio propio. El plan gratuito
   permite 300 correos por día.

**Resend, con dominio**

1. Crear una cuenta en <https://resend.com> y verificar el dominio desde el que
   se enviarán los recordatorios (registros DNS `SPF` y `DKIM`).
2. Crear una API key con permiso de envío.
3. Configurar `RESEND_API_KEY`, `REMINDER_FROM_EMAIL`, `REMINDER_FROM_NAME` y
   `APP_BASE_URL` con el mismo comando.

**En ambos casos**

1. Volver a desplegar `send-reminder` y `shop-signup` después de cambiar
   secretos.
2. Probar el envío con una reserva real de prueba desde la confirmación o desde
   el detalle de la cita en el panel, y con un alta completa desde `/registro`.

Sin `BREVO_API_KEY` ni `RESEND_API_KEY`, o sin `REMINDER_FROM_EMAIL`, el botón de
recordatorio responde que el envío todavía no está configurado. Las reservas
siguen funcionando. El alta autoservicio tampoco puede enviar el enlace de
confirmación. `APP_BASE_URL` debe incluir el `basePath` del despliegue; si falta,
la función intenta usar el `Origin` de la petición.

### 3. Primera barbería

La vía normal es el alta autoservicio en `/registro`: el dueño completa nombre
del local, responsable, correo y contraseña; recibe un enlace de confirmación;
al abrirlo se activa su cuenta y puede entrar al panel. La barbería nace oculta
(`published = false`) y se publica desde **Panel > Ajustes** cuando tiene al
menos un servicio activo, un día de atención y un integrante activo.

Para provisionar una barbería desde la operación (por ejemplo, una migración
asistida o una demo), sigue disponible el script con la clave de servicio:

```bash
npm run db:create-shop -- \
  --slug mi-barberia \
  --name "Mi Barbería" \
  --admin-name "Nombre Apellido" \
  --admin-email admin@mi-barberia.com \
  --admin-password "una-clave-larga"
```

El script:

- Crea la barbería ya publicada con agenda martes a sábado.
- Crea el primer administrador y lo deja activo.
- Imprime la ruta pública `/reservar?barberia=<slug>`.

Para cambiar datos de una barbería existente, repetir con `--update` y solo los
campos a modificar. Para una segunda barbería, ejecutar de nuevo con otro slug y
otro correo de administrador.

El seed `npm run db:seed:supabase` es solo para demostración: carga servicios,
clientes y turnos ficticios en la barbería `en-silla` y **no debe ejecutarse en
producción**.

### 4. GitHub

1. Subir el repositorio.
2. En **Settings > Secrets and variables > Actions**, crear:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. En **Settings > Pages**, elegir **Source: GitHub Actions**.
4. Hacer el primer push a `main`: el workflow **Deploy to GitHub Pages** se
   dispara solo. También se puede ejecutar a mano (`workflow_dispatch`) para
   republicar sin cambios.
5. Verificar la URL publicada y que `NEXT_PUBLIC_BASE_PATH` coincida con el
   nombre del repositorio (el workflow lo calcula solo).

### 5. Dominio propio (opcional)

Agregar un archivo `CNAME` en `public/` y configurar el DNS. Si se usa dominio
propio, el `basePath` debe quedar vacío: ajustar el workflow en ese caso.

## Despliegue del día a día

```text
push a main
  └─ CI: typecheck + lint + build
  └─ Deploy to GitHub Pages (en paralelo)
       └─ build con secretos reales
            └─ publica out/ en GitHub Pages
```

El despliegue se dispara con cada push a `main`. Por eso una migración se aplica
antes de mergear el código que la usa: el sitio se publica apenas entra el
commit. Para republicar sin cambios, ejecutar **Deploy to GitHub Pages** a mano.

### Rollback del frontend

1. Revertir el commit problemático en `main`: el workflow republica solo.
2. Si no se republicó, ejecutar **Deploy to GitHub Pages** a mano.
3. Si el problema es de datos, no alcanza con el rollback del frontend: seguir
   el procedimiento de base de datos.

### Rollback de la base de datos

Las migraciones no se revierten automáticamente. Procedimiento:

1. Identificar la migración y el efecto.
2. Escribir una migración nueva que deshaga el cambio de forma segura
   (`drop policy`, `alter table`, `grant`, etc.).
3. Probar en desarrollo con una copia de los datos.
4. Aplicar en producción con `npx supabase db push`.

Nunca borrar filas de `supabase_migrations.schema_migrations` para "volver
atrás": deja el esquema y el historial inconsistentes.

## Alta, baja y suspensión de barberías

| Operación | Cómo |
| --- | --- |
| Alta autoservicio | `/registro` + confirmación del correo; nace oculta |
| Alta asistida | `npm run db:create-shop` con un slug nuevo; nace publicada |
| Edición de datos | Panel > Ajustes del administrador, o script con `--update` |
| Publicación | Panel > Ajustes, o RPC `set_shop_published(true)`; exige servicio, horario y equipo |
| Ocultamiento | Panel > Ajustes, o `update shops set published = false where slug = '...'` |
| Suspensión temporal | `update shops set active = false where slug = '...'` |
| Reactivación | `update shops set active = true where slug = '...'` |
| Baja definitiva | No hay borrado desde el producto: la FK `restrict` protege el historial |

Una barbería inactiva deja de aparecer en la búsqueda y su equipo pierde acceso
a los datos, porque `current_shop_id()` exige un perfil activo de una barbería
activa en todas las políticas. Una barbería oculta (`published = false`) sigue
disponible para su equipo, pero no aparece en el buscador ni acepta reservas
públicas. La suspensión se aplica con la clave de servicio: `active` y
`published` no están entre las columnas que el panel escribe por `update`
directo. Para una baja real, exportar los datos y evaluar el borrado manual con
respaldo previo.

## Confirmación del alta autoservicio

1. El dueño completa `/registro`.
2. `shop-signup` crea la barbería oculta y el perfil pendiente, y envía el
   enlace por correo a `/confirmar/`.
3. Al abrir el enlace, `/confirmar/` procesa los tokens y activa el perfil.
4. El dueño entra al panel, completa servicio, horario y equipo, y publica.

Si el correo no llega:

1. Revisar spam y que la cuenta exista en `auth.users` con
   `profiles.pending_signup = true`.
2. Confirmar que `APP_BASE_URL` y `.../confirmar/` están bien configurados.
3. Revisar el límite de envíos de Supabase Auth y del proveedor de correo.
4. Pedir el reenvío desde `/registro` (acción `resend` de `shop-signup`). La
   respuesta es uniforme para no revelar si el correo existe.

Si el enlace ya se usó o venció, generar uno nuevo con el reenvío. Si la cuenta
quedó creada pero el perfil no se activó, revisar `profiles.active` y
`pending_signup` antes de intervenir a mano.

## Contraseñas olvidadas

El usuario entra a `/recuperar`, escribe el correo de su cuenta y recibe un
enlace de un solo uso que vence en una hora. `/restablecer` le permite elegir la
contraseña nueva y cierra la sesión de recuperación.

Si el correo no llega:

1. Revisar la carpeta de spam y que la cuenta exista en `auth.users`.
2. Confirmar que `.../restablecer/` está en Authentication > URL Configuration.
3. Revisar el límite de envíos de Supabase Auth. Para producción, configurar
   SMTP propio en **Authentication > Emails**.
4. Si el enlace ya se usó o venció, pedir uno nuevo desde `/recuperar`.

Un administrador también puede cambiar la contraseña de un miembro del equipo
desde el panel, sin pasar por el correo.

## Respaldos

| Qué | Cómo | Frecuencia |
| --- | --- | --- |
| Base de datos | Backup automático de Supabase (plan pago) | Diario, retención del plan |
| Base de datos | `pg_dump` por conexión directa | Semanal, guardar fuera del proveedor |
| Código | GitHub | Cada push |
| Secretos | Gestor de contraseñas del responsable | Al rotar |

Ejemplo de exportación manual:

```bash
pg_dump "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
  --no-owner --no-privileges -f respaldo-$(date +%F).sql
```

Probar una restauración al menos una vez al año en un proyecto vacío. Un
respaldo que nunca se restauró no es un respaldo.

## Monitoreo

Sin servidor propio, la vigilancia se concentra en cuatro lugares:

1. **GitHub Actions**: fallos de CI o del despliegue.
2. **Supabase > Reports / Logs**: errores de API, latencia, uso de base.
3. **Supabase > Auth**: inicios de sesión fallidos, cuentas nuevas.
4. **Brevo o Resend**: rebotes, quejas y estado de los envíos.

Señales de alerta:

- Aumento repentino de reservas con teléfonos distintos y nombres vacíos: spam.
- Errores 401/403 en el panel: sesión o perfil desactivado.
- Errores 500 en RPC: migración faltante o regla de negocio nueva.
- Recordatorios que no llegan: remitente sin verificar o secreto faltante.
- Aumento anormal de altas en borrador o de `shop_signup_attempts`: spam del
  formulario de registro.
- Crecimiento anormal de `notifications`: revisar si falta poda.

## Rutinas

### Diario

- Revisar la agenda del día y las notificaciones del panel.
- Confirmar que las reservas públicas entran correctamente en cada barbería
  activa.
- Revisar que los recordatorios enviados no tengan rebotes.

### Semanal

- Revisar turnos `PENDING` sin confirmar.
- Verificar que los servicios y precios de cada catálogo estén vigentes.
- Revisar accesos del equipo por barbería: altas, bajas y roles.
- Revisar el consumo y la reputación del remitente en el proveedor de correo.

### Mensual

- Exportar un respaldo y guardarlo fuera de Supabase.
- Revisar `auth.users` contra el plantel real de cada barbería.
- Revisar costos de Supabase, GitHub y del proveedor de correo.
- Actualizar dependencias menores y correr las tres verificaciones.

### Anual

- Restaurar un respaldo en un proyecto de prueba.
- Revisar este documento y el de seguridad.
- Rotar las claves de servicio y del proveedor de correo si hubo cambios de
  personal.
- Confirmar que al menos dos personas pueden administrar Supabase, GitHub y el
  proveedor de correo.

## Traspaso de la operación

Para que el sistema no dependa de una sola persona, entregar:

- [ ] Acceso al repositorio de GitHub (rol `Maintainer` como mínimo).
- [ ] Acceso al proyecto de Supabase (rol `Owner` o `Administrator`).
- [ ] Acceso a la cuenta del proveedor de correo (Brevo o Resend) y, si aplica,
      al DNS del dominio de envío.
- [ ] Acceso al correo asociado a las cuentas.
- [ ] Contraseña maestra del gestor de secretos.
- [ ] Este repositorio y la carpeta `docs/`.
- [ ] Una sesión de traspaso de 1 hora recorriendo: búsqueda pública, reserva,
      confirmación, recordatorio, agenda, alta de cita, alta de cliente, ajustes
      y despliegue.
- [ ] Contacto del proveedor o persona que da soporte técnico.

Verificación de que el traspaso funcionó: la persona nueva puede crear una
barbería de prueba, desplegar un cambio menor y revertirlo sin ayuda.

## Cuentas y accesos

| Sistema | Rol mínimo para operar | Rol para administrar |
| --- | --- | --- |
| Supabase | `Developer` (leer datos, ver logs) | `Owner`/`Administrator` |
| GitHub | `Write` (ramas y PR) | `Admin` (Pages, secrets) |
| Brevo o Resend | `Viewer` (ver envíos) | `Admin` (API keys, remitente) |
| Panel En-silla | `BARBER` de una barbería | `ADMIN` de una barbería |

El panel no reemplaza los permisos de Supabase: alguien con acceso al proyecto
puede leer todo por SQL. La seguridad de la operación incluye proteger esas
cuentas con doble factor.

## Costos esperados

- **GitHub Pages**: gratuito para repositorios públicos; límites de ancho de
  banda razonables para un marketplace pequeño.
- **GitHub Actions**: gratuito dentro del plan para este volumen.
- **Supabase**: el plan gratuito alcanza para desarrollo y para las primeras
  barberías. Producción con respaldos automáticos requiere plan pago.
- **Brevo**: el plan gratuito permite 300 correos por día y no exige dominio.
  **Resend**: el plan gratuito alcanza para pruebas y volumen bajo; un plan pago
  cubre más envíos y mejor soporte.
- No hay costos de servidor ni CDN adicional.

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| El panel redirige a `/login` en bucle | Perfil inactivo o inexistente | Revisar `profiles.active` y reactivar desde el panel o la Edge Function |
| No puedo entrar después del alta | El correo todavía no está confirmado o el perfil quedó inactivo | Abrir el enlace de `/confirmar/`; revisar `profiles.pending_signup` |
| "Solo un administrador puede ver esta sección" | Rol `BARBER` | Cambiar el rol con la Edge Function |
| "No encontramos esa barbería" | Slug inexistente, barbería inactiva o no publicada | Revisar `shops.slug`, `shops.active` y `shops.published` |
| La agenda no muestra horarios | Día cerrado, servicio inactivo o sin barberos activos | Revisar Ajustes, Servicios y Equipo de esa barbería |
| "Ese horario ya está ocupado" | Turno o bloqueo superpuesto | Elegir otro horario; revisar `time_off` |
| El sitio publicado da 404 | `NEXT_PUBLIC_BASE_PATH` incorrecto | Ajustar el workflow y volver a desplegar |
| Error al invocar `admin-users` | Función no desplegada o secreto faltante | `npx supabase functions deploy admin-users` |
| Error al invocar `shop-signup` | Función no desplegada o secreto faltante | `npx supabase functions deploy shop-signup` y revisar secretos |
| El alta responde "no se pudo crear" | Correo ya usado, rate limit o fallo del proveedor | Revisar `profiles.email`, `shop_signup_attempts` y el panel del proveedor |
| No se puede publicar la barbería | Falta servicio, horario o integrante activo | Completar el checklist de Panel > Ajustes |
| El enlace de confirmación vuelve a la portada | Falta la URL en Redirect URLs | Agregar `<sitio>/confirmar/` en Authentication > URL Configuration |
| "El envío de correos todavía no está configurado" | Faltan secretos del proveedor | Configurar `BREVO_API_KEY` o `RESEND_API_KEY`, más `REMINDER_FROM_EMAIL` |
| El recordatorio no llega | Remitente sin verificar, rebote o correo inválido | Revisar el panel del proveedor y la ficha del cliente |
| El enlace de recuperación vuelve a la portada | Falta la URL en Redirect URLs | Agregar `<sitio>/restablecer/` en Authentication > URL Configuration |
| No llega el correo de recuperación | SMTP incluido con límites, spam o cuenta inexistente | Configurar SMTP propio y revisar la carpeta de spam |
| Un usuario ve datos de otra barbería | `profiles.shop_id` incorrecto | Corregir el perfil con la clave de servicio y revisar políticas |
| Reservas públicas rechazadas por teléfono | Límite anti-abuso (3 por hora) | Esperar o registrar el turno desde el panel |

## Registro de cambios operativos

Agregar una línea por cada intervención en producción. Sirve para el traspaso y
para entender decisiones pasadas.

| Fecha | Cambio | Responsable | Verificación |
| --- | --- | --- | --- |
| 2026-10-28 | Endurecimiento de RLS, privilegios por columna y anti-abuso | — | `npm run smoke:supabase` |
| 2026-10-29 | Marketplace multi-barbería, búsqueda pública y recordatorios con Resend | — | `npm run smoke:supabase` |
| 2026-10-29 | Alta autoservicio de barberías, publicación con checklist y confirmación por correo | — | `npm run build` + alta manual |
|  |  |  |  |
