# Direct dependency audit

Audit basis: the catalog-only storefront, read-only admin, and Cloudflare analytics changes.
Imports, configuration, npm scripts, tests, and framework requirements were checked.

## Kept runtime packages

| Package                   | Direct consumer or reason                                              |
| ------------------------- | ---------------------------------------------------------------------- |
| `@supabase/ssr`           | Browser, server, proxy, callback, and session-refresh Supabase clients |
| `@supabase/supabase-js`   | Typed database clients, service role client, auth, and readiness check |
| `@upstash/ratelimit`      | Proxy rate limiter                                                     |
| `@upstash/redis`          | Proxy rate limiter and readiness check                                 |
| `jose`                    | Encrypted admin-session JWTs                                           |
| `lucide-react`            | Storefront, auth, cart, chat, and admin icons                          |
| `next`                    | Application framework and build/runtime scripts                        |
| `react`                   | Application and component runtime                                      |
| `react-dom`               | React portal and rendering APIs                                        |
| `tailwind-scrollbar-hide` | Plugin loaded by `tailwind.config.ts`                                  |
| `zod`                     | Environment and request validation                                     |

## Kept development packages

| Package                  | Direct consumer or reason                          |
| ------------------------ | -------------------------------------------------- |
| `@types/node`            | Node globals and APIs in TypeScript                |
| `@types/react`           | React TypeScript declarations                      |
| `@types/react-dom`       | React DOM TypeScript declarations                  |
| `autoprefixer`           | PostCSS configuration                              |
| `eslint`                 | `lint` and `lint:fix` scripts                      |
| `eslint-config-next`     | Next.js ESLint rules                               |
| `eslint-config-prettier` | Disables formatting-conflicting lint rules         |
| `postcss`                | Next.js CSS processing configuration               |
| `prettier`               | `format` and `format:check` scripts                |
| `supabase`               | Type-generation script and local migration tooling |
| `tailwindcss`            | Tailwind and PostCSS configuration                 |
| `tsx`                    | TypeScript contract-test scripts                   |
| `typescript`             | `typecheck` and Next.js compilation                |
| `vitest`                 | Unit-test runner and watch mode                    |

## Removed

`@dnd-kit/core`, `@dnd-kit/modifiers`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, and
`browser-image-compression` had only served the deleted product editor. `recharts` had only
served the deleted first-party analytics dashboard.
