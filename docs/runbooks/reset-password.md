# Reset a password

## How does the admin reset a doctor's password?

1. Dashboard → **Doctors** → the doctor's name → **Edit**.
2. Choose **Reset password** and confirm.
3. The new temporary password is shown once. Give it in person or by phone, never by email or chat.

The reset ends all of that doctor's logins on every phone and computer, clears any lock from failed logins, and records the reset in `audit_log`. At their next login the doctor must choose a new password.

**Anything waiting to send on the doctor's phone is kept.** It sends after they log in again on that phone.

## What if the admin is locked out?

Failed logins lock a username for a short time that doubles with each failure, up to 15 minutes. Waiting that long and trying again with the right password works.

If the admin's password is lost:

1. Create a second admin from the App Platform console, following `create-admin.md`, for example with the username `admin.recovery`.
2. Log in to the dashboard as that admin and reset the first admin's password as above.
3. Once the first admin has logged in with a new password, they switch `admin.recovery` off from the dashboard.
