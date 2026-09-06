# Accounts and cloud progress

Yalla uses Supabase Auth for email/password identity and Postgres for per-user progress. The frontend remains on GitHub Pages.

## Project setup

1. Run `supabase/migrations/202609060001_accounts.sql` in the project's Supabase SQL Editor. The migration creates the progress table, access rules, signup trigger, and version-checked save function.
2. Under Authentication → URL Configuration, set the Site URL and add this Redirect URL:
   `https://jonathanshomali.github.io/arabic-app/`
   Add `http://localhost:5173/` for local testing if desired. Avoid broad production wildcards.
3. Keep Confirm email enabled. Under password security, set the server-side minimum password length to 12 characters. The UI requires 12 characters and rejects passwords exceeding bcrypt's 72-byte limit.
4. Configure a production SMTP sender for verification and reset emails. Supabase's default sender is limited to project-team email addresses and is unsuitable for public registration. Do not disable confirmation as a workaround.
5. Set the GitHub Actions repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. These are intentionally public browser configuration. Never use a secret/service-role key here. The build rejects private keys.
6. Push to `main`. GitHub Actions tests and deploys the frontend. Database migrations are applied separately by an authorized database administrator.

## Local development

Copy `.env.example` to `.env.local` and enter the project URL and public publishable key. Local environment files are ignored by Git. When no public configuration exists, guest learning continues to work and the app does not present active account signup.

`npm test` covers guest learning. `npm run test:accounts` uses a separate local Vite server and simulated Supabase API responses to test account flows without sending real emails or modifying live accounts. `npm run test:security` executes the actual migration in an isolated Postgres engine to check access rules and concurrent updates.

## Data and password handling

- Password inputs are masked by default and support password managers. A user can temporarily reveal a password while typing.
- Passwords go directly to Supabase over HTTPS. They are never added to progress, analytics, logs, source code, or browser storage.
- Supabase Auth stores salted bcrypt password hashes. The application table contains no passwords or password hashes.
- The browser SDK stores session credentials to keep users signed in; treat these as authentication credentials. A Content Security Policy restricts scripts and network endpoints.
- Each progress row belongs to `auth.uid()`. Anonymous users cannot read or write rows. Signed-in users can read only their own row.
- Writes use `save_learner_progress`, which takes no user ID and checks a version before saving. Another user's row cannot be targeted.
- Progress is personal learning state, not an anti-cheat or financial ledger. Account owners can change their own progress using the API.

## Sync and guest progress

Guest progress stays under `yalla-progress`. Signing in loads cloud data before enabling learning. Account changes are queued serially and saved with version checks. Pending changes survive reload under a user-specific key; they are never displayed as guest progress or another account's progress. Interrupted/offline saves show a retry state.

If two devices change the same version, Yalla asks which saved version to keep instead of silently overwriting it. Signing out waits for pending writes. Importing guest progress is an explicit action: it combines lessons/favorites and keeps the higher XP, practice, and daily activity totals without counting the same local wins twice.

Verification and password-reset links use PKCE. Open the link in the same browser that requested it. Password reset is completed only in an authenticated recovery session.

## References

- [Supabase password security](https://supabase.com/docs/guides/auth/password-security)
- [Password-based authentication](https://supabase.com/docs/guides/auth/passwords)
- [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Production SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp)
