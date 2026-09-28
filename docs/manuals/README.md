# User manuals

Two PDF guides, built from `admin.html` and `doctor.html` with `manual.css`.

| Guide | For |
|---|---|
| Admin Guide | The person who runs the dashboard: adding doctors, passwords, reports, export |
| Doctor Guide | Doctors using the phone app |

## Rebuilding them

The screenshots come from the local app with the seeded sample data, never from production.

```bash
npm run db:seed                      # fresh sample data
npm run dev                          # in another terminal
node docs/manuals/capture.mjs        # all screenshots into docs/manuals/shots/
node docs/manuals/build.mjs [folder] # the two PDFs, into docs/manuals/dist/ by default
```

After changing a screen, run `capture.mjs` again, check the text in the HTML still matches the screen, and rebuild.
