import { prisma } from "@/lib/db";
import { gradingProvider } from "@/lib/grading/deterministic";
import type { AttemptSnapshot } from "@/lib/snapshot";
import type { EvalResult, QuestionData } from "@/lib/grading/types";
import { RECOMMENDATION_MAP, type SkillKey } from "@/lib/skills";

export interface SkillAgg {
  correct: number;
  partial: number;
  total: number;
}

export async function gradeAttempt(attemptId: string) {
  const attempt = await prisma.exerciseAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { answers: true },
  });
  if (attempt.status === "SUBMITTED") return attempt;
  const snapshot = JSON.parse(attempt.snapshot) as AttemptSnapshot;

  let totalPct = 0;
  for (const q of snapshot.questions) {
    const answer = attempt.answers.find((a) => a.questionId === q.id);
    const result = await gradingProvider.gradeAnswer({
      passageText: snapshot.body,
      question: q,
      answer: {
        questionId: q.id,
        mcChoiceId: answer?.mcChoiceId ?? null,
        text: answer?.text ?? null,
      },
    });
    const evalData = mapEval(result, q);
    if (!answer) {
      const created = await prisma.studentAnswer.create({
        data: { attemptId: attempt.id, questionId: q.id, text: null },
      });
      await prisma.evaluation.create({ data: { answerId: created.id, ...evalData } });
    } else {
      await prisma.evaluation.upsert({
        where: { answerId: answer.id },
        update: evalData,
        create: { answerId: answer.id, ...evalData },
      });
    }
    totalPct += result.scorePct;
  }

  const scorePct = snapshot.questions.length
    ? Math.round((totalPct / snapshot.questions.length) * 10) / 10
    : 0;

  const answered = await prisma.studentAnswer.findMany({
    where: { attemptId: attempt.id },
    include: { evaluation: true },
  });
  const agg = aggregateSkills(snapshot, answered);

  for (const [skillKey, a] of Object.entries(agg)) {
    const skill = await prisma.learningSkill.findUnique({ where: { key: skillKey } });
    if (!skill) continue;
    await prisma.skillResult.create({
      data: {
        attemptId: attempt.id,
        skillId: skill.id,
        correct: a.correct,
        partial: a.partial,
        total: a.total,
      },
    });
  }

  const recommendations = buildRecommendations(agg);
  for (let i = 0; i < recommendations.length; i++) {
    await prisma.learningRecommendation.create({
      data: {
        attemptId: attempt.id,
        index: i,
        text: recommendations[i].text,
        skillKey: recommendations[i].skillKey ?? null,
      },
    });
  }

  return prisma.exerciseAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "SUBMITTED",
      scorePct,
      score: Math.round(((scorePct / 100) * snapshot.questions.length) * 10) / 10,
      submittedAt: new Date(),
    },
    include: { answers: { include: { evaluation: true } } },
  });
}

const VALID_STATUSES = ["CORRECT", "PARTIAL", "INCORRECT", "UNANSWERED"];

const STATUS_SCORE_RANGE: Record<string, [number, number]> = {
  CORRECT: [95, 100],
  PARTIAL: [40, 94],
  INCORRECT: [0, 39],
  UNANSWERED: [0, 0],
};

/**
 * Applies externally graded results (e.g. from an AI the parent used via the
 * exported prompt) to a SUBMITTED attempt, then rebuilds score, skill results
 * and recommendations. Throws Error with a Dutch message on invalid input.
 */
export async function applyExternalEvaluations(attemptId: string, results: EvalResult[]) {
  const attempt = await prisma.exerciseAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { answers: true },
  });
  if (attempt.status !== "SUBMITTED") {
    throw new Error("Alleen ingeleverde pogingen kunnen bijgewerkt worden.");
  }
  const snapshot = JSON.parse(attempt.snapshot) as AttemptSnapshot;

  const byId = new Map(
    results.map((r, i) => [String((r as { questionId?: unknown })?.questionId ?? ""), { r, i }] as const)
  );
  const unknown = Array.from(byId.keys()).filter((qid) => !snapshot.questions.some((q) => q.id === qid));
  if (unknown.length > 0) {
    throw new Error(`Onbekende vraag-id's: ${unknown.slice(0, 3).join(", ")}`);
  }

  // Build the fully corrected evaluation set first; only write when all rows are valid.
  type EvalRow = {
    status: string;
    scorePct: number;
    explanation: string;
    didWell: string;
    needsImprovement: string;
    exampleAnswer: string;
    questionId: string;
  };
  const rows: EvalRow[] = [];
  for (const q of snapshot.questions) {
    const entry = byId.get(q.id);
    if (!entry) throw new Error(`Vraag ontbreekt in de resultaten: ${q.id.slice(0, 8)}…`);
    const r = entry.r as Partial<EvalResult>;
    const status = String(r.status ?? "");
    if (!VALID_STATUSES.includes(status)) {
      throw new Error(
        `Ongeldige status bij vraag ${snapshot.questions.indexOf(q) + 1}: "${status}". Toegestaan: ${VALID_STATUSES.join(", ")}.`
      );
    }
    const scorePct = Math.round(Number(r.scorePct));
    const [lo, hi] = STATUS_SCORE_RANGE[status];
    if (!Number.isFinite(scorePct) || scorePct < lo || scorePct > hi) {
      throw new Error(
        `scorePct bij vraag ${snapshot.questions.indexOf(q) + 1} (${scorePct}) past niet bij status ${status} (verwacht ${lo}-${hi}).`
      );
    }
    let explanation = String(r.explanation ?? "").trim();
    if (!explanation) {
      explanation =
        status === "CORRECT"
          ? "Je antwoord is goed!"
          : status === "PARTIAL"
            ? "Je bent op de goede weg, maar het antwoord is nog niet compleet."
            : status === "UNANSWERED"
              ? "Je hebt deze vraag niet beantwoord."
              : "Dit antwoord klopt niet met de tekst.";
    }
    rows.push({
      status,
      scorePct,
      explanation,
      didWell: String(r.didWell ?? "-").trim() || "-",
      needsImprovement: String(r.needsImprovement ?? "-").trim() || "-",
      exampleAnswer: String(r.exampleAnswer ?? "").trim() || q.modelAnswer || "",
      questionId: q.id,
    });
  }

  // Upsert answers + evaluations.
  let totalPct = 0;
  for (const row of rows) {
    const evalData = {
      status: row.status as "CORRECT" | "PARTIAL" | "INCORRECT" | "UNANSWERED",
      scorePct: row.scorePct,
      explanation: row.explanation,
      didWell: row.didWell,
      needsImprovement: row.needsImprovement,
      exampleAnswer: row.exampleAnswer,
    };
    let answer = attempt.answers.find((a) => a.questionId === row.questionId);
    if (!answer) {
      answer = await prisma.studentAnswer.create({
        data: { attemptId: attempt.id, questionId: row.questionId, text: null },
      });
    }
    await prisma.evaluation.upsert({
      where: { answerId: answer.id },
      update: evalData,
      create: { answerId: answer.id, ...evalData },
    });
    totalPct += row.scorePct;
  }

  // Rebuild score, skill results and recommendations.
  const scorePct = snapshot.questions.length
    ? Math.round((totalPct / snapshot.questions.length) * 10) / 10
    : 0;

  const answered = await prisma.studentAnswer.findMany({
    where: { attemptId: attempt.id },
    include: { evaluation: true },
  });
  const agg = aggregateSkills(snapshot, answered);

  await prisma.skillResult.deleteMany({ where: { attemptId: attempt.id } });
  for (const [skillKey, a] of Object.entries(agg)) {
    const skill = await prisma.learningSkill.findUnique({ where: { key: skillKey } });
    if (!skill) continue;
    await prisma.skillResult.create({
      data: {
        attemptId: attempt.id,
        skillId: skill.id,
        correct: a.correct,
        partial: a.partial,
        total: a.total,
      },
    });
  }

  await prisma.learningRecommendation.deleteMany({ where: { attemptId: attempt.id } });
  const recommendations = buildRecommendations(agg);
  for (let i = 0; i < recommendations.length; i++) {
    await prisma.learningRecommendation.create({
      data: {
        attemptId: attempt.id,
        index: i,
        text: recommendations[i].text,
        skillKey: recommendations[i].skillKey ?? null,
      },
    });
  }

  return prisma.exerciseAttempt.update({
    where: { id: attempt.id },
    data: {
      scorePct,
      score: Math.round((scorePct / 100) * snapshot.questions.length * 10) / 10,
    },
    include: { answers: { include: { evaluation: true } } },
  });
}

function aggregateSkills(
  snapshot: AttemptSnapshot,
  answers: { questionId: string; evaluation: { status: string } | null }[]
): Record<string, SkillAgg> {
  const agg: Record<string, SkillAgg> = {};
  for (const q of snapshot.questions) {
    const key = q.skillKey || "explicit_information";
    agg[key] ??= { correct: 0, partial: 0, total: 0 };
    agg[key].total += 1;
    const ev = answers.find((a) => a.questionId === q.id)?.evaluation;
    if (!ev) continue;
    if (ev.status === "CORRECT") agg[key].correct += 1;
    else if (ev.status === "PARTIAL") agg[key].partial += 1;
  }
  return agg;
}

export function buildRecommendations(agg: Record<string, SkillAgg>) {
  const scored = Object.entries(agg)
    .map(([key, v]) => ({
      key,
      pct: v.total ? ((v.correct + v.partial * 0.5) / v.total) * 100 : 0,
    }))
    .filter((s) => s.key in RECOMMENDATION_MAP && s.pct < 70)
    .sort((a, b) => a.pct - b.pct);
  const recs: { text: string; skillKey: string | null }[] = scored.slice(0, 3).map((s) => ({
    text: RECOMMENDATION_MAP[s.key as SkillKey],
    skillKey: s.key,
  }));
  const fillers: { text: string; skillKey: string | null }[] = [
    {
      text: "Doe de volgende oefening op een ander thema, zodat je breder oefent.",
      skillKey: null,
    },
    {
      text: "Oefen de komende week elke dag één oefening, ook als die kort is.",
      skillKey: null,
    },
  ];
  while (recs.length < 3) {
    recs.push(fillers[recs.length] ?? { text: "Blijf oefenen, je gaat vooruit!", skillKey: null });
  }
  return recs.slice(0, 3);
}

function mapEval(result: EvalResult, q: QuestionData) {
  return {
    status: result.status,
    scorePct: result.scorePct,
    explanation: result.explanation,
    didWell: result.didWell,
    needsImprovement: result.needsImprovement,
    exampleAnswer: result.exampleAnswer || q.modelAnswer || "",
  };
}
