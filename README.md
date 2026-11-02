# StudyFlow + Supabase (GitHub Pages)

This build keeps the static GitHub Pages frontend and replaces the PHP backend with Supabase Auth + Postgres.

## 1. Supabase SQL

1. Open the StudyFlow project in Supabase.
2. Open **SQL Editor** → **New query**.
3. Copy all of `supabase/schema.sql` into the editor and click **Run**.
4. Confirm that the `homework` and `user_profiles` tables exist in Table Editor.

The SQL enables Row Level Security (RLS), grants only the operations used by the site, and creates policies so each signed-in user can access only their own records.

## 2. Supabase Auth settings

In **Authentication → URL Configuration**:

- Site URL: `https://chakris13.github.io/StudyFlow-Demo/`
- Add Redirect URL: `https://chakris13.github.io/StudyFlow-Demo/**`
- For local VS Code Live Server testing, optionally add `http://localhost:5500/**` and `http://127.0.0.1:5500/**`.

In **Authentication → Sign In / Providers → Email**, enable Email. Keep email confirmation enabled for production. The user must confirm their email before the first login if confirmation is enabled.

The existing guest button uses Supabase **Anonymous Sign-Ins**. Enable it under Authentication settings only if you want to keep guest access. Anonymous guest accounts are tied to that browser session; they cannot reliably be recovered on a different device or after browser data is cleared.

## 3. Publish to the existing GitHub repository

1. Extract this ZIP.
2. Replace the files at the root of your existing `StudyFlow-Demo` GitHub repository with the extracted files. Keep the `supabase` folder.
3. Commit and push to the same repository/branch used by GitHub Pages.
4. Open the existing site URL. No hosting migration is required.

The obsolete PHP files have been removed because GitHub Pages cannot execute PHP.

## 4. First test

1. Open the GitHub Pages URL.
2. Register using an email address and a password of at least 8 characters.
3. Confirm the email if confirmation is enabled.
4. Sign in, add homework, open View Homework, and test Complete → Submit and Delete.
5. Create a second account and verify it cannot see the first account's homework.

## Notes / limitations

- Supabase Auth uses email + password. The old PHP field accepted arbitrary student IDs; those IDs cannot be used as passwords/logins without building a separate secure identity-mapping service. This frontend therefore changes the login field to Email.
- Old PHP password hashes and server-side `users.json` / profile files are not imported. Register new accounts in Supabase. No old private data file was included in the supplied ZIP.
- This ZIP uses the project URL and Publishable Key in `supabase-client.js`. These are intended for browser use. Never add a Secret Key or `service_role` key to the repository.
- The Score page is now stored as an `exam` record in the same `homework` table, including test date and score fields.
