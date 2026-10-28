"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/components/LanguageProvider";

interface Child { id: string; name: string; email: string; groep: number | null }
interface Attempt {
  attemptId: string; title: string; topic: string;
  scorePct: number | null; score: number | null; submittedAt: string | null;
}
interface SkillRow { key: string; label: string; pct: number; totalQuestions: number }

export default function OuderPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    attempts: Attempt[]; skills: SkillRow[]; latestRecommendations: string[];
  } | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState("");

  const loadChildren = useCallback(async () => {
    const res = await fetch("/api/parent/link");
    if (!res.ok) {
      router.push("/login");
      return;
    }
    const d = await res.json();
    setChildren(d.students ?? []);
  }, [router]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    if (!selected) return setProgress(null);
    fetch(`/api/students/${selected}/progress`)
      .then(async (r) => (r.ok ? setProgress(await r.json()) : null))
      .catch(() => null);
  }, [selected]);

  async function link(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/parent/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, studentName: newName || undefined }),
    });
    const d = await res.json();
    if (!res.ok) return setMsg(d.error || t("parent.linkFailed"));
    setMsg(`${t("parent.linked")}: ${d.name}`);
    setNewEmail("");
    setNewName("");
    loadChildren();
  }

  return (
    <>
    <Navbar />
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("parent.title")}</h1>
      <p className="mt-1 text-slate-600">{t("parent.subtitle")}</p>

      <form onSubmit={link} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <label className="text-sm font-medium">
          {t("parent.email")}
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            type="email"
            required
            className="mt-1 block w-56 rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>
        <label className="text-sm font-medium">
          {t("parent.name")}
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="mt-1 block w-56 rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>
        <button className="rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700">
          {t("parent.link")}
        </button>
        {msg && <p className="text-sm text-slate-600">{msg}</p>}
      </form>

      <div className="mt-8 flex gap-2">
        {children.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={
              "rounded-lg px-4 py-2 text-sm font-semibold " +
              (selected === c.id ? "bg-emerald-600 text-white" : "bg-white border border-slate-300 hover:bg-slate-100")
            }
          >
            {c.name} {c.groep ? `(${t("parent.group")} ${c.groep})` : ""}
          </button>
        ))}
        {children.length === 0 && (
          <p className="text-slate-600">{t("parent.none")}</p>
        )}
      </div>

      {selected && progress && (
        <>
          <h2 className="mt-8 text-lg font-semibold">{children.find((c) => c.id === selected)?.name}</h2>
          <ul className="mt-2 space-y-2">
            {progress.attempts.map((a) => (
              <li key={a.attemptId}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-slate-500">
                    {new Date(a.submittedAt ?? "").toLocaleDateString("nl-NL")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{a.score ?? 0} pkt ({a.scorePct}%)</span>
                  <a
                    href={`/resultaat/${a.attemptId}`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
                  >
                    {t("parent.answersFeedback")}
                  </a>
                </div>
              </li>
            ))}
            {progress.attempts.length === 0 && (
              <li className="text-slate-600">{t("parent.noAttempts")}</li>
            )}
          </ul>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <h3 className="font-semibold text-emerald-900">{t("parent.strong")}</h3>
              <ul className="mt-2 space-y-1 text-sm text-emerald-900">
                {progress.skills.filter((s) => s.pct >= 70).length
                  ? progress.skills.filter((s) => s.pct >= 70).map((s) => <li key={s.key}>• {s.label} ({s.pct}%)</li>)
                    : <li>{t("parent.noData")}</li>}
              </ul>
            </section>
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="font-semibold text-amber-900">{t("parent.focus")}</h3>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {progress.skills.filter((s) => s.pct < 70).length
                  ? progress.skills.filter((s) => s.pct < 70).sort((a, b) => a.pct - b.pct)
                      .map((s) => <li key={s.key}>• {s.label} ({s.pct}%)</li>)
                    : <li>{t("parent.noData")}</li>}
              </ul>
            </section>
          </div>

          {progress.latestRecommendations.length > 0 && (
            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold">{t("parent.steps")}</h3>
              <ul className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {progress.latestRecommendations.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
    </>
  );
}
