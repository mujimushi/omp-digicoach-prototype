# OMP DigiCoach

A phone app that guides a clinical teacher through the five steps of the One-Minute Preceptor model and records each teaching session.

## Folders

| Folder | Contents |
|---|---|
| `app/` | Doctor app and admin dashboard: React, Vite and React Router |
| `server/` | Fastify API. In production it also serves the built app. |
| `shared/` | Data rules and constants used by both `app` and `server` |
| `e2e/` | Playwright tests on phone Chromium, phone WebKit and desktop Chromium |
| `.github/` | CI workflow and pull request template |
| `prototype/` | Clickable React prototype with sample data and no backend |
| `design/mockups/v1`, `v2`, `v3` | Client mockups, oldest first. Their text has typos, so follow their layout and colour, not their wording. |
| `design/logo.png` | App logo |
| `docs/` | Research protocol, client guide, tech spec, client feedback and notes |
| `docs/plan/` | Build phases, allowed APIs and the testing plan |

## Run the app

You need Node 22 (see `.nvmrc`) and Docker.

```bash
npm ci
cp server/.env.example server/.env
npm run db:up
npm run dev
```

Open http://localhost:5180. Vite forwards `/api` to the server on port 3000. PostgreSQL listens on port 5434.

| Command | Does |
|---|---|
| `npm run check` | Types, lint, unit tests and server tests |
| `npm run test:e2e` | Builds the app and runs Playwright. First run `npx playwright install`. |
| `npm run build` | Builds `shared`, then `app`, then `server` |
| `npm run format` | Formats and fixes files with Biome |
| `npm run db:down` | Stops PostgreSQL and keeps its data |

## Run the prototype

```bash
cd prototype
npm install
npm run dev
```

On a screen wider than 600 px the app shows inside a phone frame; on a phone it fills the screen.
