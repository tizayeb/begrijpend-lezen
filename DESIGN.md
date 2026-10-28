# Begrijpend Lezen — Design Document & Requirements Summary

## 1. Requirements Summary & Assumptions

**Goal:** A web platform helping Dutch primary-school students (default: Groep 8, 11–12
years) practise reading comprehension (*begrijpend lezen*) with passages, questions,
automated grading, feedback, and personalized recommendations. Parents review progress;
administrators author and manage exercises.

**MVP scope decisions (per PRD §9):** passage library, ~10 questions/exercise, MC +
open-ended questions, submission, automated grading with partial credit + explanations,
results page with 3 recommendations, basic parent dashboard, admin CRUD, secure storage.

### Assumptions
1. **No AI in the MVP** (confirmed by product owner). Grading is a deterministic engine:
   exact/semantic rules for MC questions, rubric-based keyword/coverage scoring for
   open-ended questions. The engine sits behind a `GradingProvider` interface so an AI
   provider (OpenAI-compatible adapter) can be added later without touching UI or data.
2. Parent/student live in the same household; a parent links student accounts to a child
   account. There is no email verification infrastructure in the MVP.
3. Single-tenant deployment; PostgreSQL is the production target but SQLite is used for
   MVP/local development (swap via Prisma datasource + `DATABASE_URL`).
4. Dutch is the student-facing UI language; admin-facing copy may be English/Dutch mix.
5. One exercise "attempt" records a version snapshot of passage/questions/rubric
   (denormalized JSON) so historical scores remain interpretable after edits.
6. No ads, no tracking, no external calls with student data — student answers never leave
   the server in the MVP (nothing calls external services).

## 2. Architecture & Key Decisions

```
┌──────────────────────────────────────────────────┐
│ Next.js App Router (single deployable)           │
│  • Student UI (Dutch): /bibliotheek, /oefening,  │
│    /resultaten, /voortgang                       │
│  • Parent dashboard: /ouder                      │
│  • Admin: /admin                                 │
│  • Route handlers = REST API (/api/...)          │
├──────────────────────────────────────────────────┤
│ Domain layer (src/lib), framework-agnostic,      │
│ fully unit-testable:                             │
│  • auth/            sessions, RBAC               │
│  • grading/         GradingProvider interface    │
│      └ deterministic/  MC + rubric grader        │
│  • skills/          correctness → skill vector,  │
│                     recommendations             │
│  • scoring/         rubric evaluation            │
│  • snapshot/        attempt version freezing     │
├──────────────────────────────────────────────────┤
│ Prisma + SQLite (dev) / Postgres (prod)          │
└──────────────────────────────────────────────────┘
```

Key decisions:

- **Separation of concerns (PRD §6):** AI-ish logic ("grading provider"), deterministic
  validation (zod-style manual validators), scoring logic, and UI live in separate
  modules. The `GradingProvider` interface makes swapping to AI a new module, not a
  rewrite.
- **Deterministic grading first (owner decision):** MC questions score exactly;
  open-ended questions score against the rubric: required keyword groups, minimum
  reasoning length, whether the requested number of arguments was given, and sentence
  completeness. Score = partial credit 0–100% per question, mirrored to status
  correct/partial/incorrect/unanswered.
- **Snapshots:** every graded attempt stores a JSON snapshot of passage text, questions,
  options and rubric. Editing an exercise never rewrites history.
- **Server-only auth:** bcryptjs password hashing + httpOnly session cookie, in-DB
  sessions, RBAC helpers on every route. No secrets/client-side trust.
- **Privacy:** minimal account data (name, e-mail as login id, role, grade level).
  Student answers are only shown to the student + linked parent + admins. Retention &
  deletion endpoints for parental control.

## 3. Database Schema (Prisma)

- `User(id, email UNIQUE, name, passwordHash, role STUDENT|PARENT|ADMIN, createdAt)`
- `StudentProfile(id, userId UNIQUE FK, groep, defaultDifficulty)`
- `ParentStudentRelationship(id, parentId FK, studentId FK)`
- `ReadingPassage(id, title, topic, difficulty, estMinutes, body, headings JSON, status`
  `DRAFT|PUBLISHED|ARCHIVED, version, authorId FK, createdAt, updatedAt)`
- `Question(id, passageId FK, order, type MC|OPEN, prompt, skill FK, answerKeyForMC,`
  `modelAnswer, requireTwoArguments, requireEvidence, requireCompleteSentences)`
- `AnswerOption(id, questionId FK, order, text)`
- `GradingRubric(id, questionId FK, keywordGroups JSON, minChars, fullCreditRule)`
- `ExerciseAttempt(id, studentId FK, passageId FK, snapshot JSON, status`
  `IN_PROGRESS|SUBMITTED, score, scorePct, startedAt, submittedAt)`
- `StudentAnswer(id, attemptId FK, questionId, mcChoiceId?, text)`
- `Evaluation(id, answerId FK UNIQUE, status CORRECT|PARTIAL|INCORRECT|UNANSWERED,`
  `scorePct, explanation, didWell, needsImprovement, exampleAnswer)`
- `LearningSkill(id, key UNIQUE, label, description)`
- `SkillResult(id, attemptId FK, skillId FK, correct, partial, total)`
- `LearningRecommendation(id, attemptId FK, index, text, skillId FK?)`
- `ContentReview(id, passageId FK, reviewerId FK, verdict APPROVED|CHANGES_REQUESTED,`
  `notes, createdAt)`

## 4. API Endpoints

| Method & path | Role | Purpose |
|---|---|---|
| `POST /api/auth/register` | pub | create account (role student/parent) |
| `POST /api/auth/login` | pub | login (httpOnly cookie) |
| `POST /api/auth/logout` | user | logout |
| `GET /api/me` | user | current user + profile |
| `GET /api/passages` | any | library list w/ filters (topic, difficulty, status) |
| `GET /api/passages/:id` | any | published passage detail (no answer key!) |
| `POST /api/attempts` | student | start attempt (freezes snapshot) |
| `PATCH /api/attempts/:id` | student | autosave answers (partial) |
| `POST /api/attempts/:id/submit` | student | grade & finalize |
| `GET /api/attempts/:id` | owner/parent/admin | attempt + results |
| `GET /api/students/:id/progress` | self/parent/admin | skill vectors + history |
| `POST /api/passages` / `PATCH .../:id` / `DELETE` | admin | CRUD (creates questions/options/rubric) |
| `POST /api/passages/:id/publish` | admin | publish/unpublish/archive |
| `POST /api/parent/link` | parent | link student by email |
| `DELETE /api/parent/students/:id` | parent/ADMIN | unlink (GDPR deletion: answers retained anonymized) |

Grading endpoint is idempotent per attempt (`SUBMITTED` is terminal).

## 5. AI Grading Workflow (MVP: deterministic; AI-ready contract)

`GradingProvider.gradeAnswer(ctx): Promise<EvalResult>` where ctx carries question text,
rubric (keyword groups, min requirements), student answer, model answer and snapshot
passage text.

Steps in the deterministic provider:
1. Empty/whitespace answer -> `UNANSWERED`.
2. Rubric `fullCreditRule` (regex alternation): full credit when it matches. Rubric
   `keywordGroups`: each group is a list of synonyms; score = matchedGroups/totalGroups
   (partial credit).
3. `requireTwoArguments`: counts argument units (two groups required, or two sentences
   with connectives `omdat/daarom/want`); cap score at 60% if the requested number of
   arguments is missing.
4. Sentence completeness: reflected in feedback text, not as a hard penalty (avoid
   overpenalizing spelling or grammar per PRD).
5. If a rubric contains only an "uncertain" model answer (opinion questions) and the
   student produces at least one argument, grade on argument quality only. Answers whose
   rubric coverage is partial are flagged `PARTIAL` with review explanation; answers are
   never silently marked wrong on wording alone (PRD: never require exact match).

Migrating to AI later = implement `OpenAICompatibleProvider` implementing the same
interface returning the same `EvalResult`, with server-side validation clamping score to
rubric bounds and flagging rubric-violating outputs for review.

## 6. Skill Tracking & Recommendations

Each question declares a `skill` (one of: `explicit_information`, `inference`,
`cause_effect`, `main_idea`, `complete_answers`, `evidence`, `number_of_arguments`,
`vocabulary`, `facts_vs_opinions`). After submission we aggregate per skill
(correct/partial/total) and produce:

- strengths (skill â‰¥ 80% correct)
- focus skills (< 50%)
- 3 recommendations generated from rules: e.g. focus `complete_answers` â†’ "Schrijf je
  antwoorden in hele zinnen en geef altijd een reden met 'omdat'".

## 7. Milestones

1. **M1 — Skeleton & auth:** Next.js app, Prisma schema + migration, register/login,
   RBAC middleware.
2. **M2 — Content model & seed:** passages/questions/rubric schema, 2 full Dutch seed
   exercises, admin CRUD API.
3. **M3 — Student flow:** library, attempt with autosave, submission, deterministic
   grader, results page with recommendations.
4. **M4 — Parent dashboard:** linked students, history, answers+feedback review.
5. **M5 — Admin UI + content review:** create/edit/publish, preview, content review
   verdict.
6. **M6 — Tests & polish:** vitest suites for grading, access control, flows; README.

(M1–M6 all implemented; see README for the user guide.)
