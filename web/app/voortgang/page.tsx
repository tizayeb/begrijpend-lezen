"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/components/LanguageProvider";

interface Attempt {
  attemptId: string;
  title: string;
  topic: string;
  scorePct: number | null;
  score: number | null;
  submittedAt: string | null;
}
interface SkillRow {
  key: string;
  label: string;
  pct: number;
  totalQuestions: number;
}

export default function VoortgangPage() {
  const { t } = useI18n();
  const [data, setData] = useState<{
    attempts: Attempt[];
    skills: SkillRow[];
    latestRecommendations: string[];
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(async (me) => {
        if (!me.user || me.user.role !== "STUDENT") {
          setError(t("prog.notStudent"));
          return;
        }
        const res = await fetch(`/api/students/${me.user.id}/progress`);
        if (!res.ok) return setError(t("prog.loadError"));
        setData(await res.json());
      })
      .catch(() => setError(t("prog.loadError")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-10 text-red-600">{error}</main>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-10 text-slate-500">{t("lib.loading")}</main>
      </>
    );
  }

  const strong = data.skills.filter((s) => s.pct >= 70).sort((a, b) => b.pct - a.pct);
  const focus = data.skills.filter((s) => s.pct < 70).sort((a, b) => a.pct - b.pct);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">{t("prog.title")}</h1>
        {data.attempts.length === 0 ? (
          <p className="mt-4 text-slate-600">
            {t("prog.empty")}{" "}
            <a href="/bibliotheek" className="font-medium text-emerald-700 hover:underline">
              {t("nav.library")}
            </a>
            .
          </p>
        ) : (
          <>
            <h2 className="mt-6 text-lg font-semibold">{t("prog.exercises")}</h2>
            <ul className="mt-2 space-y-2">
              {data.attempts.map((a) => (
                <li
                  key={a.attemptId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(a.submittedAt ?? "").toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{a.scorePct}%</span>
                    <a
                      href={`/resultaat/${a.attemptId}`}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
                    >
                      {t("prog.result")}
                    </a>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <h2 className="font-semibold text-emerald-900">{t("prog.strong")}</h2>
                <ul className="mt-2 space-y-1 text-sm text-emerald-900">
                  {strong.length ? strong.map((s) => <li key={s.key}>• {t(`skill.${s.key}`)} ({s.pct}%)</li>)
                    : <li>{t("prog.strongEmpty")}</li>}
                </ul>
              </section>
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <h2 className="font-semibold text-amber-900">{t("prog.focus")}</h2>
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {focus.length ? focus.map((s) => <li key={s.key}>• {t(`skill.${s.key}`)} ({s.pct}%)</li>)
                    : <li>{t("prog.focusEmpty")}</li>}
                </ul>
              </section>
            </div>

            {data.latestRecommendations.length > 0 && (
              <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="font-semibold">{t("prog.recommended")}</h2>
                <ul className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                  {data.latestRecommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
