export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fail } from "@/lib/api";
import { safeJson } from "@/lib/snapshot";
import { validatePassage, type PassagePayload } from "@/lib/passage-create";

/** Admin: full passage detail for editing (with questions, options, rubrics). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN");
    const { id } = await ctx.params;
    const passage = await prisma.readingPassage.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: { skill: true, options: { orderBy: { order: "asc" } }, rubric: true },
        },
      },
    });
    if (!passage) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
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
        status: passage.status,
        version: passage.version,
        questions: passage.questions.map((q) => ({
          type: q.type,
          prompt: q.prompt,
          skillKey: q.skill.key,
          mcAnswerKey: q.mcAnswerKey,
          modelAnswer: q.modelAnswer,
          requireTwoArguments: q.requireTwoArguments,
          requireEvidence: q.requireEvidence,
          requireCompleteSentences: q.requireCompleteSentences,
          options: q.options.map((o) => o.text),
          rubric: q.rubric
            ? {
                keywordGroups: safeJson<string[][]>(q.rubric.keywordGroups) ?? [],
                minChars: q.rubric.minChars,
                fullCreditRule: q.rubric.fullCreditRule,
              }
            : null,
        })),
      },
    });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Admin: update a passage. Question rows are replaced with the payload;
 * historical attempts remain interpretable via their frozen snapshots.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN");
    const { id } = await ctx.params;
    const payload = (await req.json()) as PassagePayload;
    const error = validatePassage(payload);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const passage = await prisma.readingPassage.findUnique({ where: { id } });
    if (!passage) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });

    const skillRows = await prisma.learningSkill.findMany();
    const skillMap = new Map(skillRows.map((s) => [s.key, s.id]));

    await prisma.question.deleteMany({ where: { passageId: id } });
    const updated = await prisma.readingPassage.update({
      where: { id },
      data: {
        title: payload.title.trim(),
        topic: payload.topic,
        difficulty: payload.difficulty || "gemiddeld",
        estMinutes: Number(payload.estMinutes) || 10,
        body: payload.body,
        headings: JSON.stringify(payload.headings ?? []),
        objectives: JSON.stringify(payload.objectives ?? []),
        version: passage.version + 1,
        questions: {
          create: payload.questions.map((q, i) => ({
            order: i,
            type: q.type,
            prompt: q.prompt,
            skillId: skillMap.get(q.skillKey) ?? skillMap.get("explicit_information")!,
            mcAnswerKey: q.mcAnswerKey ?? null,
            modelAnswer: q.modelAnswer ?? null,
            requireTwoArguments: q.requireTwoArguments ?? false,
            requireEvidence: q.requireEvidence ?? false,
            requireCompleteSentences: q.requireCompleteSentences ?? false,
            options: q.options
              ? { create: q.options.map((text: string, j: number) => ({ order: j, text })) }
              : undefined,
            rubric: q.rubric
              ? {
                  create: {
                    keywordGroups: JSON.stringify(q.rubric.keywordGroups ?? []),
                    minChars: q.rubric.minChars ?? 20,
                    fullCreditRule: q.rubric.fullCreditRule ?? null,
                  },
                }
              : undefined,
          })),
        },
      },
    });
    return NextResponse.json({ ok: true, version: updated.version });
  } catch (e) {
    return fail(e);
  }
}
