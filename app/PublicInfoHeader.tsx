"use client";

import Link from "next/link";
import { LanguageSwitcher, useArcadiaLanguage } from "./i18n";

export function PublicInfoHeader({ label }: { label: string }) {
  const { t } = useArcadiaLanguage();
  return (
    <header className="public-info-header">
      <Link className="public-info-brand" href="/">
        <span>CMA</span>
        <div>
          <strong>CRYPTO MINER ARCADIA</strong>
          <small>{label}</small>
        </div>
      </Link>
      <div className="public-info-actions">
        <nav aria-label={t("footer.navigation")}>
          <Link href="/">{t("nav.mine")}</Link>
          <a href="/faq">FAQ</a>
          <a href="/support">{t("nav.support")}</a>
          <a href="/legal">{t("sidebar.terms")}</a>
        </nav>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
