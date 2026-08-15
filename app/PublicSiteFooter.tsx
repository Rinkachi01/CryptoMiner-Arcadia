"use client";

import { LanguageSwitcher, useArcadiaLanguage } from "./i18n";

export function PublicSiteFooter() {
  const { t, locale } = useArcadiaLanguage();
  const isPortuguese = locale === "pt-BR";
  return (
    <footer className="public-site-footer">
      <div className="public-footer-main">
        <section className="public-footer-brand" aria-label="Crypto Miner Arcadia">
          <strong>CRYPTO MINER<br />ARCADIA</strong>
          <span>{t("footer.brandSubtitle")}</span>
          <a className="public-footer-cta" href="/auth?mode=signup">{t("footer.start")}</a>
        </section>
        <section className="public-footer-column">
          <h2>{t("footer.navigation")}</h2>
          <nav aria-label={t("footer.navigation")}>
            <a href="/">{t("nav.mine")}</a>
            <a href="/faq">FAQ</a>
            <a href="/support">{t("nav.support")}</a>
            <a href="/legal">{isPortuguese ? "Documentos" : "Documents"}</a>
            <a href="/perfil">{t("profile.open")}</a>
          </nav>
        </section>
        <section className="public-footer-column">
          <h2>{t("footer.account")}</h2>
          <nav aria-label={t("footer.account")}>
            <a href="/auth?mode=signin">{isPortuguese ? "Entrar" : "Sign in"}</a>
            <a href="/auth?mode=signup">{isPortuguese ? "Criar conta" : "Create account"}</a>
            <a href="/legal#privacy">{isPortuguese ? "Privacidade" : "Privacy"}</a>
            <a href="/legal#cookies">Cookies</a>
          </nav>
        </section>
        <section className="public-footer-column public-footer-contact">
          <h2>{t("footer.contact")}</h2>
          <p>{t("footer.contactDescription")}</p>
          <a href="mailto:support@cryptominerarcadia.com">support@cryptominerarcadia.com</a>
          <span>{t("footer.reply")}</span>
        </section>
      </div>
      <div className="public-footer-bottom">
        <small>© 2026 Crypto Miner Arcadia. {t("footer.rights")}</small>
        <span>Crypto Miner Arcadia · CMA</span>
        <LanguageSwitcher />
      </div>
    </footer>
  );
}
