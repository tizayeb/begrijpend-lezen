"use client";

import { Fragment, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { AdminSubnav } from "@/components/AdminSubnav";
import { useI18n } from "@/components/LanguageProvider";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "STUDENT" | "PARENT" | "ADMIN";
  isActive: boolean;
  createdAt: string;
  profile: { groep: number } | null;
}

export default function AdminUsersPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState<string>("");
  const [pwOpenId, setPwOpenId] = useState<string>("");
  const [pw, setPw] = useState("");

  function load() {
    fetch("/api/admin/users")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error);
        return res.json();
      })
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function patch(id: string, body: Record<string, unknown>, okMsg: string) {
    setBusyId(id);
    setMsg("");
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || t("users.updateFailed"));
      setMsg(okMsg);
      setUsers((prev) => prev?.map((u) => (u.id === id ? { ...u, ...d.user } : u)) ?? null);
      setPwOpenId("");
      setPw("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("users.updateFailed"));
    } finally {
      setBusyId("");
    }
  }

  const ROLE_LABEL: Record<string, string> = {
    STUDENT: t("users.roleStudent"),
    PARENT: t("users.roleParent"),
    ADMIN: t("users.roleAdmin"),
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
        <AdminSubnav active="users" />

        {msg && <p className="mt-3 rounded-lg bg-slate-100 px-4 py-2 text-sm">{msg}</p>}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        {!users && !error && <p className="mt-6 text-slate-500">{t("users.loading")}</p>}

        {users && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2">{t("users.thName")}</th>
                  <th>{t("users.thEmail")}</th>
                  <th>{t("users.thRole")}</th>
                  <th>{t("users.thStatus")}</th>
                  <th>{t("users.thActions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <Fragment key={u.id}>
                    <tr className="border-t border-slate-100">
                      <td className="py-3 pr-3 font-medium align-middle">
                        {u.name}
                        {u.profile && (
                          <span className="ml-1 whitespace-nowrap text-xs text-slate-400">
                            ({t("users.groep")} {u.profile.groep})
                          </span>
                        )}
                      </td>
                      <td className="pr-3 align-middle text-slate-600">{u.email}</td>
                      <td className="pr-3 align-middle">{ROLE_LABEL[u.role]}</td>
                      <td className="pr-3 align-middle">
                        <span
                          className={
                            "rounded-full px-2.5 py-0.5 text-xs font-medium " +
                            (u.isActive
                              ? "bg-teal-100 text-teal-800"
                              : "bg-slate-100 text-slate-600")
                          }
                        >
                          {u.isActive ? t("users.active") : t("users.inactive")}
                        </span>
                      </td>
                      <td className="py-3 align-middle">
                        <div className="flex flex-wrap items-center gap-2">
                          {u.isActive ? (
                            <button
                              type="button"
                              disabled={busyId === u.id}
                              onClick={() => patch(u.id, { isActive: false }, t("users.deactivated"))}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 disabled:opacity-50"
                            >
                              {t("users.deactivate")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busyId === u.id}
                              onClick={() => patch(u.id, { isActive: true }, t("users.activated"))}
                              className="rounded-lg bg-teal-700 px-3 py-1.5 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                            >
                              {t("users.activate")}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyId === u.id}
                            onClick={() => {
                              setPwOpenId(pwOpenId === u.id ? "" : u.id);
                              setPw("");
                            }}
                            aria-expanded={pwOpenId === u.id}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 disabled:opacity-50"
                          >
                            {pwOpenId === u.id ? t("users.cancelPw") : t("users.setPassword")}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {pwOpenId === u.id && (
                      <tr className="border-t border-slate-100 bg-slate-50">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <label htmlFor={"pw-" + u.id} className="text-sm font-medium">
                              {t("users.setPassword")} — {u.name}:
                            </label>
                            <input
                              id={"pw-" + u.id}
                              type="text"
                              value={pw}
                              onChange={(e) => setPw(e.target.value)}
                              placeholder={t("users.newPassword")}
                              className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5"
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              disabled={busyId === u.id || pw.length < 8}
                              onClick={() => patch(u.id, { password: pw }, t("users.passwordSaved"))}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {t("users.savePassword")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
