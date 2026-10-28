"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/components/LanguageProvider";

interface Eval {
  status: "CORRECT" | "PARTIAL" | "INCORRECT" | "UNANSWERED";
  scorePct: number;
  explanation: string;
  didWell: string;
  needsImprovement: string;
  exampleAnswer: string;
}

interface AttemptResult {
  id: string;
  status: string;
  scorePct: number | null;
  score: number | null;
  snapshot: {
    title: string;
    body: string;
    questions: {
      id: string;
      type: "MC" | "OPEN";
      prompt: string;
      options: { id: string; order: number; text: string }[];
      modelAnswer?: string | null;
    }[];
  };
  answers: {
    questionId: string;
    mcChoiceId: string | null;
    text: string | null;
    evaluation: Eval | null;
  }[];
  skills: { skill: { label: string }; correct: number; partial: number; total: number }[];
  recommendations: { index: number; text: string }[];
}

export default function ResultaatPage() {
  const { t } = useI18n();
  const [data, setData] = useState<AttemptResult | null>(null);
  const [error, setError] = useState("");
  const { attemptId } = useParams<{ attemptId: string }>();

  useEffect(() => {
    fetch(`/api/attempts/${attemptId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error);
        return res.json();
      })
      .then((d) => setData(d.attempt))
      .catch((e) => setError(e.message));
  }, [attemptId]);

  const STATUS_BADGE: Record<string, string> = {
    CORRECT: "bg-emerald-100 text-emerald-800",
    PARTIAL: "bg-amber-100 text-amber-800",
    INCORRECT: "bg-red-100 text-red-700",
    UNANSWERED: "bg-slate-100 text-slate-600",
  };
  const STATUS_LABEL: Record<string, string> = {
    CORRECT: t("result.correctFull"),
    PARTIAL: t("result.partialFull"),
    INCORRECT: t("result.incorrectFull"),
    UNANSWERED: t("result.unansweredFull"),
  };

  if (error) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-red-600">{error}</p>
        </main>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-10 text-slate-500">{t("result.loading")}</main>
      </>
    );
  }
  if (data.status !== "SUBMITTED") {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-10">
          <p>{t("result.notSubmitted")}</p>
          <a href={`/poging/${attemptId}`} className="font-medium text-emerald-700 hover:underline">
            {t("result.continue")}
          </a>
        </main>
      </>
    );
  }

  const counts = { CORRECT: 0, PARTIAL: 0, INCORRECT: 0, UNANSWERED: 0 };
  for (const a of data.answers) counts[a.evaluation?.status ?? "UNANSWERED"] += 1;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">{t("result.title")}: {data.snapshot.title}</h1>
        <p className="mt-1 text-slate-600">
          {t("result.practiceScore")}: <strong>{data.score ?? 0}</strong> / {data.snapshot.questions.length}{" "}
          {t("result.points")} ({data.scorePct}%). {t("result.disclaimer")}
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">{t("result.correct")}: {counts.CORRECT}</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{t("result.partial")}: {counts.PARTIAL}</span>
          <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">{t("result.incorrect")}: {counts.INCORRECT}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{t("result.unanswered")}: {counts.UNANSWERED}</span>
        </div>

        <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="font-semibold text-emerald-900">{t("result.tips")}</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-emerald-900">
            {data.recommendations.map((r) => (
              <li key={r.index}>{r.text}</li>
            ))}
          </ol>
        </section>

        <h2 className="mt-8 text-xl font-bold">{t("result.perQuestion")}</h2>
        <ol className="mt-3 space-y-5">
          {data.snapshot.questions.map((q, i) => {
            const a = data.answers.find((x) => x.questionId === q.id);
            const ev = a?.evaluation;
            const chosenText =
              q.type === "MC" && a?.mcChoiceId
                ? q.options.find((o) => o.id === a.mcChoiceId)?.text
                : null;
            return (
              <li key={q.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">
                    {i + 1}. {q.prompt}
                  </p>
                  <span
                    className={
                      "shrink-0 rounded-full px-3 py-1 text-xs font-medium " +
                      STATUS_BADGE[ev?.status ?? "UNANSWERED"]
                    }
                  >
                    {STATUS_LABEL[ev?.status ?? "UNANSWERED"]} {ev?.scorePct}%
                  </span>
                </div>
                <p className="mt-2 text-sm">
                  <span className="text-slate-500">{t("result.yourAnswer")}: </span>
                  {chosenText ?? (a?.text?.trim() || <em className="text-slate-400">{t("result.nothingFilled")}</em>)}
                </p>
                {ev && (
                  <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-4 text-sm">
                    <p><strong>{t("result.explanation")}:</strong> {ev.explanation}</p>
                    {ev.didWell !== "-" && <p><strong>{t("result.wellDone")}:</strong> {ev.didWell}</p>}
                    {ev.needsImprovement !== "-" && <p><strong>{t("result.improve")}:</strong> {ev.needsImprovement}</p>}
                    {ev.exampleAnswer && <p><strong>{t("result.model")}:</strong> {ev.exampleAnswer}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-8 flex gap-3">
          <a
            href="/bibliotheek"
            className="rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700"
          >
            {t("result.nextExercise")}
          </a>
          <a
            href="/voortgang"
            className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold hover:bg-slate-100"
          >
            {t("result.viewProgress")}
          </a>
        </div>
      </main>
    </>
  );
}
