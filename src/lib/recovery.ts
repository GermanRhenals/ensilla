/**
 * URL de retorno del enlace de recuperación de contraseña.
 *
 * Supabase solo redirige a URLs registradas en Authentication > URL
 * Configuration. Se incluye el `basePath` porque el sitio se publica bajo
 * /<repositorio> en GitHub Pages.
 */
export function recoveryRedirectUrl() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${window.location.origin}${basePath}/restablecer/`;
}
