import { prisma } from "@/lib/db";

export interface QuestionPayload {
  type: "MC" | "OPEN";
  prompt: string;
  skillKey: string;
  mcAnswerKey?: number | null;
  modelAnswer?: string | null;
  requireTwoArguments?: boolean;
  requireEvidence?: boolean;
  requireCompleteSentences?: boolean;
  options?: string[];
  rubric?: {
    keywordGroups?: string[][];
    minChars?: number;
    fullCreditRule?: string | null;
  } | null;
}

export interface PassagePayload {
  title: string;
  topic: string;
  difficulty?: string;
  estMinutes?: number;
  body: string;
  headings?: string[];
  objectives?: string[];
  questions: QuestionPayload[];
}

/** Shared validation errors for passage payloads. */
export function validatePassage(payload: Partial<PassagePayload>): string | null {
  if (!payload.title || typeof payload.title !== "string" || !payload.title.trim()) {
    return "Titel ontbreekt (title).";
  }
  if (!payload.topic || typeof payload.topic !== "string") {
    return `Onderwerp ontbreekt bij '${payload.title}' (topic).`;
  }
  if (!payload.body || typeof payload.body !== "string" || payload.body.trim().length < 50) {
    return `Tekst ontbreekt of is te kort bij '${payload.title}' (body, minimaal 50 tekens).`;
  }
  if (!Array.isArray(payload.questions) || payload.questions.length < 1) {
    return `Vragen ontbreken bij '${payload.title}' (questions).`;
  }
  for (let i = 0; i < payload.questions.length; i++) {
    const q = payload.questions[i];
    if (!q.prompt || typeof q.prompt !== "string") {
      return `Vraag ${i + 1} van '${payload.title}' heeft geen tekst (prompt).`;
    }
    if (!["MC", "OPEN"].includes(q.type)) {
      return `Vraag ${i + 1} van '${payload.title}' heeft een ongeldige type (type: MC of OPEN).`;
    }
    if (q.type === "MC") {
      const options = q.options ?? [];
      if (options.some((o) => !o || typeof o !== "string")) {
        return `Meerkeuzevraag ${i + 1} van '${payload.title}' heeft een lege optie (options).`;
      }
      if (q.mcAnswerKey == null || q.mcAnswerKey < 0 || q.mcAnswerKey >= options.length) {
        return `Meerkeuzevraag ${i + 1} van '${payload.title}' heeft een ongeldig juiste antwoordindex (mcAnswerKey, 0-based).`;
      }
    } else {
      if (!Array.isArray(q.rubric?.keywordGroups) && !q.rubric?.fullCreditRule) {
        return `Open vraag ${i + 1} van '${payload.title}' heeft geen rubriek (rubric.keywordGroups of rubric.fullCreditRule).`;
      }
    }
  }
  return null;
}

/** Create a passage with questions, options and rubrics from a validated payload. */
export async function createPassage(payload: PassagePayload, adminId: string) {
  const skillRows = await prisma.learningSkill.findMany();
  const skillMap = new Map(skillRows.map((s) => [s.key, s.id]));

  return prisma.readingPassage.create({
    data: {
      title: payload.title.trim(),
      topic: payload.topic,
      difficulty: payload.difficulty || "gemiddeld",
      estMinutes: Number(payload.estMinutes) || 10,
      body: payload.body,
      headings: JSON.stringify(payload.headings ?? []),
      objectives: JSON.stringify(payload.objectives ?? []),
      status: "DRAFT",
      version: 1,
      authorId: adminId,
      questions: {
        create: payload.questions.map((q, i) => ({
          order: q.type === "MC" && q.options?.length ? i : i,
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
    include: { questions: true },
  });
}
