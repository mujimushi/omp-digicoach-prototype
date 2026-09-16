# OMP DigiCoach build plan

## What are we building?

Three parts, in one repository:

- **Doctor app**: an installable web app (PWA) for phones. A doctor runs a One-Minute Preceptor teaching session with a student and records it.
- **Dashboard**: a website where the admin registers doctors, looks through students, doctors and sessions, and prints or downloads reports.
- **Server**: keeps all data in one database and serves both.

The app connects to no other app: no Google or Facebook login, no email or SMS, no analytics.

## Who uses it?

| Person | Uses | Can |
|---|---|---|
| Doctor | Doctor app | Add and correct students, run sessions, see their own history and stats, keep teaching pearls |
| Admin: Prof. Muneeza | Dashboard | Register doctors, reset passwords, switch doctors off, see everything, print reports, download data |
| Student | Nothing | Never logs in or sees reports |

One account can be both doctor and admin, so Prof. Muneeza can also teach with the same login.

Every doctor sees the full student list, but only the sessions, ratings and pearls they recorded themselves. The admin sees everything.

## What does a doctor do in the app?

1. Log in with the username and password the admin gave them, then choose their own password.
2. Pick the student from a searchable list, or add a new one: name, PMDC number (optional), level (medical student, house officer, resident) and year. Any doctor can correct these details, and the app records who changed what.
3. Set the department (filled in from their profile) and the case type.
4. Run the five steps. One 60-second countdown covers the whole session. At zero it keeps counting the extra time, and nothing closes or moves on until the doctor does.
5. Rate the learner once on each step, from 1 to 5 stars: needs improvement, basic, competent, proficient, excellent.
6. Fill in the quick log: diagnosis, whether the learner gave it, and how useful the session was (1–6).
7. Look back at their own sessions, their stats, their teaching pearls, and the progress of students they have taught.

The app saves a session on the phone as the doctor works, so closing the app or losing signal mid-session loses nothing.

The screens follow `prototype/`, without the sample data, the Full Name field on the login screen, Export Data and the empty Settings screen. iPhones have no install button, so the app shows first-time users how to add it to the home screen.

## What does the admin do on the dashboard?

- **Doctors**: a list, and a simple form to add or edit a doctor (name, username, temporary password, department, designation). Buttons reset a password or switch a doctor off; their sessions stay.
- **Students**: a list with PMDC number, level, number of sessions and average rating. Each student's page shows every session and their ratings over time.
- **Doctor activity**: sessions per doctor, steps completed, average session time and students taught.
- **Sessions**: filter by date, doctor, student and case type, and open any session to see everything recorded.
- **Reports**: student and doctor report pages that print cleanly or save as PDF from the browser, and a CSV download of all sessions for Excel or SPSS.

## What data do we store?

| Table | Holds |
|---|---|
| `users` | Name, username, password hash, department, designation, doctor and admin flags, active flag, must-change-password flag |
| `login_sessions` | Login cookies, each tied to a user and an expiry time |
| `students` | Name, PMDC number (optional, unique when given), level, year, who added the record and who last changed it |
| `teaching_sessions` | Doctor, student, department, case type, the learner's level and year on that day, start time, seconds teaching, extra seconds beyond 60, seconds paused, seconds on the quick log, diagnosis, whether the learner gave it, usefulness |
| `session_steps` | For each of the five steps: seconds spent, rating (1–5, or none), and what was entered (JSON) |
| `pearls` | Each doctor's private teaching points by diagnosis, and how often they were used |
| `audit_log` | Who changed a student record or used an admin action, when, and the values before and after |

- Each session copies the learner's level and year, so moving a student up a year leaves old sessions correct.
- The phone creates the ID for each new student and session, so a session sent twice is stored once.
- No patient details: sessions record the diagnosis only, and text boxes remind doctors not to type patient names.

## How does the app work without signal?

A PWA can keep data on the phone, and space is not a limit: a session takes a few kilobytes.

- Once installed, the app opens with no signal.
- It saves each session and each new student on the phone first, sends them when a connection returns, and shows how many are waiting.
- The student list stays on the phone for the dropdown and refreshes whenever the app is online.
- The first login needs a connection.

Limits to design around:

- iPhones don't let web apps send data in the background. Waiting sessions go out the next time the doctor opens the app with signal.
- In the Safari browser, iPhones delete a site's stored data after 7 days of Safari use without a visit. Apps on the home screen are exempt, so doctors must install the app and open it from there.
- Safari and the home-screen app keep separate storage, so a doctor who logs in within Safari must log in again in the installed app.
- Two offline doctors can add the same student twice. The add form warns about matching names in the list on the phone.

## What is it built with?

| Part | Choice | Reason |
|---|---|---|
| Language | TypeScript throughout, on Node.js 22 | Catches wrong data shapes before they reach the database |
| Doctor app and dashboard | One React 19 project built with Vite 8 and React Router 8; dashboard pages load only for admins | Reuses the prototype's screens and one login |
| Offline and install | vite-plugin-pwa for the home-screen app; Dexie over IndexedDB for data waiting to send | Common, small tools |
| Server | Fastify 5 with Zod checks on every request | Shares data rules with the app; has a rate-limit plugin for logins |
| Database | PostgreSQL with Drizzle ORM | Suits linked records and reports; migrations are plain SQL files |
| Login | Argon2id password hashes, passwords of at least 15 characters, and a login cookie checked against the database | Follows current NIST and OWASP guidance with no outside login service |
| Charts | Recharts | Covers ratings over time and weekly activity |
| Tests | Vitest, React Testing Library, Playwright on phone Chromium, phone WebKit and desktop Chromium | Unit, server, screen and full-flow tests in one toolchain |

`docs/plan/00-allowed-apis.md` lists the exact versions and the functions each tool may be used through.

The server also serves the built app, so the app, dashboard and API share one address and one deployment.

Folders: `app/` (doctor app and dashboard), `server/`, and `shared/` (data rules both sides use). `prototype/`, `design/` and `docs/` stay as they are.

## Where does it run?

On DigitalOcean, paid by Prof. Muneeza. We open the account before launch; everything before launch runs on our own machines and in GitHub checks.

- **App Platform** runs the server on a 1 GB instance: $12 a month.
- **Managed PostgreSQL** holds the data, with daily backups kept 7 days: from $15 a month.
- The app starts on a free `ondigitalocean.app` address with HTTPS, which a PWA needs. A custom domain can come later.
- Each push to `main` in `sadiash/omp-digicoach` deploys automatically, after the database migration runs.

Expect about $27 a month.

## In what order do we build it?

`docs/plan/` holds the development and testing plan: the phases, which work runs in parallel, and how each part is tested.

## What is left out of the first release?

Merging duplicate students, a second hospital, and downloads with names replaced by codes.

## Sources

- [DigitalOcean App Platform pricing](https://www.digitalocean.com/pricing/app-platform)
- [App Platform pricing details](https://docs.digitalocean.com/products/app-platform/details/pricing/)
- [Safari's 7-day storage cap and home-screen apps](https://mjtsai.com/blog/2020/03/26/safari-13-1-third-party-cookie-blocking-and-7-day-script-writeable-storage/)
- [PWA limits on iOS](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
