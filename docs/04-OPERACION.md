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
   **Allow new users to sign up**. Las cuentas las crea un administrador.
3. En **Authentication > URL Configuration**, definir el sitio de GitHub Pages
   como `Site URL` y agregarlo a `Redirect URLs`.
4. Aplicar las migraciones:

   ```bash
   npx supabase link --project-ref <ref-de-produccion>
   npx supabase db push
   ```

5. Desplegar la Edge Function:

   ```bash
   npx supabase functions deploy admin-users --project-ref <ref-de-produccion>
   ```

   Verificar que tenga `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY` en **Edge Functions > Secrets**. Supabase las
   inyecta por defecto; si el proyecto usa claves nuevas, confirmarlas.

6. Crear el primer administrador:

   ```bash
   SUPABASE_SERVICE_ROLE_KEY=... node --env-file=.env scripts/seed-supabase.mjs
   ```

   El seed crea las cuentas demo. En producción conviene cambiar la contraseña
   del administrador y borrar los barberos de ejemplo, o crear la cuenta desde
   el panel y no ejecutar el seed.

### 2. GitHub

1. Subir el repositorio.
2. En **Settings > Secrets and variables > Actions**, crear:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. En **Settings > Pages**, elegir **Source: GitHub Actions**.
4. Ejecutar el workflow **Deploy to GitHub Pages** (`workflow_dispatch`).
5. Verificar la URL publicada y que `NEXT_PUBLIC_BASE_PATH` coincida con el
   nombre del repositorio (el workflow lo calcula solo).

### 3. Dominio propio (opcional)

Agregar un archivo `CNAME` en `public/` y configurar el DNS. Si se usa dominio
propio, el `basePath` debe quedar vacío: ajustar el workflow en ese caso.

## Despliegue del día a día

```text
push a main
  └─ CI: typecheck + lint + build
       └─ si pasa, una persona ejecuta Deploy to GitHub Pages
            └─ build con secretos reales
                 └─ publica out/ en GitHub Pages
```

El despliegue es manual a propósito: permite revisar qué se publica. El CI no
despliega nada.

### Rollback del frontend

1. Revertir el commit problemático en `main`.
2. Ejecutar de nuevo **Deploy to GitHub Pages**.
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

Sin servidor propio, la vigilancia se concentra en tres lugares:

1. **GitHub Actions**: fallos de CI o del despliegue.
2. **Supabase > Reports / Logs**: errores de API, latencia, uso de base.
3. **Supabase > Auth**: inicios de sesión fallidos, cuentas nuevas.

Señales de alerta:

- Aumento repentino de reservas con teléfonos distintos y nombres vacíos: spam.
- Errores 401/403 en el panel: sesión o perfil desactivado.
- Errores 500 en RPC: migración faltante o regla de negocio nueva.
- Crecimiento anormal de `notifications`: revisar si falta poda.

## Rutinas

### Diario

- Revisar la agenda del día y las notificaciones del panel.
- Confirmar que las reservas públicas entran correctamente.

### Semanal

- Revisar turnos `PENDING` sin confirmar.
- Verificar que los servicios y precios del catálogo estén vigentes.
- Revisar accesos del equipo: altas, bajas y roles.

### Mensual

- Exportar un respaldo y guardarlo fuera de Supabase.
- Revisar `auth.users` contra el plantel real.
- Revisar costos de Supabase y GitHub.
- Actualizar dependencias menores y correr las tres verificaciones.

### Anual

- Restaurar un respaldo en un proyecto de prueba.
- Revisar este documento y el de seguridad.
- Rotar la clave de servicio si hubo cambios de personal.
- Confirmar que al menos dos personas pueden administrar Supabase y GitHub.

## Traspaso de la operación

Para que el sistema no dependa de una sola persona, entregar:

- [ ] Acceso al repositorio de GitHub (rol `Maintainer` como mínimo).
- [ ] Acceso al proyecto de Supabase (rol `Owner` o `Administrator`).
- [ ] Acceso al correo asociado a ambas cuentas.
- [ ] Contraseña maestra del gestor de secretos.
- [ ] Este repositorio y la carpeta `docs/`.
- [ ] Una sesión de traspaso de 1 hora recorriendo: login, agenda, alta de
      cita, alta de cliente, ajustes y despliegue.
- [ ] Contacto del proveedor o persona que da soporte técnico.

Verificación de que el traspaso funcionó: la persona nueva puede desplegar un
cambio menor y revertirlo sin ayuda.

## Cuentas y accesos

| Sistema | Rol mínimo para operar | Rol para administrar |
| --- | --- | --- |
| Supabase | `Developer` (leer datos, ver logs) | `Owner`/`Administrator` |
| GitHub | `Write` (ramas y PR) | `Admin` (Pages, secrets) |
| Panel En-silla | `BARBER` | `ADMIN` |

El panel no reemplaza los permisos de Supabase: alguien con acceso al proyecto
puede leer todo por SQL. La seguridad de la operación incluye proteger esas
cuentas con doble factor.

## Costos esperados

- **GitHub Pages**: gratuito para repositorios públicos; límites de ancho de
  banda razonables para una barbería.
- **GitHub Actions**: gratuito dentro del plan para este volumen.
- **Supabase**: el plan gratuito alcanza para desarrollo y para una barbería
  pequeña. Producción con respaldos automáticos requiere plan pago.
- No hay costos de servidor, CDN adicional ni servicios de correo/SMS.

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| El panel redirige a `/login` en bucle | Perfil inactivo o inexistente | Revisar `profiles.active` y reactivar desde el panel o la Edge Function |
| "Solo un administrador puede ver esta sección" | Rol `BARBER` | Cambiar el rol con la Edge Function |
| La agenda no muestra horarios | Día cerrado, servicio inactivo o sin barberos activos | Revisar Ajustes, Servicios y Equipo |
| "Ese horario ya está ocupado" | Turno o bloqueo superpuesto | Elegir otro horario; revisar `time_off` |
| El sitio publicado da 404 | `NEXT_PUBLIC_BASE_PATH` incorrecto | Ajustar el workflow y volver a desplegar |
| Error al invocar `admin-users` | Función no desplegada o secreto faltante | `npx supabase functions deploy admin-users` |
| Reservas públicas rechazadas por teléfono | Límite anti-abuso (3 por hora) | Esperar o registrar el turno desde el panel |

## Registro de cambios operativos

Agregar una línea por cada intervención en producción. Sirve para el traspaso y
para entender decisiones pasadas.

| Fecha | Cambio | Responsable | Verificación |
| --- | --- | --- | --- |
| 2026-10-28 | Endurecimiento de RLS, privilegios por columna y anti-abuso | — | `npm run smoke:supabase` |
|  |  |  |  |
