"use client";

import Link from "next/link";
import { useI18n } from "@/components/LanguageProvider";

export function AdminSubnav({ active }: { active: "passages" | "users" }) {
  const { t } = useI18n();
  const base =
    "rounded-lg px-4 py-2 text-sm font-semibold ";
  return (
    <nav className="mt-3 inline-flex flex-wrap gap-2">
      <Link href="/admin" className={base + (active === "passages" ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-300 hover:bg-slate-100")}>
        {t("admin.tabPassages")}
      </Link>
      <Link href="/admin/gebruikers" className={base + (active === "users" ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-300 hover:bg-slate-100")}>
        {t("admin.tabUsers")}
      </Link>
    </nav>
  );
}
