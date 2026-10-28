"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageSwitcher, useI18n } from "@/components/LanguageProvider";

export interface NavUser {
  id: string;
  name: string;
  role: string;
}

export function Navbar() {
  const { t } = useI18n();
  const [user, setUser] = useState<NavUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const links: { href: string; label: string; showFor?: string }[] = [
    { href: "/bibliotheek", label: t("nav.library"), showFor: "STUDENT" },
    { href: "/voortgang", label: t("nav.progress"), showFor: "STUDENT" },
    { href: "/ouder", label: t("nav.parent"), showFor: "PARENT" },
    { href: "/admin", label: t("nav.admin"), showFor: "ADMIN" },
  ];

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-emerald-700">
          {t("brand")}
        </Link>
        <div className="flex w-full flex-wrap gap-x-4 gap-y-1 sm:w-auto sm:flex-grow sm:flex-nowrap">
        {user &&
          links
            .filter((l) => !l.showFor || l.showFor === user.role)
            .map((l) => (
              <Link key={l.href} href={l.href} className="text-sm font-medium hover:text-emerald-700">
                {l.label}
              </Link>
            ))}
        </div>
        {user ? (
          <>
            <span className="text-sm text-slate-500">{user.name}</span>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              {t("nav.logout")}
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {t("nav.login")}
          </Link>
        )}
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
