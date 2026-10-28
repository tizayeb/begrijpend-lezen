import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, canViewStudent } from "@/lib/auth";
import { fail } from "@/lib/api";
import { applyExternalEvaluations } from "@/lib/grading/service";
import type { EvalResult } from "@/lib/grading/types";

/**
 * Import AI-graded results (copied from an external AI) into an attempt.
 * Accepts the exact JSON produced by the prompt from GET .../ai-prompt.
 * Parents (of the student) and admins only.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

    const body = await req.json();
    const results: EvalResult[] = Array.isArray(body) ? body : body?.evaluations;
    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: "Verwacht de JSON-array met evaluaties zoals gevraagd in de prompt." },
        { status: 400 }
      );
    }

    try {
      const out = await applyExternalEvaluations(id, results);
      return NextResponse.json({ ok: true, ...out });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Ongeldige evaluaties." },
        { status: 400 }
      );
    }
  } catch (e) {
    return fail(e);
  }
}
