import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail } from "@/lib/api";

/** Admin: duplicate a passage (incl. questions/options/rubric) as a draft copy. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const source = await prisma.readingPassage.findUnique({
      where: { id },
      include: {
        questions: { include: { options: true, rubric: true } },
      },
    });
    if (!source) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });

    const { createPassage } = await import("@/lib/passage-create");
    const skillRows = await prisma.learningSkill.findMany();
    const keyById = new Map(skillRows.map((s) => [s.id, s.key]));

    // Build a PassagePayload voice of the source, dedupe title.
    let title = `${source.title} (kopie)`;
    let n = 2;
    while (await prisma.readingPassage.findFirst({ where: { title } })) {
      title = `${source.title} (kopie ${n++})`;
    }

    const payload = {
      title,
      topic: source.topic,
      difficulty: source.difficulty,
      estMinutes: source.estMinutes,
      body: source.body,
      headings: JSON.parse(source.headings || "[]"),
      objectives: JSON.parse(source.objectives || "[]"),
      questions: source.questions
        .sort((a, b) => a.order - b.order)
        .map((q) => ({
          type: q.type,
          prompt: q.prompt,
          skillKey: keyById.get(q.skillId) ?? "explicit_information",
          mcAnswerKey: q.mcAnswerKey,
          modelAnswer: q.modelAnswer,
          requireTwoArguments: q.requireTwoArguments,
          requireEvidence: q.requireEvidence,
          requireCompleteSentences: q.requireCompleteSentences,
          options: q.options.sort((a, b) => a.order - b.order).map((o) => o.text),
          rubric: q.rubric
            ? {
                keywordGroups: JSON.parse(q.rubric.keywordGroups || "[]"),
                minChars: q.rubric.minChars,
                fullCreditRule: q.rubric.fullCreditRule,
              }
            : null,
        })),
    };
    const copy = await createPassage(payload as never, admin.id);
    return NextResponse.json({ ok: true, id: copy.id, title });
  } catch (e) {
    return fail(e);
  }
}
