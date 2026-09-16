# Phase 0: Allowed APIs

Researched in September 2026 from official documentation, package type definitions and the npm registry. Every later phase follows this file. **Before using an API that isn't listed here, read its official docs and add it here in the same pull request.**

## Versions

| Package | Use | Notes |
|---|---|---|
| Node.js | 22.x | DigitalOcean's default build. Fastify 5 needs 20 or later. Move to 24 before Node 22 support ends in April 2027. |
| React | 19.x | |
| Vite | 8.x | With `@vitejs/plugin-react` 6.x, which needs Vite 8 |
| React Router | 8.x | Imports come from `react-router` and `react-router/dom` |
| `@tanstack/react-query` | 5.x | Admin dashboard only |
| `vite-plugin-pwa` | 1.3.x | Uses Workbox 7.4 |
| `@vite-pwa/assets-generator` | 2.0.x | |
| `dexie` / `dexie-react-hooks` | 4.4.x | |
| `fastify` | 5.12.x | 6.x is still alpha: don't use it |
| `fastify-type-provider-zod` | 7.x | Needs Fastify ≥5.5 and Zod ≥4.1.5 |
| `zod` | 4.x | |
| `@fastify/cookie` / `static` / `rate-limit` / `helmet` | 11.x / 10.x / 11.x / 13.x | |
| `drizzle-orm` / `drizzle-kit` | 0.45.x / 0.31.x | The stable line. The docs website shows the 1.0 release candidate: don't copy APIs that exist only there. |
| `pg` / `@types/pg` | 8.x / 8.x | `pg` ships an ES module entry, so `import { Pool } from 'pg'` works |
| `@node-rs/argon2` | 2.2.x | |
| `vitest` | 5.x | With `@vitest/coverage-v8` and `jsdom` |
| `@testing-library/react` / `user-event` / `jest-dom` | 16.x / 14.x / current | |
| `fake-indexeddb` | 6.2.x | |
| `msw` | 2.x | |
| `recharts` | 3.x | |
| `lucide-react` | 1.x | The prototype's icons. Added in phase 3. |
| `@playwright/test` / `@axe-core/playwright` | 1.63.x / 4.x | |
| `@biomejs/biome` | 2.x | |
| `typescript` | 6.0.x | 7.0 is the Go rewrite and has no JavaScript API until 7.1. Vite's `react-ts` template pins 6.0. |
| `@types/node` / `@types/react` / `@types/react-dom` | 22.x / 19.x / 19.x | `@types/node` follows the Node major |
| `@testing-library/dom` | 10.x | Required by `@testing-library/react` 16 and `jest-dom` 7 |
| `jsdom` | 30.x | Needs Node 22.22.2 or later |
| `concurrently` | 10.x | Runs the server and Vite together in `npm run dev`. Needs Node 22. |
| `actions/checkout` | v7 | |
| GitHub Actions | `actions/setup-node@v7`, `actions/upload-artifact@v7`, `actions/download-artifact@v8` | Playwright's example workflows show older majors |
| PostgreSQL | 16 locally and in CI | Match the DigitalOcean cluster's major version when it is created |

## npm workspaces

- Root `package.json`: `"workspaces": ["app", "server", "shared", "e2e"]`.
- Run in one workspace: `npm run <script> -w server`. Run everywhere it exists: `npm run <script> --workspaces --if-present`.
- Add a package to one workspace: `npm install <pkg> -w app`.
- Package names are `@omp/app`, `@omp/server`, `@omp/shared` and `@omp/e2e`. `-w` also accepts the folder name.
- The root `.npmrc` sets `save-exact=true`, so `npm install` pins exact versions.

Source: docs.npmjs.com, "workspaces".

## Node.js 22 and TypeScript

- `tsconfig.base.json` holds the shared compiler settings, and each workspace's `tsconfig.json` extends it. TypeScript 6 defaults `types` to `[]`, so a workspace lists what it needs, such as `"types": ["node"]`.
- In development the server runs its `.ts` files directly: `node --watch --env-file-if-exists=.env --conditions=development src/server.ts`. Node 22.18 and later strip types without a flag or warning.
- Type stripping needs `.ts` at the end of relative imports, `import type` for types, and no enums, parameter properties or runtime namespaces. `erasableSyntaxOnly` and `verbatimModuleSyntax` make `tsc` enforce these. `rewriteRelativeImportExtensions` turns `.ts` into `.js` when `tsc` emits.
- Node won't strip types under `node_modules`. Workspace links resolve to their real folder, so `shared/src` works.
- `--env-file-if-exists=.env` loads `.env` when it exists. A variable already set in the environment wins over the file.
- In production the server runs compiled JavaScript: `npm run build -w server` emits `server/dist`, and `npm run start -w server` runs `node dist/server.js`. Type stripping is only a release candidate in Node 22.

**The shared package** exports its source in development and its build in production:

```json
"exports": { ".": { "development": "./src/index.ts", "types": "./dist/index.d.ts", "default": "./dist/index.js" } }
```

- Vite and Vitest add the `development` condition unless `NODE_ENV` is `production`. `tsc` gets it from `customConditions: ["development"]` in `tsconfig.base.json`, and the server's dev script from `--conditions=development`.
- `vite build` and `node dist/server.js` use `default`, so `npm run build` builds `shared` first. Each `tsconfig.build.json` sets `customConditions: []`.

Sources: nodejs.org/api/typescript.html and cli.html (Node 22); typescriptlang.org TSConfig reference; devblogs.microsoft.com "Announcing TypeScript 6.0" and "Announcing TypeScript 7.0"; vite.dev `resolve.conditions`.

## Docker Compose (local database)

- `docker-compose.yml` runs `postgres:16` with a named volume and a health check: `test: ["CMD-SHELL", "pg_isready -U omp -d omp"]`.
- The container's port 5432 is published on `127.0.0.1:5434`, because other projects on the main development Mac use 5432 and 5433. CI keeps 5432.
- `docker compose up --wait` starts the services in the background and returns once the health check passes.
- `docker compose down` removes the container and keeps the named volume. `docker compose down -v` also deletes the data.
- Leave out the top-level `version:` key, which is obsolete.

Sources: docs.docker.com `compose up`, `compose down`, "Control startup order", "Version and name top-level elements".

## Fastify 5

```ts
// server/src/app.ts
export function buildApp(opts = {}) {
  const app = Fastify({ logger: { level: 'info', redact: ['req.headers.cookie', 'res.headers["set-cookie"]'] }, ...opts })
  // register plugins and routes here
  return app
}
```

- **Tests** use `await app.inject({ method, url, payload, cookies })`. A plain-object `payload` is sent as JSON. Call `await app.ready()` before injecting and `await app.close()` afterwards. Never call `listen()` in tests.
- **Hooks:** `app.addHook('onRequest', async (request, reply) => { ... })`, and the same shape for `preHandler`. The `onRoute` application hook sees every route as it is registered.
- **`decorateRequest`** with an object or array value throws in v5. Use `app.decorateRequest('user')` and set `request.user` in an `onRequest` hook, or pass a getter.
- **Errors:** `app.setErrorHandler((error, request, reply) => ...)`. `setNotFoundHandler` applies to the plugin it is registered in: give the `/api` plugin its own JSON not-found handler.
- **Logger:** pass options to `logger`; a ready-made logger goes to `loggerInstance`.
- **Serving the app** (`@fastify/static`): register it with `root: <app/dist>` and `wildcard: false`, then add a not-found handler outside `/api` that answers page navigations with `reply.type('text/html').sendFile('index.html')` and status 200.
- **Cookies** (`@fastify/cookie`): `reply.setCookie(name, value, { httpOnly, secure, sameSite, path, maxAge })`; read `request.cookies[name]`; `reply.clearCookie(name, { path })` with the same options used to set it.
- **Rate limit** (`@fastify/rate-limit`): register with `{ global: false }`, then on a route add `config: { rateLimit: { max, timeWindow, keyGenerator } }`.
- **Security headers** (`@fastify/helmet`): the defaults include `default-src 'self'` and `script-src 'self'`, but not `worker-src` or `manifest-src`. Set `contentSecurityPolicy.directives` and add both as `'self'`, then test the response header, because the merge with defaults is not documented.
- **Static files, in detail:** `root` must be an absolute path. With `wildcard: false` the plugin scans the folder once at startup, so files added later aren't served. Its README documents no single-page-app fallback. Here the root not-found handler sends `index.html` only for a `GET` whose `Accept` header includes `text/html`, and JSON 404 `{ code: 'not_found', message }` otherwise, so a missing `.js` file never gets HTML.
- **Starting:** `await app.listen({ port, host })`. Use host `0.0.0.0` in production, where the container needs every interface, and `127.0.0.1` on a laptop.
- **Client address behind a proxy:** with `trustProxy: true`, `request.ip` is the left-most `X-Forwarded-For` address, which a client can set. The per-IP login limit uses it. Phase 7 checks what App Platform's router sends and, if a client can choose that address, trusts only the router's hop. (Found in the phase 6 review.)

Sources: fastify.dev Migration Guide V5, Testing guide, Hooks, Server reference, Logging; READMEs of `@fastify/static`, `@fastify/cookie`, `@fastify/rate-limit`, `@fastify/helmet`.

## Zod type provider

```ts
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod'
app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)
app.withTypeProvider<ZodTypeProvider>().route({
  method: 'POST', url: '/api/sync/push',
  schema: { body: PushEnvelope, response: { 200: PushResponse } },
  handler: async (request) => { /* request.body is typed */ },
})
```

Use one type provider package only. `@fastify/type-provider-zod` has the same API but only one release so far.

Source: github.com/fastify/fastify-type-provider-zod README.

## Zod 4 (server settings)

```ts
import { z } from 'zod'
const EnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  PORT: z.coerce.number().int().min(1).max(65535),
  NODE_ENV: z.enum(['development', 'test', 'production']),
})
const result = EnvSchema.safeParse(process.env)   // result.success, result.data, result.error.issues
```

- `z.url()` checks only that `URL` can parse the value. `protocol` limits the scheme.
- Each issue has `path` and `message`. `server/src/config.ts` turns them into one message that names every missing value, and `server.ts` prints it and exits with code 1.

Sources: zod.dev API, Basics, Error formatting.

## Drizzle ORM with PostgreSQL

**Connection:**

```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
const pool = new Pool({ connectionString: urlWithoutSslmode, ssl: config.databaseCaCert ? { ca: config.databaseCaCert, rejectUnauthorized: true } : undefined })
export const db = drizzle({ client: pool })
```

Remove any `sslmode` parameter from the URL and pass `ssl` explicitly, so the certificate check can't be switched off by the URL. Prove the production connection in phase 7.

**Tables** (`drizzle-orm/pg-core`), with the table options as an **array**:

```ts
export const sessionSteps = pgTable('session_steps', {
  sessionId: uuid('session_id').notNull().references(() => teachingSessions.id, { onDelete: 'cascade' }),
  step: smallint('step').notNull(),
  rating: smallint('rating'),
  content: jsonb('content').$type<StepContent>().notNull(),
}, (t) => [
  primaryKey({ columns: [t.sessionId, t.step] }),
  check('step_range', sql`${t.step} between 1 and 5`),
  check('rating_range', sql`${t.rating} is null or ${t.rating} between 1 and 5`),
])
```

- `uuid('id').primaryKey()` with no `.defaultRandom()` for IDs made on the phone; `.defaultRandom()` for `users.id`.
- `pgEnum('case_type', [...])`, then `caseType('case_type')` as a column.
- Unique only when present: `uniqueIndex('students_pmdc_unique').on(t.pmdcNumber).where(sql`${t.pmdcNumber} is not null`)`.
- Unique ignoring case: a helper `lower(col)` returning ``sql`lower(${col})` ``, then `uniqueIndex('users_username_unique').on(lower(t.username))`. There is no built-in `citext` type.
- Identity key: `.primaryKey().generatedAlwaysAsIdentity()`.

**Queries:**

- `db.insert(t).values(v).onConflictDoNothing({ target: t.id })`. `.returning()` gives no row when the conflict happened.
- `db.insert(t).values(v).onConflictDoUpdate({ target: t.id, set: { ... } })`.
- `await db.transaction(async (tx) => { ... })`.
- `count()`, `avg()`, `sum()` and `sql` from `drizzle-orm`, used in `select`.
- Use core `select`, `insert`, `update` and joins. Don't use the relational `db.query` API.

**Migrations:**

```ts
// server/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'
export default defineConfig({ dialect: 'postgresql', schema: './src/db/schema.ts', out: './drizzle', dbCredentials: { url: process.env.DATABASE_URL! } })
```

- Create migration files with `npx drizzle-kit generate`, run only by the contract owner.
- Apply them with `migrate(db, { migrationsFolder: './drizzle' })` from `drizzle-orm/node-postgres/migrator`, in `npm run db:migrate`. Always pass `migrationsFolder`.
- Don't use `drizzle-kit push` for this app.

Sources: orm.drizzle.team get-started-postgresql, indexes-constraints, insert, transactions, migrations, drizzle-config-file, guides/unique-case-insensitive-email; DigitalOcean "Secure PostgreSQL".

## Server integration tests with PostgreSQL

- Locally: the Docker Compose database. In CI: a `postgres` service container with `pg_isready` health options and port 5432.
- The Vitest `server` project sets `fileParallelism: false`, so test files share one database without clashing. A `resetDb()` helper empties every table (`TRUNCATE ... RESTART IDENTITY CASCADE`) and resets `change_counter` before each test.
- A global setup runs every migration on a fresh test database once per run.

## Passwords and login

**Password rules** (NIST SP 800-63B revision 4, section 3.1.1.2; the password is the only login factor):

- At least **15 characters**; allow at least 64 (the app allows 128).
- No composition rules: don't demand digits, symbols or capitals.
- Check new passwords against a list of common passwords (at least 10,000 entries), plus the app's name and the user's own username.
- No forced periodic changes. A forced change is right when a password may be known to others, which covers the admin's temporary password.
- Temporary passwords: four groups of four lower-case letters and digits, leaving out look-alike characters, such as `k7mq-3xrp-9dwt-2hvf`.

**Hashing** with `@node-rs/argon2`:

```ts
import { hash, verify } from '@node-rs/argon2'
const stored = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 })   // Argon2id is the default
const ok = await verify(stored, password)
```

These settings are OWASP's recommended Argon2id row. When the username doesn't exist, still run `verify` against a fixed dummy hash, so the response time reveals nothing.

**Login cookie** (OWASP Session Management):

- The token is 32 random bytes from `crypto.randomBytes`, base64url-encoded. The database stores only its SHA-256.
- In production the cookie is named `__Host-omp_session`, with `Secure`, `HttpOnly`, `SameSite=Strict` and `Path=/`, and no `Domain`. In development and tests over plain http, it is named `omp_session` without `Secure`. The server refuses to start in production with the insecure settings.
- Issue a new token at login and at password change. Delete the server-side row at logout, at password reset and when a user is switched off.
- Switching a user off marks their login rows with `ended_reason = 'switched_off'` instead of deleting them. The next request with that token gets 401 with the reason and deletes the row, so the phone can tell the doctor why. Logout and password reset still delete rows at once. (Phase 4D.)
- A doctor's login lasts 30 days from last use, and at most 90 days. An admin's lasts 30 minutes from last use, and at most 8 hours.

**Cross-site request forgery** (OWASP CSRF Prevention, custom request headers):

- Every request that changes data must carry `X-OMP-Client: app` and `Content-Type: application/json`. The server rejects any other.
- The server also rejects a change request whose `Origin` header is present and differs from the app's own origin.
- `SameSite=Strict` adds a second layer.

**Failed logins** (OWASP Authentication):

- A `login_attempts` table keyed by lower-cased username, used whether or not the account exists: `failures`, `locked_until`.
- After 5 failures, each further failure locks that username for a delay that starts at 1 second and doubles, up to 15 minutes. A successful login or an admin password reset clears it.
- Also a per-IP limit on the login route with `@fastify/rate-limit`: 20 attempts per 15 minutes.
- Every failure returns the same `invalid_credentials` message.
- A username locked by these delays gets 429 `too_many_attempts`, as `api.md` lists. A wrong password and an unknown username both get `invalid_credentials`. (Phase 3.)

**Phone data:** the login token is never readable by JavaScript and is never stored in IndexedDB. Phone data is cleared at logout by deleting the Dexie database (phase 4C). Don't send `Clear-Site-Data`: it would also remove the installed app's offline files.

Sources: OWASP Password Storage, Session Management, CSRF Prevention, Authentication and HTML5 Security cheat sheets; NIST SP 800-63B-4; `@node-rs/argon2` type definitions.

## React, Vite and React Router

```ts
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
const router = createBrowserRouter([
  { path: '/', Component: DoctorLayout, children: [...] },
  { path: '/admin/*', lazy: () => import('./admin/route') },
])
```

- `react-router-dom` no longer exists in version 8.
- Create the app with `npm create vite@latest app -- --template react-ts`, and add `@vitejs/plugin-react`.
- `@vitejs/plugin-react` 6 needs Vite 8 and transforms with Oxc, not Babel.
- Dev server: `server: { port: 5180, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3000' } }`. With `strictPort`, Vite stops instead of moving to another port when 5180 is taken.
- The string form of a proxy entry sets `changeOrigin: true`, so the server sees `Host: 127.0.0.1:3000` while the browser sends `Origin: http://localhost:5180`, and the change-request guard refuses every login and save. Use `'/api': { target: 'http://127.0.0.1:3000', changeOrigin: false }`. (Found in phase 6 by logging in through `npm run dev`; `vite/dist/node/chunks/node.js` turns a string into `{ target, changeOrigin: true }`.)
- Tests render routes with a memory router: `createMemoryRouter(routes, { initialEntries: ['/'] })` from `react-router`, passed to `RouterProvider` from `react-router/dom`. `app/src/router.tsx` exports `routes`, and `main.tsx` passes them to `createBrowserRouter`.

Sources: reactrouter.com createBrowserRouter and the v7-to-v8 upgrade guide; vite.dev guide.

## lucide-react (icons)

```tsx
import { House, Star } from 'lucide-react'
<Star size={20} color="#D4A76A" strokeWidth={1.5} fill="none" />
<button type="button" aria-label="Go to students"><House /></button>
```

- Named imports only. The package is ES modules with `"sideEffects": false`, so only imported icons reach the bundle.
- Props: `size` (default 24), `color` (default `currentColor`), `strokeWidth` (default 2), and any SVG attribute such as `fill`. `absoluteStrokeWidth` is deprecated; use `nonScalingStroke`.
- Icons carry `aria-hidden="true"` by default. Put the accessible name on the button, not the icon.
- Several prototype names are deprecated aliases in 1.x. Use the current names: `House` (not `Home`), `ChartColumn` (`BarChart3`), `Ellipsis` (`MoreHorizontal`), `CircleQuestionMark` (`HelpCircle`), `SquarePen` (`Edit`), `TriangleAlert` (`AlertTriangle`), `Trash` (`Trash2`), `BuildingComplex` (`Building2`).
- Brand icons were removed in 1.0.

Sources: lucide.dev/guide/react/getting-started, /guide/version-1, /guide/react/migration, /guide/react/advanced/accessibility, /guide/react/advanced/aliased-names; the published `lucide-react@1.46.0` package files.

## TanStack Query (dashboard only)

`new QueryClient({ defaultOptions: { queries: { networkMode: 'online' } } })`, with `useQuery({ queryKey, queryFn })` and `useMutation({ mutationFn })` in object form only. The doctor app reads from the phone database, not from TanStack Query.

Source: tanstack.com/query/v5, "Network Mode".

## vite-plugin-pwa and Workbox

```ts
VitePWA({
  registerType: 'prompt',          // the default; never 'autoUpdate'
  injectRegister: false,           // not null, which is deprecated
  manifest: { name: 'OMP DigiCoach', short_name: 'DigiCoach', start_url: '/', scope: '/', display: 'standalone', icons: [...] },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
    globIgnores: ['**/admin-*.js'],
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [/^\/api\//, /^\/admin/],
  },
})
```

- React hook: `import { useRegisterSW } from 'virtual:pwa-register/react'` returns `{ needRefresh: [bool, set], offlineReady: [bool, set], updateServiceWorker(reloadPage?) }`. Add `/// <reference types="vite-plugin-pwa/react" />`.
- The default `globPatterns` leaves out images, which is why the list above adds them.
- `navigateFallbackDenylist` doesn't stop a chunk being precached; `globIgnores` does.
- The plugin adds `manifest.webmanifest` to the precache list itself. When `globPatterns` also matches it, the two entries have different revisions and Workbox's install fails with `add-to-cache-list-conflicting-entries`, leaving nothing cached. Add `manifest.webmanifest` to `globIgnores`. (Found in phase 4C by reading the service worker's error through the Chrome DevTools Protocol.)
- Icons: `pwaAssets: { config: true, overrideManifestIcons: true }` with a `pwa-assets.config.ts` generates the icon set at build time and adds the head links and manifest icons, so no generated PNGs are committed.
- Add no `runtimeCaching` rule for `/api`.
- Icons: `@vite-pwa/assets-generator` with `minimal2023Preset` and `images: ['public/logo.svg']`.
- Keep both `apple-mobile-web-app-capable` and `mobile-web-app-capable` meta tags.

Sources: `vite-plugin-pwa` 1.3.0 type definitions (`index.d.ts`, `react.d.ts`); `workbox-build` 7.4.1 types; vite-pwa-org React guide and minimal requirements.

## Dexie and fake-indexeddb

```ts
import { Dexie, type EntityTable } from 'dexie'
export class PhoneDb extends Dexie {
  outbox!: EntityTable<OutboxItem, 'seq'>
  constructor() { super('omp'); this.version(1).stores({ outbox: '++seq, &opId, type' /* ... */ }) }
}
```

- `useLiveQuery(() => db.outbox.count(), [])` comes from `dexie-react-hooks`.
- `db.transaction('rw', [db.sessions, db.outbox], async () => { ... })`.
- To change the schema, add `this.version(2).stores({...}).upgrade(tx => ...)` and keep `version(1)`.
- Tests: `import 'fake-indexeddb/auto'` in the Vitest setup file; give each test a fresh `new IDBFactory()` from `fake-indexeddb`.

Sources: dexie.org Typescript, Tutorial/React, Dexie.version(), Dexie.transaction(); fake-indexeddb README.

## Connectivity

`navigator.onLine` is "inherently unreliable" (MDN): use it only for the status badge. Listen for the window `online` event to trigger a sync, but always attempt the request and handle failure.

## iPhone and Android facts

- In the Safari browser, iPhones delete a site's stored data after 7 days of Safari use without a visit. Home-screen apps "have their own counter of days of use" (WebKit).
- Safari and the home-screen app keep completely separate storage and cookies.
- Safari has no Background Sync API. Chrome on Android does, but the app doesn't depend on it.
- iPhones have no install prompt (`beforeinstallprompt`). Android Chrome does.
- `navigator.storage.persist()` exists in Safari and is granted without asking, more readily for home-screen apps.

Sources: webkit.org blog posts 10218 and 14403; caniuse "background-sync"; MDN "Making PWAs installable".

## Vitest and React Testing Library

- The root `vitest.config.ts` uses `defineConfig` from `vitest/config` with `test.projects`. Don't create `vitest.workspace.ts`.
- Component tests set `environment: 'jsdom'` (install `jsdom`) and have `import '@testing-library/jest-dom/vitest'` in the setup file.
- Fake time: `vi.useFakeTimers()`, `vi.setSystemTime(date)`, `vi.advanceTimersByTime(ms)` or `advanceTimersByTimeAsync(ms)`, then `vi.useRealTimers()`.
- Coverage: `test.coverage.provider: 'v8'`.
- User actions: `const user = userEvent.setup()` once per test, then `await user.click(...)`.
- Projects in `vitest.config.ts`: `{ extends: './app/vite.config.ts', test: { name: 'app', root: './app', environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] } }`. `include` and `setupFiles` resolve against the project's `root`. In Vitest 5 inline projects inherit the root config by default.
- Run chosen projects with a repeated flag: `vitest run --project shared --project app`.
- Without `globals: true`, React Testing Library can't clean up after each test by itself. The setup file calls `cleanup()` in `afterEach`.
- `jest-dom` 7 needs `@testing-library/dom` installed.

Sources: vitest.dev projects, vi API, environment, coverage; testing-library.com user-event; jest-dom README.

## MSW

```ts
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'          // tests; setupWorker from 'msw/browser' in development
```

In tests: `server.listen()` before all, `server.resetHandlers()` after each, `server.close()` after all. Keep the PWA plugin's `devOptions.enabled` false while MSW runs in the browser, because the two service workers clash.

Source: mswjs.io setup-server and setup-worker.

## Recharts

`<ResponsiveContainer width="100%" height={240}><LineChart data={...}>...</LineChart></ResponsiveContainer>` on screens. In jsdom tests, render charts with fixed `width` and `height`, because `ResponsiveContainer` draws at zero size there.

## Playwright

```ts
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { name: 'phone-chromium', use: { ...devices['Pixel 7'] }, dependencies: ['setup'] },
    { name: 'phone-webkit', use: { ...devices['iPhone 14'] }, dependencies: ['setup'] },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
  ],
  webServer: { command: 'npm run start:test', url: 'http://localhost:3000/api/health', reuseExistingServer: !process.env.CI },
})
```

- Logged-in state: the setup project saves `storageState` files; tests use `test.use({ storageState: 'playwright/.auth/doctor.json' })`.
- Offline: `await context.setOffline(true)`.
- Clock: call `await page.clock.install({ time })` **before** opening the page, then `await page.clock.fastForward('01:15')` or `runFor(ms)`.
- Service workers are allowed by default (`serviceWorkers: 'allow'`). Set `'block'` in tests that intercept requests with `page.route`.
- Resend test: `await page.route('**/api/sync/push', async (route) => { await route.fetch(); await route.abort() }, { times: 1 })`.
- Print: `await page.emulateMedia({ media: 'print' })`.
- Downloads: `const dl = page.waitForEvent('download')`, click, then `await (await dl).saveAs(path)`.
- Accessibility: `const results = await new AxeBuilder({ page }).analyze()`, with `AxeBuilder` imported as the default export of `@axe-core/playwright`; check `results.violations`.
- CI: `npx playwright install --with-deps`. Don't cache browsers. Sharding uses `--shard=1/2` with blob reports merged by `npx playwright merge-reports`.
- `webServer` also takes `cwd` (default: the config's folder), `env` (added to the inherited environment) and `timeout` (default 60 seconds). `url` must answer 2xx, 3xx or 400–403.
- The HTML report goes beside the nearest `package.json` at or above the config, so here it is `e2e/playwright-report/`. CI uploads that folder.

Sources: playwright.dev test-projects, auth, clock, emulation, downloads, test-webserver, accessibility-testing, ci, test-sharding; the device descriptor list.

## Biome

`npx @biomejs/biome init` creates `biome.json`. Locally, `biome check --write .` fixes files. CI runs `biome ci .`, which never changes files.

- Rules: `"linter": { "rules": { "preset": "recommended" } }`. The older `"recommended": true` is deprecated.
- Files: `"files": { "includes": ["**", "!server/drizzle", "!!**/dist"] }`. List `"**"` first. `!` skips formatting and linting; `!!` also keeps Biome's scanner out, which the docs advise for build output.
- `"vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true }` also skips everything in `.gitignore`.

Source: biomejs.dev getting started and CLI reference.

## GitHub Actions

- `actions/setup-node@v7` with `cache: npm`. The single root `package-lock.json` is found automatically.
- `services.postgres` with `image: postgres:16`, `POSTGRES_PASSWORD` (and `POSTGRES_USER`/`POSTGRES_DB` when the app expects other names), health options `--health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5`, and ports `5432:5432`.
- `actions/upload-artifact@v7`. Artifact names must be unique within a run, so include the shard number.
- `actions/checkout@v7`. It refuses to check out a fork's pull request code under `pull_request_target` or `workflow_run`; this workflow uses neither.
- Upload the Playwright report with `if: ${{ !cancelled() }}`, so it is kept when tests fail.

Sources: github.com/actions/setup-node and upload-artifact releases; docs.github.com "Creating PostgreSQL service containers".

## DigitalOcean App Platform and Managed PostgreSQL

**App spec (`.do/app.yaml`):**

- `services[]`: `name`, `github: { repo, branch, deploy_on_push }`, `source_dir`, `build_command`, `run_command`, `http_port`, `environment_slug: node-js`, `instance_size_slug` (current slugs such as `apps-s-1vcpu-1gb`), `instance_count`, and `health_check: { http_path, initial_delay_seconds, ... }`.
- `envs[]`: `key`, `value`, `scope` (`RUN_TIME`, `BUILD_TIME` or `RUN_AND_BUILD_TIME`), `type` (`GENERAL` or `SECRET`). Database values are bound as `${<db-name>.DATABASE_URL}` and `${<db-name>.CA_CERT}`, and exist at run time only.
- `databases[]`: `name`, `engine: PG`, `production: true`, `cluster_name`, `db_name`, `db_user`.
- `jobs[]` with `kind: PRE_DEPLOY` runs `npm run db:migrate` once before the new version takes traffic.
- The Node version comes from `engines.node` in `package.json` (22.x).
- Check the spec with `doctl apps spec validate .do/app.yaml`, and create the app with `doctl apps create --spec .do/app.yaml`.

**Database:**

- Backups run daily and are kept 7 days, with point-in-time restore inside that window.
- A restore or fork always creates a new cluster: `doctl databases fork <new-name> --restore-from-cluster-id <id>`.
- Add the app as a trusted source: `doctl databases firewalls append <cluster-id> --rule app:<app-id>`.
- TLS is always required.
- Connection pooling (PgBouncer) isn't needed at this size.

**Not confirmed by the docs,** so it is tested in phase 7: whether a failing `PRE_DEPLOY` job stops the deploy.

Sources: docs.digitalocean.com App Platform app spec reference, environment variables, jobs, Node.js buildpack, pricing; Managed PostgreSQL restore, fork, secure and connection pool guides; doctl reference.

## Anti-patterns

Phase 6 turns each line into a search or review check.

| Don't | Why |
|---|---|
| `registerType: 'autoUpdate'` | Reloads the page mid-session |
| Workbox `runtimeCaching` for `/api` | Caches private answers |
| `SyncManager` / Background Sync | Not on iPhones |
| `localStorage` for queued data or drafts | Small, synchronous, no transactions |
| Deciding to send from `navigator.onLine` | Unreliable |
| `injectRegister: null` | Deprecated |
| `vitest.workspace.ts` | Deprecated |
| `react-router-dom` | Removed in React Router 8 |
| `biome check` in CI | Can rewrite files |
| Positional `useQuery(key, fn)` | Removed in TanStack Query 5 |
| MSW `rest` or `res(ctx...)` | Removed in MSW 2 |
| `decorateRequest` with an object value | Throws in Fastify 5 |
| `drizzle-kit push` | Skips reviewed migration files |
| `db.query.*`, `defineRelations` | The relations API differs between Drizzle lines |
| Table options as an object `(t) => ({ ... })` | Old syntax |
| Migrations in the service `run_command` | Run on every instance at every start |
| Composition rules or forced password expiry | NIST 800-63B-4 says "SHALL NOT" |
| `Clear-Site-Data` at logout | Removes the installed app's offline files |
| Legacy DigitalOcean size slugs such as `basic-xxs` | Only valid for apps made before May 2024 |
| `ResponsiveContainer` in jsdom tests | Draws at zero size |
| Running `.ts` files with Node in production | Type stripping is a release candidate in Node 22 |
| `"recommended": true` in `biome.json` | Deprecated: use `"preset": "recommended"` |
