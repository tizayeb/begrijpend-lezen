"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LanguageSwitcher, useI18n } from "@/components/LanguageProvider";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || t("login.failed"));
      return;
    }
    const d = await res.json();
    router.push(d.redirect);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <h1 className="mb-1 text-2xl font-bold text-emerald-700">{t("brand")}</h1>
      <p className="mb-6 text-slate-600">{t("login.welcome")}</p>
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium">
          {t("login.email")}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            placeholder={t("login.emailPlaceholder")}
          />
        </label>
        <label className="block text-sm font-medium">
          {t("login.password")}
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            placeholder={t("login.passwordPlaceholder")}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? t("login.busy") : t("login.submit")}
        </button>
        <p className="text-center text-sm text-slate-600">
          {t("login.noAccount")}{" "}
          <Link href="/registreer" className="font-medium text-emerald-700 hover:underline">
            {t("login.register")}
          </Link>
        </p>
      </form>
      <p className="mt-4 text-center text-xs text-slate-500">{t("login.demo")}</p>
    </main>
  );
}
