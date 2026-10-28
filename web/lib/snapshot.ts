import { prisma } from "@/lib/db";
import type { QuestionData } from "@/lib/grading/types";

export interface AttemptSnapshot {
  title: string;
  body: string;
  headings: string[];
  questions: (QuestionData & { options: { id: string; order: number; text: string }[] })[];
}

export async function buildSnapshot(passageId: string): Promise<AttemptSnapshot> {
  const passage = await prisma.readingPassage.findUniqueOrThrow({
    where: { id: passageId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          skill: true,
          options: { orderBy: { order: "asc" } },
          rubric: true,
        },
      },
    },
  });
  return {
    title: passage.title,
    body: passage.body,
    headings: safeJson<string[]>(passage.headings) ?? [],
    questions: passage.questions.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      skillKey: q.skill.key,
      mcAnswerKey: q.mcAnswerKey,
      modelAnswer: q.modelAnswer,
      requireTwoArguments: q.requireTwoArguments,
      requireEvidence: q.requireEvidence,
      requireCompleteSentences: q.requireCompleteSentences,
      rubric: q.rubric
        ? {
            keywordGroups: safeJson<string[][]>(q.rubric.keywordGroups) ?? [],
            minChars: q.rubric.minChars,
            fullCreditRule: q.rubric.fullCreditRule,
          }
        : null,
      options: q.options.map((o) => ({ id: o.id, order: o.order, text: o.text })),
    })),
  };
}

export function safeJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
