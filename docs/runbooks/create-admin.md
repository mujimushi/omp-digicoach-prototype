# Create an admin

## When do I need this?

Once, at launch, for Prof. Muneeza, and again only if every admin account is lost. Admins add doctors from the dashboard; this command is for the first admin.

## How do I run it against production?

1. App Platform → the app → **Console** → choose the `web` component.
2. Run, with her real name and chosen username:

   ```
   npm run create-admin -w server -- --name "Prof. Muneeza Rizwan" --username muneeza
   ```

   This makes an admin account, which opens only the dashboard. Doctors and admins log in separately, so if she also teaches, add a second, doctor account for her from the dashboard, with its own username.
3. The command prints the temporary password once. It writes `audit_log`; it stores only the password's hash.

The console already has `NODE_ENV=production` and the database settings, so the command runs the compiled code against production.

## How do I hand over the password?

**In person or by phone, never by email or chat.** She logs in at the dashboard address, must choose her own password of at least 6 characters, and the temporary one stops working.

## What if the username is taken?

The command stops with "The username … is taken" and changes nothing. Choose another username.
