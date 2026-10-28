"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LanguageSwitcher, useI18n } from "@/components/LanguageProvider";

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "STUDENT",
    groep: 8,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Registreren mislukt.");
      return;
    }
    const d = await res.json();
    router.push(d.redirect);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 relative">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <h1 className="mb-6 text-2xl font-bold text-emerald-700">{t("register.title")}</h1>
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium">
          {t("register.name")}
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>
        <label className="block text-sm font-medium">
          {t("login.email")}
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>
        <label className="block text-sm font-medium">
          {t("register.password")}
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>
        <label className="block text-sm font-medium">
          {t("register.role")}
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          >
            <option value="STUDENT">{t("register.roleStudent")}</option>
            <option value="PARENT">{t("register.roleParent")}</option>
          </select>
        </label>
        {form.role === "STUDENT" && (
          <label className="block text-sm font-medium">
            {t("register.groep")}
            <select
              value={form.groep}
              onChange={(e) => setForm({ ...form, groep: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            >
              <option value={5}>5</option>
              <option value={6}>6</option>
              <option value={7}>7</option>
              <option value={8}>8</option>
            </select>
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? t("login.busy") : t("register.submit")}
        </button>
        <p className="text-center text-sm text-slate-600">
          {t("register.hasAccount")}{" "}
          <Link href="/login" className="font-medium text-emerald-700 hover:underline">
            {t("register.doLogin")}
          </Link>
        </p>
      </form>
    </main>
  );
}
