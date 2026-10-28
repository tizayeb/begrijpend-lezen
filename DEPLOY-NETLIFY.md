# Deploy to Netlify

The app is a full Next.js server app (API routes, database, auth), so it needs the
**Netlify Next.js adapter** (built in) plus a **hosted Postgres** database — the SQLite
file cannot live on Netlify's servers.

## 1. Put the code on GitHub

```bash
cd web
git init
git add .
git commit -m "Begrijpend Lezen MVP"
git branch -M main
git remote add origin git@github.com:<your-user>/<your-repo>.git
git push -u origin main
```

## 2. Create a hosted Postgres database

Pick one (all have free tiers):

- **Neon**: https://neon.tech → new project → copy the connection string
  (`postgresql://user:pass@host/db?sslmode=require`)
- **Supabase**: create project → Settings → Database → URI (use the "Session pooler" URI)

## 3. Point Prisma at Postgres

In `web/prisma/schema.prisma` change the datasource, **then push the schema to Postgres):

```bash
npx prisma migrate deploy   # uses DATABASE_URL from your environment
```

Then seed the demo data if you want the example exercises:

```bash
npx tsx prisma/seed.ts
```

## 4. Create the Netlify site

1. Go to https://app.netlify.com → **Add new site → Import an existing project → GitHub**,
   authorize and pick your repo.
2. Netlify auto-detects Next.js. Settings to confirm (Site configuration → Build & deploy):
   - Build command: `npm run build`
   - Publish directory: `.next`
3. **Environment variables** (Site configuration → Environment variables), add:
   - `DATABASE_URL` = your Postgres connection string
   - `AUTH_SECRET` = a long random string (run `openssl rand -hex 32`)
4. Deploy.

## 5. Verify

- Open your `https://<site>.netlify.app` → login page should load.
- Log in with a demo account (`leerling@demo.nl` / `welkom123`) — works only if you
  seeded the Postgres DB in step 3.
- Start + submit an exercise to confirm the grader round-trips through the database.

## Notes and gotchas

- **Locale**: the second `npm install` (build step) runs `prisma generate` automatically
  via dependencies; no extra setup needed.
- **Keep secrets out of git**: `web/.env` is already git-ignored. Both `DATABASE_URL`
  and `AUTH_SECRET` live in Netlify's env-var settings only.
- **Run migrations after future edits**: whenever you change the schema, run
  `npx prisma migrate dev` locally to create a migration, commit it, and run
  `npx prisma migrate deploy` against the Postgres URL once
  (locally with the env var set, or make it part of the build command:
  `npx prisma migrate deploy && npm run build`).
- **Session cookies**: in production the app sets `secure: true` on the session cookie,
  which works automatically over your HTTPS Netlify URL.
- The free Netlify tier supports this app fine for a family-sized user base; the Next.js
  runtime uses Netlify Functions under the hood.
