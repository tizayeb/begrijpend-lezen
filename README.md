# Begrijpend Lezen

AI-ready, MVP learning platform for Dutch reading comprehension (*begrijpend lezen*),
targeted at Dutch primary school (default Groep 8, editable for other groups/levels).

Built with **Next.js 14 (App Router, TypeScript) + Tailwind + Prisma (SQLite in dev,
Postgres-ready in production) + JWT httpOnly-cookie auth (jose/bcrypt)**.
Grading in the MVP is **fully deterministic** (per product-owner decision) and sits behind
a `GradingProvider` interface so an AI provider can be plugged in later without touching
UI, data model, or scoring logic. Full design decisions: [../DESIGN.md](../DESIGN.md).

## Quick start

```bash
cd web
npm install
# Set DATABASE_URL in web/.env to a Postgres connection string
# (e.g. a free Neon project: postgresql://...?sslmode=require)
npx prisma db push          # create/refresh the schema
npm run seed                # 2 complete Dutch exercises + demo users
npm run dev                 # http://localhost:3000
```

Demo accounts (password `welkom123`):

| E-mail | Rol |
|---|---|
| leerling@demo.nl | Student (bibliotheek, oefenen, voortgang) |
| ouder@demo.nl | Parent (dashboard, koppelen leerling, antwoorden + feedback) |
| admin@demo.nl | Admin (oefeningen CRUD, publiceren, review-flow) |

Tests (grading logic, rubric scoring, recommendations, access control, DB flow):

```bash
npm test
```

## MVP in place

- Passage library with topic/difficulty filters, search, estimated reading time, exercise
  status (niet begonnen / in uitvoering / afgerond) and best score.
- Exercise UI: passage with section headings beside questions; requirements printed per
  question (hele zinnen / twee redenen / bewijs uit de tekst); debounced autosave.
- Deterministic grading: MC keyed exactly; open questions scored on rubric keyword
  groups (synonym-aware, so different wording is not punished), optional full-credit
  regex rule, minimum-answer-length guard, argument counting (`omdat/daarom/want…`)
  capped at 60% when the requested number of reasons is missing, and a soft
  evidence-coverage check against the passage. No exact-match requirement on open answers.
- Results page: score + percentage, per-question status badge (Goed / Deels / Fout /
  Niet beantwoord), strengths, and exactly **three** practice recommendations.
- Skill tracking across attempts (9 skills: letterlijke informatie, infereren,
  oorzaak-gevolg, kern/samenvatting, volledige antwoorden, bewijs, aantal argumenten,
  woordenschat, feiten vs. meningen) with strengths/focus views on `/voortgang`.
- Parent dashboard: link a student by e-mail (auto-creates the account if new), browse
  attempt history, open answers + per-question feedback, strengths/attention points.
- Admin: create passages with structured question editor (MC options + keyed answer;
  open questions with rubric keyword-groups, minimum length, full-credit regex, flags),
  publish (blocked when questions < 3 or open questions lack rubrics), unpublish and
  archive; JSON preview endpoint.
- Safety/privacy: role-based access on every route; answer keys are never sent to students
  before submission; attempt snapshots freeze passage/questions/rubric so historical
  scores stay interpretable; only e-mail/name/groep data is stored; no third-party calls,
  no ads, no tracking. Deleting users cascades attempts (GDPR removal support).

## Adding exercises

Go to `/admin` (admin login):

1. Fill title, topic, difficulty, estimated reading time and the Dutch passage text
   (plain paragraphs; lines starting with `## ` become section headings).
2. Add MC questions (mark the correct option with the radio button) and/or open questions.
3. For open questions set: model answer (shown as the example answer after grading),
   rubric keyword groups like `geld, maandelijkse storting | geloofde, vertrouwen`
   (comma = synonyms, `|` separates required points), minimum answer length and optional
   full-credit regex.
4. Save as draft → the publish action blocks publication until content checks pass
   (≥3 questions, rubrics present for open questions). Review the JSON preview before
   publishing.

### Bulk import

The admin screen also has a **Bulk import (JSON)** section:

- Click **Download sample file** for a fully valid template (`web/samples/bulk-import-sample.json`).
- Upload a `.json` file or paste JSON into the textarea and press **Import**.
- Payload shape: either an array of exercises or `{"items": [...]}`; each exercise uses
  the same fields as the manual form (`title, topic, difficulty, estMinutes, body,
  headings, objectives, questions` with `options`/`mcAnswerKey` for MC and
  `rubric`/`modelAnswer`/requirement flags for open questions).
- Server-side validation rejects malformed exercises with a per-item reason, duplicate
  titles are skipped, and everything is imported as **draft** so it can be reviewed and
  published from the exercise table afterwards.

To adjust grading without touching code, only edit the rubric fields; nothing else in
the engine is question-specific.

## Swapping in AI grading later

Implement `GradingProvider` in `web/lib/grading/`
(see `lib/grading/types.ts` — input: passage text + question + rubric + student answer,
output: status/scorePct/explanation/didWell/needsImprovement/exampleAnswer). An
OpenAI-compatible adapter is drop-in; keep credentials server-side only, validate returned
scores against rubric bounds, and flag outputs outside the rubric as `PARTIAL` for review
rather than trusting them blind.

## Project structure

```
web/
  app/            pages (Dutch student UI) + REST route handlers under app/api/**
  components/     shared client components
  lib/            domain layer
    auth.ts       sessions + RBAC helpers
    grading/      GradingProvider contract, deterministic grader, orchestration
    skills.ts     skill catalog + recommendation templates
    snapshot.ts   attempt-snapshot freezing
  prisma/         schema, migrations, seed (2 complete Dutch exercises)
  tests/          vitest: grading unit tests + DB integration (access control, flow)
```
