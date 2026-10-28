export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, canViewStudent } from "@/lib/auth";
import { fail } from "@/lib/api";

/** Progress overview: attempts history + aggregated skills (all submitted attempts). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();
    if (!(await canViewStudent(user.id, user.role, id))) {
      return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
    }
    const attempts = await prisma.exerciseAttempt.findMany({
      where: { studentId: id, status: "SUBMITTED" },
      orderBy: { submittedAt: "asc" },
      include: { passage: { select: { title: true, topic: true } } },
    });

    // Aggregated skills over all attempts
    const skillRows = await prisma.skillResult.findMany({
      where: { attemptId: { in: attempts.map((a) => a.id) } },
      include: { skill: true },
    });
    const agg: Record<string, { label: string; correct: number; partial: number; total: number }> = {};
    for (const s of skillRows) {
      agg[s.skill.key] ??= { label: s.skill.label, correct: 0, partial: 0, total: 0 };
      agg[s.skill.key].correct += s.correct;
      agg[s.skill.key].partial += s.partial;
      agg[s.skill.key].total += s.total;
    }
    const skills = Object.entries(agg).map(([key, v]) => ({
      key,
      label: v.label,
      pct: v.total ? Math.round(((v.correct + v.partial * 0.5) / v.total) * 100) : 0,
      totalQuestions: v.total,
    }));

    const line = attempts.map((a) => ({
      attemptId: a.id,
      title: a.passage.title,
      topic: a.passage.topic,
      scorePct: a.scorePct,
      score: a.score,
      submittedAt: a.submittedAt,
    }));

    return NextResponse.json({
      attempts: line,
      skills,
      latestRecommendations: (
        await prisma.learningRecommendation.findMany({
          where: { attemptId: attempts.at(-1)?.id },
          orderBy: { index: "asc" },
        })
      ).map((r) => r.text),
    });
  } catch (e) {
    return fail(e);
  }
}
