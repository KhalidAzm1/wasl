# Technology Stack Documentation

## Monorepo Structure

```
workspace/
├── artifacts/
│   ├── wasl-platform/     # Main React/Vite web app (frontend)
│   ├── api-server/        # Express REST API (backend)
│   └── mockup-sandbox/    # Design/canvas component preview sandbox (dev tool)
├── lib/
│   ├── db/                 # Drizzle ORM schema + client (@workspace/db)
│   ├── supabase/           # Supabase client wrapper (@workspace/supabase)
│   ├── api-zod/            # Shared Zod validation schemas (@workspace/api-zod)
│   └── api-client-react/   # Generated React Query hooks (@workspace/api-client-react)
└── scripts/                 # Build/maintenance scripts (e.g. post-merge.sh)
```

Managed with **pnpm workspaces**; TypeScript project references link packages for incremental builds.

## Frontend (`artifacts/wasl-platform`)

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build tool | Vite 7 |
| Language | TypeScript 5.9 |
| Routing | Wouter |
| Data fetching | TanStack Query (React Query) via generated hooks |
| Styling | Tailwind CSS 4 |
| Component primitives | Radix UI + Shadcn/UI pattern |
| Animation | Framer Motion |
| Icons | Lucide React |
| Command palette | cmdk |
| Fonts | Google Fonts ("Outfit") |

## Backend (`artifacts/api-server`)

| Layer | Technology |
|---|---|
| Framework | Express 5 |
| Language | TypeScript 5.9 |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Replit-managed) |
| Auth verification | Supabase Admin SDK |
| File storage | Microsoft Graph API (OneDrive), via Replit connector |
| Validation | Zod (shared schemas from `lib/api-zod`) |
| Logging | Pino (structured JSON request logs) |

## Identity & Auth

| Component | Technology |
|---|---|
| User authentication | Supabase Auth (JWT, email/password) |
| Session storage | Supabase client-managed session (browser) |
| Server-side verification | `supabase.auth.getUser(token)` |
| Second factor (admin) | Custom HMAC PIN token (`SESSION_SECRET`-signed), not Supabase-managed |

## Design/Prototyping Tooling

- **mockup-sandbox**: isolated Vite dev server for previewing UI components/variants on the Replit canvas — a development-time tool only, not part of the production runtime.

## Environment Variables / Secrets (names only)

| Name | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SUPABASE_ANON_KEY` | Public Supabase client key |
| `SUPABASE_DB_URL` | Supabase's own Postgres URL (auth-only; not used for app data) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side privileged Supabase access |
| `SESSION_SECRET` | HMAC signing key for admin PIN tokens |
| `ADMIN_PANEL_PIN` | The PIN value checked for the admin second factor |
| `PORT` | Bound port per Replit-assigned artifact port |

## Build & Tooling

- **Package manager**: pnpm (workspace-aware).
- **Type checking**: `tsc --build` across project references; run before deploy.
- **Linting/formatting**: project-level conventions enforced via TypeScript strictness (see individual `tsconfig.json`s).
- **Deployment target**: Replit Autoscale.
