"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/components/LanguageProvider";

interface PassageItem {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  estMinutes: number;
  objectives: string[];
  questionCount: number;
  status: string;
  bestScore: number | null;
}

export default function BibliotheekPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<PassageItem[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopic] = useState("alles");
  const [difficulty, setDifficulty] = useState("alles");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/passages?topic=${encodeURIComponent(topic)}&difficulty=${encodeURIComponent(difficulty)}`
    );
    const d = await res.json();
    setItems(d.items ?? []);
    setTopics(d.topics ?? []);
    setLoading(false);
  }, [topic, difficulty]);

  useEffect(() => {
    load();
  }, [load]);

  async function start(passageId: string) {
    const res = await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passageId }),
    });
    if (!res.ok) {
      const d = await res.json();
      window.alert(d.error || "Kon de oefening niet starten.");
      return;
    }
    const d = await res.json();
    router.push(`/poging/${d.attemptId}`);
  }

  const filtered = items.filter((p) =>
    p.title.toLowerCase().includes(query.toLowerCase())
  );

  const DIFF_MAP: Record<string, string> = {
    makkelijk: t("lib.easy"),
    gemiddeld: t("lib.medium"),
    uitdagend: t("lib.challenging"),
  };
  const STATUS_LABEL: Record<string, string> = {
    niet_begonnen: t("lib.notStarted"),
    in_uitvoering: t("lib.inProgress"),
    afgerond: t("lib.done"),
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold">{t("lib.title")}</h1>
        <p className="mt-1 text-slate-600">{t("lib.subtitle")}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input
            placeholder={t("lib.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-52 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            aria-label={t("lib.searchLabel")}
          />
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            aria-label={t("lib.topicLabel")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="alles">{t("lib.allTopics")}</option>
            {topics.map((tp) => (
              <option key={tp} value={tp}>
                {tp}
              </option>
            ))}
          </select>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            aria-label={t("lib.difficultyLabel")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="alles">{t("lib.allDifficulties")}</option>
            <option value="makkelijk">{t("lib.easy")}</option>
            <option value="gemiddeld">{t("lib.medium")}</option>
            <option value="uitdagend">{t("lib.challenging")}</option>
          </select>
        </div>

        {loading ? (
          <p className="mt-8 text-slate-500">{t("lib.loading")}</p>
        ) : filtered.length === 0 ? (
          <p className="mt-8 text-slate-500">{t("lib.none")}</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {filtered.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{p.title}</h2>
                    <p className="text-sm text-slate-600">
                      {t("lib.subject")}: {p.topic} · {t("lib.difficulty")}:{" "}
                      {DIFF_MAP[p.difficulty] ?? p.difficulty} · ± {p.estMinutes} {t("lib.minutes")} ·{" "}
                      {p.questionCount} {t("lib.questions")}
                    </p>
                    {p.objectives.length > 0 && (
                      <p className="mt-1 text-sm text-slate-500">
                        {t("lib.objectives")}: {p.objectives.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <span
                      className={
                        "rounded-full px-3 py-1 text-xs font-medium " +
                        (p.status === "afgerond"
                          ? "bg-emerald-100 text-emerald-800"
                          : p.status === "in_uitvoering"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600")
                      }
                    >
                      {STATUS_LABEL[p.status]}
                      {p.bestScore !== null ? ` · ${t("lib.best")}: ${p.bestScore}%` : ""}
                    </span>
                    <button
                      onClick={() => start(p.id)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      {p.status === "in_uitvoering" ? t("lib.continue") : t("lib.start")}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
