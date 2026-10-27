# En-silla — agent notes

Next.js 16 App Router (`src/`), TypeScript strict, Tailwind v4, Prisma 6 + SQLite. Spanish barbershop product: public booking + staff panel. `README.md` is stale create-next-app boilerplate; trust `package.json` and `src/`.

## Commands

- Setup: copy `.env.example` to `.env`, `npm install`, `npx prisma migrate dev`, `npm run db:seed`.
- Verify: `npm run typecheck` then `npm run lint` then `npm run build`. There is no test suite; use build + manual route smoke tests.
- DB: `npm run db:seed` wipes and recreates demo data (~1.2k appointments, dates relative to today). `npm run db:reset` resets migrations and seeds; `npm run db:push` syncs schema without a migration.
- Dev server: `npm run dev` (3000). Production smoke: `npm run build` then `npm start`.
- npm 11 `allowScripts` entries in `package.json` are required for Prisma/esbuild installs; do not remove them.

## Architecture

- Routes: public site/booking in `src/app/(public)`, login in `src/app/login`, staff area in `src/app/panel`, APIs under `src/app/api`.
- `src/proxy.ts` is Next 16's middleware (not `middleware.ts`). It validates the session and protects `/panel`; edit it there and keep the matcher.
- Mutations are server actions in `src/app/actions/*`. Forms redirect back with `?ok=` / `?error=` and render `Flash`; Zod schemas live in `src/lib/validation.ts`.
- Domain logic lives in `src/lib`: `availability.ts` (slots), `booking.ts` (create/conflict rules), `agenda.ts`, `stats.ts`, `ideas.ts`, `notifications.ts`, `ics.ts`, `shop.ts`. Reuse these instead of duplicating scheduling rules in pages.
- Auth: bcryptjs + `jose` JWT in the `ensilla_session` cookie. Use `requireUser()` / `requireAdmin()` from `src/lib/auth.ts`. Roles are `ADMIN` and `BARBER`; admin-only nav/pages are conditional.
- Prisma client singleton: `src/lib/prisma.ts`. Schema: `prisma/schema.prisma`; the SQLite DB resolves to `prisma/dev.db` (ignored by git).

## Domain conventions

- Scheduling uses the shop timezone from `ShopSetting` (default `America/Argentina/Buenos_Aires`). Use `src/lib/datetime.ts` (date-fns-tz) for every date/time conversion and display; never format with server-local time. Store instants in UTC.
- Money is integer cents (`priceCents`); format with `formatMoney`.
- Phones are normalized to digits on write via `normalizePhone`; WhatsApp links via `whatsappLink` / `whatsappNumber`.
- Appointment statuses and labels come from `src/lib/constants.ts` (`PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`; `BLOCKING_STATUSES`). Source is `PUBLIC` or `STAFF`.
- Public flow: `/reservar` wizard → `/api/availability` → `createPublicBookingAction` → `/reservar/confirmacion/[id]`; ICS download via `/api/turno/[id]/ics`.
- Notifications are in-app only (no email/SMS provider); WhatsApp is link-based.

## UI

- Tailwind v4 with no `tailwind.config`; theme tokens and shared classes (`.card`, `.card-pad`, `.input`, `.textarea`, `.select`, `.btn-*`, `.chip`, `.badge`) are in `src/app/globals.css`. Reuse them.
- Palette: `ink`, `cream`, `sand`, `copper`, `sage`, `plum`, `amber`. Display font is Georgia/system serif; do not add `next/font/google`.
- UI copy is Spanish (es-AR) and prices are ARS.
- `lucide-react` v1 has no brand icons (e.g. Instagram); use generic icons such as `AtSign`.
- Next 16 `LayoutProps` / `PageProps` generated types may be absent before dev/build; prefer explicit prop types (the root layout uses `ReactNode`).
- Preserve the Turbopack CSS rule and `serverExternalPackages: ["@prisma/client"]` in `next.config.ts`.

## Demo and local gotchas

- Demo logins: `admin@ensilla.app` / `admin123`; `bruno@ensilla.app` and `valentina@ensilla.app` / `barber123`. The login page also has one-click demo buttons.
- The session cookie is `Secure` in production, so local HTTP login works on `localhost` but may not persist via a LAN IP; prefer `localhost` for smoke tests.
- After changing Prisma schema, run a migration (`npm run db:migrate`) and reseed if demo data matters.
