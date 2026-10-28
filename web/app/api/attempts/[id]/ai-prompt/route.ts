import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, canViewStudent } from "@/lib/auth";
import { fail } from "@/lib/api";
import { buildAssessmentPrompt } from "@/lib/ai-prompt";
import type { AttemptSnapshot } from "@/lib/snapshot";

/** Export a ready-to-paste AI assessment prompt (parents + admins; not students: no keys). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();
    const attempt = await prisma.exerciseAttempt.findUnique({ where: { id } });
    if (!attempt) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
    if (
      attempt.status !== "SUBMITTED" ||
      !(user.role === "ADMIN" || (await canViewStudent(user.id, user.role, attempt.studentId)))
    ) {
      return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
    }
    const snapshot = JSON.parse(attempt.snapshot) as AttemptSnapshot;
    const answers = await prisma.studentAnswer.findMany({ where: { attemptId: id } });
    const prompt = buildAssessmentPrompt(
      snapshot,
      answers.map((a) => ({ questionId: a.questionId, mcChoiceId: a.mcChoiceId, text: a.text }))
    );
    return NextResponse.json({ prompt });
  } catch (e) {
    return fail(e);
  }
}
