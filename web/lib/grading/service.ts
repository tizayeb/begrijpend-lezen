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
