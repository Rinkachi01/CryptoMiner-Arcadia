"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ArcadiaLocale = "pt-BR" | "en" | "es" | "fr";

const copy: Record<ArcadiaLocale, Record<string, string>> = {
  "pt-BR": {
    "nav.mine": "Sala de mineração",
    "nav.pools": "Pools",
    "nav.conversion": "Carteira",
    "nav.inventory": "Inventário",
    "nav.shop": "Loja",
    "nav.games": "Minigames",
    "nav.season": "Temporada",
    "nav.leaderboard": "Ranking Global",
    "nav.tasks": "Tarefas",
    "nav.career": "Central do operador",
    "nav.short.mine": "Sala",
    "nav.short.pools": "Pools",
    "nav.short.conversion": "Carteira",
    "nav.short.inventory": "Itens",
    "nav.short.shop": "Loja",
    "nav.short.games": "Jogos",
    "nav.short.season": "Season",
    "nav.short.leaderboard": "Ranking",
    "nav.short.tasks": "Tasks",
    "nav.short.career": "Carreira",
    "nav.support": "Central de suporte",
    "nav.owner": "Central do proprietário",
    "language.label": "Idioma",
    "language.pt": "Português",
    "language.en": "English",
    "language.es": "Español",
    "language.fr": "Français",
    "profile.open": "Abrir meu perfil",
    "profile.title": "Meu perfil",
    "profile.subtitle": "Conta, segurança e preferências",
    "profile.account": "Conta protegida",
    "profile.support": "Abrir suporte",
    "profile.back": "Voltar para a sala",
  },
  en: {
    "nav.mine": "Mining room",
    "nav.pools": "Pools",
    "nav.conversion": "Wallet",
    "nav.inventory": "Inventory",
    "nav.shop": "Shop",
    "nav.games": "Minigames",
    "nav.season": "Season",
    "nav.leaderboard": "Global ranking",
    "nav.tasks": "Tasks",
    "nav.career": "Operator center",
    "nav.short.mine": "Room",
    "nav.short.pools": "Pools",
    "nav.short.conversion": "Wallet",
    "nav.short.inventory": "Items",
    "nav.short.shop": "Shop",
    "nav.short.games": "Games",
    "nav.short.season": "Season",
    "nav.short.leaderboard": "Ranking",
    "nav.short.tasks": "Tasks",
    "nav.short.career": "Career",
    "nav.support": "Support center",
    "nav.owner": "Owner console",
    "language.label": "Language",
    "language.pt": "Português",
    "language.en": "English",
    "language.es": "Español",
    "language.fr": "Français",
    "profile.open": "Open my profile",
    "profile.title": "My profile",
    "profile.subtitle": "Account, security and preferences",
    "profile.account": "Protected account",
    "profile.support": "Open support",
    "profile.back": "Back to room",
  },
  es: {
    "nav.mine": "Sala de minería",
    "nav.pools": "Pools",
    "nav.conversion": "Cartera",
    "nav.inventory": "Inventario",
    "nav.shop": "Tienda",
    "nav.games": "Minijuegos",
    "nav.season": "Temporada",
    "nav.leaderboard": "Ranking global",
    "nav.tasks": "Tareas",
    "nav.career": "Centro del operador",
    "nav.short.mine": "Sala",
    "nav.short.pools": "Pools",
    "nav.short.conversion": "Cartera",
    "nav.short.inventory": "Items",
    "nav.short.shop": "Tienda",
    "nav.short.games": "Juegos",
    "nav.short.season": "Temporada",
    "nav.short.leaderboard": "Ranking",
    "nav.short.tasks": "Tareas",
    "nav.short.career": "Carrera",
    "nav.support": "Centro de soporte",
    "nav.owner": "Consola del propietario",
    "language.label": "Idioma",
    "language.pt": "Português",
    "language.en": "English",
    "language.es": "Español",
    "language.fr": "Français",
    "profile.open": "Abrir mi perfil",
    "profile.title": "Mi perfil",
    "profile.subtitle": "Cuenta, seguridad y preferencias",
    "profile.account": "Cuenta protegida",
    "profile.support": "Abrir soporte",
    "profile.back": "Volver a la sala",
  },
  fr: {
    "nav.mine": "Salle de minage",
    "nav.pools": "Pools",
    "nav.conversion": "Portefeuille",
    "nav.inventory": "Inventaire",
    "nav.shop": "Boutique",
    "nav.games": "Mini-jeux",
    "nav.season": "Saison",
    "nav.leaderboard": "Classement global",
    "nav.tasks": "Tâches",
    "nav.career": "Centre opérateur",
    "nav.short.mine": "Salle",
    "nav.short.pools": "Pools",
    "nav.short.conversion": "Portefeuille",
    "nav.short.inventory": "Objets",
    "nav.short.shop": "Boutique",
    "nav.short.games": "Jeux",
    "nav.short.season": "Saison",
    "nav.short.leaderboard": "Classement",
    "nav.short.tasks": "Tâches",
    "nav.short.career": "Carrière",
    "nav.support": "Centre d’aide",
    "nav.owner": "Console propriétaire",
    "language.label": "Langue",
    "language.pt": "Português",
    "language.en": "English",
    "language.es": "Español",
    "language.fr": "Français",
    "profile.open": "Ouvrir mon profil",
    "profile.title": "Mon profil",
    "profile.subtitle": "Compte, sécurité et préférences",
    "profile.account": "Compte protégé",
    "profile.support": "Ouvrir l’aide",
    "profile.back": "Retour à la salle",
  },
};

type LanguageContextValue = {
  locale: ArcadiaLocale;
  setLocale: (locale: ArcadiaLocale) => void;
  t: (key: string, fallback?: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<ArcadiaLocale>("pt-BR");

  useEffect(() => {
    const saved = window.localStorage.getItem("arcadia-locale");
    if (saved === "pt-BR" || saved === "en" || saved === "es" || saved === "fr") {
      setLocaleState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLocale = (next: ArcadiaLocale) => {
    setLocaleState(next);
    window.localStorage.setItem("arcadia-locale", next);
    document.documentElement.lang = next;
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, fallback) => copy[locale][key] ?? fallback ?? key,
    }),
    [locale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useArcadiaLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useArcadiaLanguage must be used within LanguageProvider");
  return context;
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useArcadiaLanguage();
  return (
    <label className="language-switcher">
      <span className="sr-only">{t("language.label")}</span>
      <span aria-hidden="true">◎</span>
      <select
        value={locale}
        aria-label={t("language.label")}
        onChange={(event) => setLocale(event.target.value as ArcadiaLocale)}
      >
        <option value="pt-BR">{t("language.pt")}</option>
        <option value="en">{t("language.en")}</option>
        <option value="es">{t("language.es")}</option>
        <option value="fr">{t("language.fr")}</option>
      </select>
    </label>
  );
}
