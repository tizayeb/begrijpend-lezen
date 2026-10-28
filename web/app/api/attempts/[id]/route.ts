export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, canViewStudent } from "@/lib/auth";
import { fail } from "@/lib/api";

/** GET: attempt detail. Submitted attempts include evaluations; drafts never include keys. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();
    const attempt = await prisma.exerciseAttempt.findUnique({ where: { id } });
    if (!attempt) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });

    const allowed =
      user.id === attempt.studentId ||
      user.role === "ADMIN" ||
      (await canViewStudent(user.id, user.role, attempt.studentId));
    if (!allowed) return NextResponse.json({ error: "Geen toegang." }, { status: 403 });

    if (attempt.status !== "SUBMITTED") {
      const answers =
        user.id === attempt.studentId
          ? await prisma.studentAnswer.findMany({ where: { attemptId: id } })
          : null;
      return NextResponse.json({
        attempt: {
          id: attempt.id,
          status: attempt.status,
          studentId: attempt.studentId,
          snapshot: JSON.parse(attempt.snapshot),
          answers,
          scorePct: null,
        },
      });
    }

    const answers = await prisma.studentAnswer.findMany({
      where: { attemptId: id },
      include: { evaluation: true },
    });

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        studentId: attempt.studentId,
        scorePct: attempt.scorePct,
        score: attempt.score,
        submittedAt: attempt.submittedAt,
        snapshot: JSON.parse(attempt.snapshot),
        answers: answers.map((a) => ({
          questionId: a.questionId,
          mcChoiceId: a.mcChoiceId,
          text: a.text,
          evaluation: a.evaluation
            ? {
                status: a.evaluation.status,
                scorePct: a.evaluation.scorePct,
                explanation: a.evaluation.explanation,
                didWell: a.evaluation.didWell,
                needsImprovement: a.evaluation.needsImprovement,
                exampleAnswer: a.evaluation.exampleAnswer,
              }
            : null,
        })),
        skills: await prisma.skillResult.findMany({
          where: { attemptId: id },
          include: { skill: true },
        }),
        recommendations: await prisma.learningRecommendation.findMany({
          where: { attemptId: id },
          orderBy: { index: "asc" },
        }),
      },
    });
  } catch (e) {
    return fail(e);
  }
}

/** PATCH: autosave answers. Students only; upsert answers per question. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();
    const attempt = await prisma.exerciseAttempt.findUnique({ where: { id } });
    if (!attempt) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
    if (attempt.studentId !== user.id) {
      return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
    }
    if (attempt.status === "SUBMITTED") {
      return NextResponse.json({ error: "Deze poging is al ingeleverd." }, { status: 409 });
    }
    const { answers } = (await req.json()) as {
      answers: { questionId: string; mcChoiceId?: string | null; text?: string | null }[];
    };
    if (!Array.isArray(answers)) {
      return NextResponse.json({ error: "Ongeldig formaat." }, { status: 400 });
    }
    const snapshot = JSON.parse(attempt.snapshot) as {
      questions: { id: string }[];
    };
    const validQuestionIds = new Set(snapshot.questions.map((q) => q.id));
    for (const a of answers) {
      if (!validQuestionIds.has(a.questionId)) continue;
      const existing = await prisma.studentAnswer.findFirst({
        where: { attemptId: id, questionId: a.questionId },
      });
      const cleanText = (a.text ?? "").slice(0, 2000);
      if (existing) {
        await prisma.studentAnswer.update({
          where: { id: existing.id },
          data: { mcChoiceId: a.mcChoiceId ?? null, text: cleanText || null },
        });
      } else {
        await prisma.studentAnswer.create({
          data: {
            attemptId: id,
            questionId: a.questionId,
            mcChoiceId: a.mcChoiceId ?? null,
            text: cleanText || null,
          },
        });
      }
    }
    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (e) {
    return fail(e);
  }
}
