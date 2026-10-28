"use client";

import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/components/LanguageProvider";

interface AdminPassage {
  id: string; title: string; topic: string; difficulty: string; estMinutes: number;
  status: string; version: number; questionCount: number;
}

interface DraftQuestion {
  type: "MC" | "OPEN";
  prompt: string;
  skillKey: string;
  modelAnswer: string;
  mcAnswerKey: number | null;
  options: string[];
  requireTwoArguments: boolean;
  requireEvidence: boolean;
  requireCompleteSentences: boolean;
  keywordGroups: string; // "syn, syn | syn2" — |-separated groups
  minChars: number;
  fullCreditRule: string;
}

const SKILLS = [
  ["explicit_information", "Letterlijke informatie"],
  ["inference", "Infereren"],
  ["cause_effect", "Oorzaak en gevolg"],
  ["main_idea", "Kern en samenvatting"],
  ["complete_answers", "Volledige antwoorden"],
  ["evidence", "Bewijs uit de tekst"],
  ["number_of_arguments", "Aantal argumenten"],
  ["vocabulary", "Woordenschat in context"],
  ["facts_vs_opinions", "Feit versus mening"],
];

function emptyQuestion(type: "MC" | "OPEN"): DraftQuestion {
  return {
    type,
    prompt: "",
    skillKey: "explicit_information",
    modelAnswer: "",
    mcAnswerKey: null,
    options: type === "MC" ? ["", "", "", ""] : [],
    requireTwoArguments: false,
    requireEvidence: false,
    requireCompleteSentences: false,
    keywordGroups: "",
    minChars: 25,
    fullCreditRule: "",
  };
}

export default function AdminPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<AdminPassage[]>([]);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkJson, setBulkJson] = useState("");
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<string>("");
  const [form, setForm] = useState({
    title: "",
    topic: "",
    difficulty: "gemiddeld",
    estMinutes: 10,
    body: "",
    headings: "",
    objectives: "",
  });
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);

  function resetForm() {
    setEditingId(null);
    setForm({ title: "", topic: "", difficulty: "gemiddeld", estMinutes: 10, body: "", headings: "", objectives: "" });
    setQuestions([]);
  }

  async function loadForEdit(id: string) {
    setMsg("");
    const res = await fetch(`/api/admin/passages/${id}`);
    const d = await res.json();
    if (!res.ok) return setMsg(d.error || "Kon de oefening niet laden.");
    const p = d.passage;
    setEditingId(id);
    setForm({
      title: p.title,
      topic: p.topic,
      difficulty: p.difficulty,
      estMinutes: p.estMinutes,
      body: p.body,
      headings: (p.headings ?? []).join("\n"),
      objectives: (p.objectives ?? []).join("\n"),
    });
    setQuestions(
      (p.questions as { // eslint-disable-line -- typed below
        type: "MC" | "OPEN"; prompt: string; skillKey: string; mcAnswerKey: number | null;
        modelAnswer: string | null; requireTwoArguments: boolean; requireEvidence: boolean;
        requireCompleteSentences: boolean; options: string[];
        rubric: { keywordGroups: string[][]; minChars: number; fullCreditRule: string | null } | null;
      }[]).map((q) => ({
        type: q.type,
        prompt: q.prompt,
        skillKey: q.skillKey,
        modelAnswer: q.modelAnswer ?? "",
        mcAnswerKey: q.mcAnswerKey ?? null,
        options: q.type === "MC" ? (q.options ?? []).map((o: string) => o) : [],
        requireTwoArguments: q.requireTwoArguments ?? false,
        requireEvidence: q.requireEvidence ?? false,
        requireCompleteSentences: q.requireCompleteSentences ?? false,
        keywordGroups: q.rubric
          ? (q.rubric.keywordGroups ?? []).map((g: string[]) => g.join(", ")).join(" | ")
          : "",
        minChars: q.rubric?.minChars ?? 25,
        fullCreditRule: q.rubric?.fullCreditRule ?? "",
      })) as DraftQuestion[]
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function duplicate(id: string) {
    setMsg("");
    const res = await fetch(`/api/admin/passages/${id}/duplicate`, { method: "POST" });
    const d = await res.json();
    if (!res.ok) return setMsg(d.error || "Dupliceren mislukt.");
    setMsg(t("admin.duplicateHint") + ` (${d.title})`);
    load();
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/passages");
    if (res.ok) {
      const d = await res.json();
      setItems(d.items ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function bulkImport() {
    setBulkResult("");
    let text = bulkJson.trim();
    if (bulkFile) {
      text = await bulkFile.text();
    }
    if (!text) {
      setBulkResult(t("admin.bulkNothing"));
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setBulkResult(t("admin.bulkNothing"));
      return;
    }
    setBulkBusy(true);
    const res = await fetch("/api/admin/passages/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });
    setBulkBusy(false);
    const d = await res.json();
    if (!res.ok) {
      setBulkResult(d.error || t("admin.bulkNothing"));
      return;
    }
    const parts: string[] = [t("admin.bulkOk")];
    if (d.created?.length) parts.push(t("admin.bulkCreated") + d.created.join(", "));
    if (d.skipped?.length)
      parts.push(
        t("admin.bulkSkipped") +
          d.skipped.map((s: { title: string; reason: string }) => `${s.title} (${s.reason})`).join("; ")
      );
    setBulkResult(parts.join(" — "));
    setBulkJson("");
    setBulkFile(null);
    load();
  }

  async function create() {
    setMsg("");
    const payload = {
      ...form,
      headings: form.headings.split("\n").filter(Boolean),
      objectives: form.objectives.split("\n").filter(Boolean),
      questions: questions.map((q) => ({
        type: q.type,
        prompt: q.prompt,
        skillKey: q.skillKey,
        modelAnswer: q.modelAnswer || null,
        mcAnswerKey: q.mcAnswerKey,
        options: q.type === "MC" ? q.options.filter((o) => o.trim()) : undefined,
        requireTwoArguments: q.requireTwoArguments,
        requireEvidence: q.requireEvidence,
        requireCompleteSentences: q.requireCompleteSentences,
        rubric:
          q.type === "OPEN" && (q.keywordGroups.trim() || q.fullCreditRule.trim())
            ? {
                keywordGroups: q.keywordGroups
                  .split("|")
                  .map((g) => g.split(",").map((s) => s.trim()).filter(Boolean))
                  .filter((g) => g.length > 0),
                minChars: q.minChars,
                fullCreditRule: q.fullCreditRule || null,
              }
            : null,
      })),
    };
    const res = await fetch(editingId ? `/api/admin/passages/${editingId}` : "/api/passages", {
      method: editingId ? "PATCH" : "POST" as const,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) return setMsg(d.error || t("admin.actionFailed"));
    setMsg(editingId ? t("admin.updated") : t("admin.createdDraft").replace("{id}", d.id));
    resetForm();
    load();
  }

  async function publish(id: string, status: string) {
    setMsg("");
    const res = await fetch(`/api/passages/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const d = await res.json();
    if (!res.ok) return setMsg(d.error || t("admin.actionFailed"));
    load();
  }

  async function preview(p: AdminPassage) {
    window.open(`/api/passages/${p.id}`, "_blank");
  }

  return (
    <>
    <Navbar />
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("admin.title")}</h1>

      {msg && <p className="mt-3 rounded-lg bg-slate-100 px-4 py-2 text-sm">{msg}</p>}

      {editingId && (
        <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900 border border-amber-200">
          {t("admin.editing")} <strong>{items.find((p) => p.id === editingId)?.title}</strong>
          <button
            onClick={resetForm}
            className="ml-3 text-sm font-medium underline hover:no-underline"
          >
            {t("admin.cancelEdit")}
          </button>
        </p>
      )}

      <table className="mt-6 w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2">{t("table.title")}</th>
            <th>{t("table.topic")}</th>
            <th>{t("table.difficulty")}</th>
            <th>{t("table.questions")}</th>
            <th>{t("table.status")}</th>
            <th>{t("table.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-t border-slate-200">
              <td className="py-2 font-medium">{p.title}</td>
              <td>{p.topic}</td>
              <td>{p.difficulty}</td>
              <td>{p.questionCount}</td>
              <td>{p.status === "PUBLISHED" ? t("admin.published") : p.status === "DRAFT" ? t("admin.draft") : t("admin.archived")}</td>
              <td className="flex flex-wrap gap-2 py-2">
                <button onClick={() => loadForEdit(p.id)} className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100">
                  {t("admin.edit")}
                </button>
                <button onClick={() => duplicate(p.id)} className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100">
                  {t("admin.duplicate")}
                </button>
                {p.status !== "PUBLISHED" && (
                  <button onClick={() => publish(p.id, "PUBLISHED")} className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                    {t("admin.publish")}
                  </button>
                )}
                {p.status === "PUBLISHED" && (
                  <button onClick={() => publish(p.id, "DRAFT")} className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100">
                    {t("admin.toDraft")}
                  </button>
                )}
                {p.status !== "ARCHIVED" && (
                  <button onClick={() => publish(p.id, "ARCHIVED")} className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100">
                    {t("admin.archive")}
                  </button>
                )}
                <button onClick={() => preview(p)} className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100">
                  {t("admin.preview")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold">{t("admin.bulkTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("admin.bulkDesc")}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a
            href="/api/admin/passages/sample"
            className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            download
          >
            {t("admin.bulkDownload")}
          </a>
          <label className="text-sm font-medium">
            <span className="hidden">{t("admin.bulkChoose")}</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </label>
        </div>
        <textarea
          value={bulkJson}
          onChange={(e) => setBulkJson(e.target.value)}
          rows={6}
          placeholder={t("admin.bulkPaste")}
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
        />
        <button
          onClick={bulkImport}
          disabled={bulkBusy}
          className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {bulkBusy ? t("admin.bulkImporting") : t("admin.bulkImport")}
        </button>
        {bulkResult && (
          <p className="mt-3 rounded-lg bg-slate-100 px-4 py-2 text-sm whitespace-pre-wrap">{bulkResult}</p>
        )}
      </section>

      <h2 className="mt-10 text-xl font-bold">{t("admin.newTitle")}</h2>

      <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2">
        <label className="text-sm font-medium">
          {t("admin.form.title")}
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm font-medium">
          {t("admin.form.topic")}
          <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder={t("admin.form.topicPlaceholder")} />
        </label>
        <label className="text-sm font-medium">
          {t("admin.form.difficulty")}
          <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="makkelijk">{t("lib.easy")}</option>
            <option value="gemiddeld">{t("lib.medium")}</option>
            <option value="uitdagend">{t("lib.challenging")}</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          {t("admin.form.estMinutes")}
          <input type="number" value={form.estMinutes} onChange={(e) => setForm({ ...form, estMinutes: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm font-medium md:col-span-2">
          {t("admin.form.body")}
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={10} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
        </label>
        <label className="text-sm font-medium">
          {t("admin.form.headings")}
          <textarea value={form.headings} onChange={(e) => setForm({ ...form, headings: e.target.value })}
            rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm font-medium">
          {t("admin.form.objectives")}
          <textarea value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })}
            rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="mt-4 flex gap-3">
        <button onClick={() => setQuestions([...questions, emptyQuestion("MC")])}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100">
          + Meerkeuzevraag
        </button>
        <button onClick={() => setQuestions([...questions, emptyQuestion("OPEN")])}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100">
          + Open vraag
        </button>
        <button onClick={create} disabled={!questions.length}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {t("admin.saveDraft")}
        </button>
      </div>

      {questions.map((q, i) => (
        <div key={i} className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t("admin.qTitle")} {i + 1}</h3>
            <button onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
              className="text-sm text-red-600 hover:underline">{t("admin.delete")}</button>
          </div>
          <QuestionEditor
            q={q}
            onChange={(nq) => setQuestions(questions.map((x, j) => (j === i ? nq : x)))}
          />
        </div>
      ))}
    </main>
    </>
  );
}

function QuestionEditor({ q, onChange }: { q: DraftQuestion; onChange: (q: DraftQuestion) => void }) {
  const { t } = useI18n();
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium md:col-span-2">
        {t("admin.q.prompt")}
        <input value={q.prompt} onChange={(e) => onChange({ ...q, prompt: e.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label className="text-sm font-medium">
        {t("admin.q.skill")}
        <select value={q.skillKey} onChange={(e) => onChange({ ...q, skillKey: e.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
          {SKILLS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">
        {t("admin.q.modelAnswer")}
        <input value={q.modelAnswer} onChange={(e) => onChange({ ...q, modelAnswer: e.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>

      {q.type === "MC" ? (
        <>
          {q.options.map((o, j) => (
            <label key={j} className="flex items-center gap-2 text-sm font-medium">
              <input
                type="radio"
                name={`mc_all_${q.prompt}`}
                checked={q.mcAnswerKey === j}
                onChange={() => onChange({ ...q, mcAnswerKey: j })}
                title="Markeer als juiste antwoord"
              />
              {t("admin.q.option")} {j + 1}
              <input value={o} onChange={(e) => setQOption(q, j, e.target.value, onChange)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          ))}
        </>
      ) : (
        <>
          <label className="text-sm font-medium">
            {t("admin.q.rubricGroups")}
            <input value={q.keywordGroups} onChange={(e) => onChange({ ...q, keywordGroups: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="geld, geldzending | geloofde, blijvend" />
          </label>
          <label className="text-sm font-medium">
            {t("admin.q.minChars")}
            <input type="number" value={q.minChars} onChange={(e) => onChange({ ...q, minChars: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium md:col-span-2">
            {t("admin.q.fullCredit")}
            <input value={q.fullCreditRule} onChange={(e) => onChange({ ...q, fullCreditRule: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
              placeholder="bijv. (verdrietig|in de put)" />
          </label>
          <div className="flex flex-wrap gap-4 text-sm md:col-span-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={q.requireTwoArguments}
                onChange={(e) => onChange({ ...q, requireTwoArguments: e.target.checked })} />
              {t("admin.q.requireTwoArgs")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={q.requireEvidence}
                onChange={(e) => onChange({ ...q, requireEvidence: e.target.checked })} />
              {t("admin.q.requireEvidence")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={q.requireCompleteSentences}
                onChange={(e) => onChange({ ...q, requireCompleteSentences: e.target.checked })} />
              {t("admin.q.requireComplete")}
            </label>
          </div>
        </>
      )}
    </div>
  );
}

function setQOption(q: DraftQuestion, j: number, text: string, onChange: (q: DraftQuestion) => void) {
  const options = [...q.options];
  options[j] = text;
  onChange({ ...q, options });
}
