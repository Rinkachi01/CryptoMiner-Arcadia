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
            <a href="/operador?tab=referrals">{isPortuguese ? "Programa de indicação" : "Referral program"}</a>
            <a href="/legal">{t("footer.documents")}</a>
            <a href="/perfil">{t("profile.open")}</a>
          </nav>
        </section>
        <section className="public-footer-column">
          <h2>{t("footer.account")}</h2>
          <nav aria-label={t("footer.account")}>
            <a href="/auth?mode=signin">{isPortuguese ? "Entrar" : "Sign in"}</a>
            <a href="/auth?mode=signup">{isPortuguese ? "Criar conta" : "Create account"}</a>
            <a href="/legal#terms">{t("footer.terms")}</a>
            <a href="/legal#privacy">{t("footer.privacy")}</a>
            <a href="/legal#risk">{t("footer.risk")}</a>
            <a href="/legal#cookies">{t("footer.cookies")}</a>
          </nav>
        </section>
        <section className="public-footer-column public-footer-contact">
          <h2>{t("footer.contact")}</h2>
          <p>{t("footer.contactDescription")}</p>
          <div className="public-footer-contact-links">
            <a
              className="public-footer-contact-link public-footer-email-link"
              href="mailto:support@cryptominerarcadia.com"
              aria-label="support@cryptominerarcadia.com"
            >
              <span className="public-footer-contact-icon" aria-hidden="true">{"\u2709"}</span>
              <span>
                <strong>support@cryptominerarcadia.com</strong>
                <small>{t("footer.emailNote")}</small>
              </span>
            </a>
            <a
              className="public-footer-contact-link public-footer-discord"
              href="https://discord.gg/Kj4c4PFe8"
              target="_blank"
              rel="noopener noreferrer"
              title={t("footer.discord")}
              aria-label={t("footer.discord")}
            >
              <span className="public-footer-contact-icon" aria-hidden="true">{"\uD83D\uDCAC"}</span>
              <span>
                <strong>{t("footer.discord")}</strong>
                <small>{t("footer.discordNote")}</small>
              </span>
            </a>
          </div>
        </section>
      </div>
      <div className="public-footer-bottom">
        <small>{"©"} 2026 Crypto Miner Arcadia. {t("footer.rights")}</small>
        <span>Crypto Miner Arcadia {"·"} CMA</span>
        <LanguageSwitcher />
      </div>
    </footer>
  );
}
