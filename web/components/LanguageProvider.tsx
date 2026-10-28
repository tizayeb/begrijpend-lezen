"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DICT, LOCALES, type Locale } from "@/lib/i18n";

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx>({
  locale: "nl",
  setLocale: () => {},
  t: (k) => k,
});

const STORAGE_KEY = "bl_locale";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("nl");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) || document.cookie.match(/bl_locale=(\w+)/)?.[1];
    if (saved && saved in DICT) setLocaleState(saved as Locale);
    document.documentElement.lang = saved || "nl";
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
    document.cookie = `bl_locale=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: string) => DICT[locale]?.[key] ?? DICT.nl[key] ?? key,
    [locale]
  );

  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label="Taal"
      className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.code.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
