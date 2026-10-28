export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { fail } from "@/lib/api";
import { safeJson } from "@/lib/snapshot";

/** Published passage detail. The answer key is NEVER included for students. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const user = await getSessionUser();
    const passage = await prisma.readingPassage.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: { skill: true, options: { orderBy: { order: "asc" } } },
        },
      },
    });
    if (!passage || (passage.status !== "PUBLISHED" && (!user || user.role !== "ADMIN"))) {
      return NextResponse.json({ error: "Oefening niet gevonden." }, { status: 404 });
    }
    return NextResponse.json({
      passage: {
        id: passage.id,
        title: passage.title,
        topic: passage.topic,
        difficulty: passage.difficulty,
        estMinutes: passage.estMinutes,
        body: passage.body,
        headings: safeJson<string[]>(passage.headings) ?? [],
        objectives: safeJson<string[]>(passage.objectives) ?? [],
        questions: passage.questions.map((q) => ({
          id: q.id,
          order: q.order,
          type: q.type,
          prompt: q.prompt,
          skillLabel: q.skill.label,
          requireTwoArguments: q.requireTwoArguments,
          requireEvidence: q.requireEvidence,
          requireCompleteSentences: q.requireCompleteSentences,
          options: q.options.map((o) => ({ id: o.id, order: o.order, text: o.text })),
        })),
      },
    });
  } catch (e) {
    return fail(e);
  }
}
