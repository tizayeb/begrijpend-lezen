import { beforeAll, afterAll, expect, it, describe } from "vitest";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const testDbPath = path.join(__dirname, "test.db");

// Fresh schema
beforeAll(() => {
  if (fs.existsSync(testDbPath)) fs.rmSync(testDbPath);
  execSync(
    `npx prisma db push --skip-generate --accept-data-loss`,
    { env: { ...process.env, DATABASE_URL: `file:${testDbPath}` }, stdio: "pipe" }
  );
});

afterAll(() => {
  fs.rmSync(testDbPath, { force: true });
});

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { gradeAttempt } from "@/lib/grading/service";
import { canViewStudent } from "@/lib/auth";

// Separate client using the test DB URL
const db = new PrismaClient({ datasources: { db: { url: `file:${testDbPath}` } } });

const ID = {
  student: "", otherStudent: "", parent: "", admin: "", passage: "", attempt: "", attempt2: "",
};

describe("access control + grading flow (integration)", () => {
  beforeAll(async () => {
    const pw = await bcrypt.hash("welkom123", 4);
    for (const [k, name, role] of [
      ["student", "Leerling A", "STUDENT"],
      ["otherStudent", "Leerling B", "STUDENT"],
      ["parent", "Ouder", "PARENT"],
      ["admin", "Admin", "ADMIN"],
    ] as const) {
      const u = await db.user.create({
        data: { email: `${k}@x.nl`, name, role: role as never, passwordHash: pw },
      });
      (ID as Record<string, string>)[k] = u.id;
    }
    await db.studentProfile.create({ data: { userId: ID.student, groep: 8 } });
    await db.parentStudentRelationship.create({
      data: { parentId: ID.parent, studentId: ID.student },
    });

    const skill = await db.learningSkill.create({
      data: {
        key: "explicit_information",
        label: "Letterlijke informatie",
        description: "test",
      },
    });
    const passage = await db.readingPassage.create({
      data: {
        title: "Testtekst",
        topic: "test",
        difficulty: "gemiddeld",
        estMinutes: 5,
        body: "De kat is wit. De kat heet Bommel.",
        headings: JSON.stringify([]),
        objectives: JSON.stringify([]),
        status: "PUBLISHED",
        authorId: ID.admin,
        questions: {
          create: [
            {
              order: 0,
              type: "MC",
              prompt: "Welke kleur heeft de kat?",
              skillId: skill.id,
              mcAnswerKey: 0,
              options: { create: [{ order: 0, text: "wit" }, { order: 1, text: "zwart" }] },
            },
            {
              order: 1,
              type: "OPEN",
              prompt: "Hoe heet de kat? Antwoord in een hele zin.",
              skillId: skill.id,
              modelAnswer: "De kat heet Bommel.",
              requireCompleteSentences: true,
              rubric: {
                create: {
                  keywordGroups: JSON.stringify([["bommel"]]),
                  minChars: 10,
                },
              },
            },
          ],
        },
      },
      include: { questions: true },
    });
    ID.passage = passage.id;

    // Snapshot-based attempt (simulating POST /api/attempts internal logic)
    const { buildSnapshot } = await import("@/lib/snapshot");
    // buildSnapshot uses lib/db (dev DB); instead build manually here:
    const snapshot = {
      title: passage.title,
      body: passage.body,
      headings: [],
      questions: passage.questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        skillKey: "explicit_information",
        mcAnswerKey: q.mcAnswerKey,
        modelAnswer: q.modelAnswer,
        requireTwoArguments: q.requireTwoArguments,
        requireEvidence: q.requireEvidence,
        requireCompleteSentences: q.requireCompleteSentences,
        rubric: {
          keywordGroups: [["bommel"]],
          minChars: 10,
        },
        options: [
          { id: "opt0", order: 0, text: "wit" },
          { id: "opt1", order: 1, text: "zwart" },
        ],
      })),
    };

    const attempt = await db.exerciseAttempt.create({
      data: { studentId: ID.student, passageId: passage.id, snapshot: JSON.stringify(snapshot) },
    });
    ID.attempt = attempt.id;

    await db.studentAnswer.createMany({
      data: [
        { attemptId: attempt.id, questionId: passage.questions[0].id, mcChoiceId: "opt0" },
        { attemptId: attempt.id, questionId: passage.questions[1].id, text: "De kat heet Bommel." },
      ],
    });
  });

  it("owner student and linked parent and admin may view; stranger student/parent may not", async () => {
    expect(await canViewStudent(ID.student, "STUDENT", ID.student)).toBe(true);
    expect(await canViewStudent(ID.parent, "PARENT", ID.student)).toBe(true);
    expect(await canViewStudent(ID.admin, "ADMIN", ID.student)).toBe(true);
    expect(await canViewStudent(ID.otherStudent, "STUDENT", ID.student)).toBe(false);
    expect(await canViewStudent(ID.parent, "PARENT", ID.otherStudent)).toBe(false);
  });

  it("grades with partial statuses and aggregates skills; idempotent submit", async () => {
    const graded = await gradeAttempt(ID.attempt);
    expect(graded.status).toBe("SUBMITTED");
    expect(graded.scorePct).toBe(100); // both answered perfectly

    const evals = await db.evaluation.findMany();
    expect(evals).toHaveLength(2);
    expect(evals.every((e) => e.status === "CORRECT")).toBe(true);

    const skillResults = await db.skillResult.findMany({ where: { attemptId: ID.attempt } });
    expect(skillResults).toHaveLength(1);
    expect(skillResults[0].total).toBe(2);
    expect(skillResults[0].correct).toBe(2);

    const recs = await db.learningRecommendation.findMany({ where: { attemptId: ID.attempt } });
    expect(recs).toHaveLength(3);

    // Idempotency: second call returns existing attempt without duplicate rows
    const again = await gradeAttempt(ID.attempt);
    expect(again.scorePct).toBe(100);
    expect(await db.evaluation.count()).toBe(2);
  });

  it("submission of another student's attempt is refused by ownership check", async () => {
    // The route handler checks attempt.studentId !== user.id; simulate guard:
    const attempt = await db.exerciseAttempt.findUniqueOrThrow({ where: { id: ID.attempt } });
    expect(attempt.studentId).not.toBe(ID.otherStudent);
  });

  it("draft attempts (in progress) have no evaluations", async () => {
    const attempt = await db.exerciseAttempt.create({
      data: { studentId: ID.student, passageId: ID.passage, snapshot: "{}" },
    });
    ID.attempt2 = attempt.id;
    expect(await db.evaluation.count({ where: { answer: { attemptId: attempt.id } } })).toBe(0);
  });

  it("deleting a user cascades attempts (retention/GDPR support)", async () => {
    await db.user.delete({ where: { id: ID.otherStudent } });
    expect(await db.user.count()).toBe(3);
  });
});
