# 05 · Desarrollo

Guía para cambiar el código sin romper reglas de negocio ni la seguridad.

## Preparación

```bash
npm install
cp .env.example .env      # completar claves
npm run dev
```

Antes de abrir un pull request:

```bash
npm run typecheck
npm run lint
npm run build
```

Si el cambio toca base de datos, además:

```bash
npx supabase db push      # contra el proyecto de desarrollo
npm run smoke:supabase    # contra el proyecto de desarrollo
```

## Estructura mental

- **Página**: compone la pantalla, maneja estado de formulario y navegación.
- **Módulo de datos**: habla con Supabase, devuelve tipos del dominio.
- **Módulo de dominio**: reglas sin acceso directo a la base (agenda, stats,
  fechas, formato).
- **Migración**: reglas que deben cumplirse aunque alguien llame a la API por
  fuera de la aplicación.

## Reglas para la capa de datos

1. Toda consulta a tablas vive en `src/lib/data/`.
2. Toda función pública se exporta desde `src/lib/data/index.ts`.
3. Las respuestas de Supabase son `unknown`: normalizarlas con `text`,
   `numberValue`, `boolValue`, `nullableText` (`rows.ts`).
4. Mapear `snake_case` a `camelCase` en `mappers.ts`.
5. Convertir errores con `fail(error)`; para errores de negocio conocidos
   (por ejemplo, teléfono duplicado, código `23505`) devolver un mensaje claro.
6. Si la consulta puede superar 1000 filas, usar `selectAllPages` con `order`
   estable.
7. Si se agrega una columna, actualizar el mapper y el tipo en `types.ts`.

Ejemplo de función nueva:

```ts
export async function fetchSomething(id: string) {
  const { data, error } = await supabase
    .from("tabla")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) fail(error);
  return data ? mapSomething(data) : null;
}
```

## Reglas para las vistas

- Usar `useAsync` y renderizar `error` con `<Flash>`. No dejar un spinner
  eterno cuando la consulta falla.
- Las páginas que leen `useSearchParams` van dentro de `<Suspense>`.
- Los formularios muestran el error de negocio y limpian el mensaje anterior.
- Después de una mutación exitosa, llamar `reload()` o navegar.
- No calcular disponibilidad ni precios en el navegador: pedirlos a la RPC.
- No leer `clients` desde el sitio público: no hay política para `anon`.

## Reglas para SQL

1. Migración nueva por cada cambio. Nunca editar una aplicada.
2. Nombrar el archivo con fecha: `YYYYMMDDHHMMSS_descripcion.sql`.
3. Empezar con un comentario que explique el **porqué** y los efectos.
4. Toda función `security definer` debe fijar `search_path` y validar el rol
   dentro de la función si corresponde.
5. Cada tabla nueva necesita `enable row level security` y políticas explícitas.
6. Cada función nueva necesita revisar sus `grant execute`: por defecto
   Postgres concede a `PUBLIC`.
7. Si se agrega una columna sensible, evaluar privilegios por columna.
8. Probar la migración sobre una base con datos, no solo vacía.

## Cómo agregar una funcionalidad

### Un campo nuevo en una tabla existente

1. Crear la migración con `alter table ... add column`.
2. Evaluar si el cliente debe poder escribirlo. Si no, no otorgar el privilegio
   de columna.
3. Actualizar el tipo en `src/lib/types.ts`.
4. Actualizar el mapper correspondiente.
5. Actualizar el formulario y la vista.
6. Verificar con `typecheck`, `lint`, `build`.

### Una pantalla nueva en el panel

1. Crear `src/app/panel/<ruta>/page.tsx`.
2. Si necesita datos, agregar la función en `src/lib/data`.
3. Envolver en `<Suspense>` si usa `useSearchParams`.
4. Usar `Flash` para errores y estados vacíos con `EmptyState`.
5. Agregar el enlace en `src/components/panel/panel-nav.tsx`.
6. Proteger la vista por rol en la interfaz **y** por RLS en la base.

### Una operación con reglas propias

Si la operación no puede expresarse con `insert`/`update` seguros:

1. Escribir una RPC `security definer` en una migración.
2. Validar rol, datos y estado dentro de la función.
3. Revocar `execute` de `public`, `anon` y `authenticated`, y otorgarlo solo a
   quien corresponda.
4. Consumirla desde `src/lib/booking.ts` o un módulo de dominio.
5. Documentar el contrato en `docs/02-MODELO-DE-DATOS.md`.

## Comentarios

El proyecto se hereda: los comentarios son parte de la entrega.

- Español, sin emojis.
- Explicar decisiones, invariantes y riesgos; no repetir lo que el código ya
  dice.
- Comentar el encabezado de cada módulo con `RESPONSABILIDAD` y, si aplica,
  `SEGURIDAD` o `IMPORTANTE`.
- En SQL, comentar el bloque completo antes de las sentencias.

Ejemplo:

```ts
/**
 * Normalización de teléfonos del lado del cliente.
 *
 * IMPORTANTE
 * Debe producir el mismo resultado que `public.normalize_phone` en Postgres.
 */
```

## Estilo

- TypeScript estricto, sin `any`.
- Funciones y variables en inglés; textos de interfaz en español.
- Componentes en `PascalCase`, archivos de página en `page.tsx`.
- Evitar dependencias nuevas si el problema se resuelve con la plataforma.
- No agregar `next/font/google` ni iconos de marca en `lucide-react` v1.
- Mantener el orden de imports que usa el repositorio.

## Pruebas manuales mínimas

No hay suite automatizada. Antes de publicar, recorrer:

1. `/` carga con datos reales de la barbería.
2. `/reservar` permite elegir servicio, barbero, día y horario.
3. La reserva aparece en `/reservar/confirmacion?id=...`.
4. El turno aparece en la agenda del panel.
5. El panel permite cambiar estado y notas del turno.
6. Un usuario `BARBER` no ve Ajustes, Equipo ni Servicios.
7. Un usuario desactivado no puede entrar.
8. La búsqueda de clientes encuentra por nombre y por teléfono.

El smoke test cubre el circuito de datos:

```bash
npm run smoke:supabase
```

Incluye disponibilidad, alta pública, confirmación, alta desde panel, creación
de usuario por Edge Function y bloqueo de escalada de privilegios.

## Errores comunes

| Error | Causa | Solución |
| --- | --- | --- |
| `permission denied for table profiles` | Falta el privilegio de columna | Revisar el `grant` de la migración |
| `new row violates row-level security policy` | Política ausente o rol incorrecto | Revisar RLS y `is_staff()` |
| `column ... does not exist` | Migración no aplicada | `npx supabase db push` |
| `JWT expired` | Sesión vencida | Volver a iniciar sesión |
| `useSearchParams() should be wrapped in a suspense boundary` | Falta `<Suspense>` | Envolver la vista |
| El build falla por `window` | Código de navegador en un componente de servidor | Agregar `"use client"` |
| `FunctionsHttpError` al crear usuario | Falta desplegar la Edge Function | `npx supabase functions deploy admin-users` |

## Pull requests

1. Rama corta y descriptiva (`fix/agenda-desactivados`).
2. Un cambio por PR, con contexto en la descripción.
3. Verificación escrita: comandos ejecutados y resultado.
4. Si toca SQL, indicar la migración y cómo se probó.
5. Si cambia una regla de negocio, actualizar `docs/` en el mismo PR.
6. No mezclar formateo masivo con cambios funcionales.

## Publicación

El CI valida cada push y PR a `main`. El despliegue se dispara a mano con el
workflow **Deploy to GitHub Pages** una vez que el CI está en verde. Ver
`docs/04-OPERACION.md`.
