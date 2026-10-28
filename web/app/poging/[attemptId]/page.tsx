"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LanguageSwitcher, useI18n } from "@/components/LanguageProvider";

interface SnapshotQuestion {
  id: string;
  type: "MC" | "OPEN";
  prompt: string;
  requireTwoArguments: boolean;
  requireEvidence: boolean;
  requireCompleteSentences: boolean;
  options: { id: string; order: number; text: string }[];
}

interface Snapshot {
  title: string;
  body: string;
  headings: string[];
  questions: SnapshotQuestion[];
}

interface DraftAnswer {
  questionId: string;
  mcChoiceId: string | null;
  text: string | null;
}

export default function PogingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const routeParams = useParams();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    setAttemptId(routeParams.attemptId as string);
  }, [routeParams]);

  useEffect(() => {
    if (!attemptId) return;
    fetch(`/api/attempts/${attemptId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error);
        return res.json();
      })
      .then((d) => {
        if (d.attempt.status === "SUBMITTED") {
          router.replace(`/resultaat/${d.attempt.id}`);
          return;
        }
        setSnapshot(d.attempt.snapshot);
        const map: Record<string, DraftAnswer> = {};
        for (const a of d.attempt.answers ?? []) map[a.questionId] = a;
        setAnswers(map);
      })
      .catch((e) => setError(e.message || "Kon de poging niet laden."));
  }, [attemptId, router]);

  // Debounced autosave
  useEffect(() => {
    if (!attemptId || !snapshot) return;
    const timer = setTimeout(async () => {
      setSaved(true);
      const res = await fetch(`/api/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.values(answersRef.current).map((a) => ({
            questionId: a.questionId,
            mcChoiceId: a.mcChoiceId,
            text: a.text,
          })),
        }),
      });
      if (res.ok) setSavedAt(new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }));
    }, 800);
    return () => clearTimeout(timer);
  }, [answers, attemptId, snapshot]);

  const submit = useCallback(async () => {
    if (!attemptId) return;
    setSubmitting(true);
    setError("");
    const res = await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Inleveren mislukt.");
      setSubmitting(false);
      return;
    }
    router.push(`/resultaat/${attemptId}`);
  }, [attemptId, router]);

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
  if (!snapshot || !attemptId) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-slate-500">Laden...</p>
        </main>
      </>
    );
  }

  const answeredCount = Object.values(answers).filter(
    (a) => (a.mcChoiceId && a.mcChoiceId !== "") || (a.text && a.text.trim())
  ).length;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{snapshot.title}</h1>
          <span className="text-sm text-slate-500">
            {savedAt ? `${t("exercise.savedAt")} ${savedAt}` : saved ? t("exercise.saving") : ""}
          </span>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm leading-relaxed">
            <h2 className="mb-3 text-lg font-semibold">{t("exercise.text")}</h2>
            <div className="max-w-prose space-y-3 text-[1.05rem]">
              {snapshot.body.split("\n").map((line, i) =>
                line.startsWith("## ") ? (
                  <h3 key={i} className="pt-2 text-base font-semibold">
                    {line.slice(3)}
                  </h3>
                ) : line.trim() ? (
                  <p key={i}>{line}</p>
                ) : null
              )}
            </div>
          </article>

          <section>
            <h2 className="mb-3 text-lg font-semibold">
              {t("exercise.questions")} ({answeredCount}/{snapshot.questions.length} {t("exercise.answered")})
            </h2>
            <ol className="space-y-6">
              {snapshot.questions.map((q, idx) => (
                <HintedQuestion
                  key={q.id}
                  index={idx + 1}
                  question={q}
                  value={answers[q.id]}
                  onChange={(value) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: {
                        questionId: q.id,
                        mcChoiceId: value.mcChoiceId ?? null,
                        text: value.text ?? null,
                      },
                    }))
                  }
                />
              ))}
            </ol>
            {error && <p className="mt-4 text-red-600">{error}</p>}
            <button
              onClick={submit}
              disabled={submitting}
              className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 text-lg font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? t("exercise.submitting") : t("exercise.submit")}
            </button>
          </section>
        </div>
      </main>
    </>
  );
}

function HintedQuestion({
  index,
  question,
  value,
  onChange,
}: {
  index: number;
  question: SnapshotQuestion;
  value: DraftAnswer | undefined;
  onChange: (value: { mcChoiceId?: string | null; text?: string }) => void;
}) {
  const { t } = useI18n();
  const hints: string[] = [];
  if (question.requireCompleteSentences) hints.push(t("exercise.hintComplete"));
  if (question.requireTwoArguments) hints.push(t("exercise.hintTwoArgs"));
  if (question.requireEvidence) hints.push(t("exercise.hintEvidence"));

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="font-semibold">
        {index}. {question.prompt}
      </p>
      {hints.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm text-emerald-700">
          {hints.map((h) => (
            <li key={h}>• {h}</li>
          ))}
        </ul>
      )}
      {question.type === "MC" ? (
        <div className="mt-3 space-y-2">
          {question.options.map((o) => (
            <label
              key={o.id}
              className={
                "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-base " +
                (value?.mcChoiceId === o.id
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-200 hover:bg-slate-50")
              }
            >
              <input
                type="radio"
                name={`q_${question.id}`}
                checked={value?.mcChoiceId === o.id}
                onChange={() => onChange({ mcChoiceId: o.id, text: "" })}
                className="size-4 text-emerald-600"
              />
              {o.text}
            </label>
          ))}
        </div>
      ) : (
        <textarea
          value={value?.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={4}
          className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-emerald-500 focus:outline-none"
          placeholder={t("exercise.placeholder")}
        />
      )}
    </li>
  );
}

function Navbar() {
  const { t } = useI18n();
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <a href="/bibliotheek" className="text-lg font-bold text-emerald-700">
          {t("brand")}
        </a>
        <div className="flex-grow" />
        <a href="/bibliotheek" className="text-sm font-medium hover:text-emerald-700">
          {t("nav.library")}
        </a>
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
