# Phase 8: Pilot and launch

**Read first:** `docs/build-plan.md`, `docs/plan/README.md`, `docs/runbooks/` (written in phases 4E and 7).
**Depends on:** phase 7 (production running, admin account created, restore drill done).
**Runs:** in order, after everything else.

## What happens in this phase?

1. **Prepare the doctors.** Write a one-page guide: installing the app (iPhone: Share, then Add to Home Screen; Android: Install app), running a session, rating, the quick log, and what the waiting count means. Password resets go to Prof. Muneeza.
2. **Check the study rules.** Confirm students have been told about the app in the way the ethics approval requires.
3. **Pilot.** Two doctors use the app on real ward rounds for one week.
4. **Watch the pilot daily.** On the dashboard, check that sessions arrive, that none waits on a phone for more than a day, and that ratings and extra time look sensible. Read the server error log.
5. **Collect feedback** on day 3 and day 7: what slowed them down, anything lost, anything confusing.
6. **Fix.** Sort findings into "before launch" and "later". Each fix goes through a pull request and the full CI run, and is deployed outside ward hours.
7. **Launch.** The admin registers the remaining doctors. Everyone installs the app in one 30-minute session with you present, and records one practice session that is deleted afterwards.
8. **Hand over.** Prof. Muneeza adds a doctor, resets a password, prints a student report and downloads the CSV herself, with you watching.

## Checklist: pilot

- [ ] Both pilot doctors opened the app from the home screen, not from a Safari or Chrome tab.
- [ ] At least 10 real sessions recorded.
- [ ] Every evening, each pilot phone's waiting count is zero.
- [ ] One session recorded with no signal arrived on the dashboard once the phone was back online.
- [ ] The CSV opens with correct names, dates and ratings in Excel and in SPSS.
- [ ] No unhandled server errors in the logs, or each one has a fix under way.

## Checklist: launch

- [ ] All "before launch" pilot items are fixed and deployed.
- [ ] Practice and test sessions are removed from production.
- [ ] Every doctor has logged in once and chosen their own password.
- [ ] Prof. Muneeza has done each admin task herself.
- [ ] Support is agreed: who answers questions, and how fast.

## During the study

- **Weekly:** confirm the day's backup exists, read the error log, check the dashboard for doctors whose sessions stopped arriving.
- **Monthly:** update dependencies on a branch and run the full test suite before deploying.
- **Any change:** a small release through CI, deployed outside ward hours, with the database migration tested on a copy of production data first.
- **End of study:** export the final CSV, keep a database backup as the ethics approval requires, then switch the app off.

## Done when

- The pilot doctors' sessions appear correctly on the dashboard and in the CSV.
- All doctors are registered and have logged in.
- Prof. Muneeza has run every admin task on her own.
