import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/api";
import { gradeAttempt } from "@/lib/grading/service";

/** Submit for grading. Idempotent: a submitted attempt is terminal. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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
    const graded = await gradeAttempt(id);
    return NextResponse.json({
      attemptId: graded.id,
      scorePct: graded.scorePct,
      score: graded.score,
    });
  } catch (e) {
    return fail(e);
  }
}
