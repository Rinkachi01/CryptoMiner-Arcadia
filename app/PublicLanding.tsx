"use client";

import { useArcadiaLanguage } from "./i18n";

type PublicLandingProps = {
  signInPath: string;
  signUpPath: string;
};

export function PublicLanding({ signInPath, signUpPath }: PublicLandingProps) {
  const { t } = useArcadiaLanguage();

  return (
    <div className="login-entry-layout">
      <section className="login-showcase" aria-labelledby="public-landing-title">
        <span className="login-kicker">{t("landing.kicker")}</span>
        {/* The image is served directly from the Workers-compatible public asset manifest. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="login-showcase-banner"
          src="/og-arcade-v3.png"
          alt={t("landing.bannerAlt")}
        />
        <h1 id="public-landing-title">{t("landing.title")}</h1>
        <p>{t("landing.description")}</p>
        <div className="login-feature-grid">
          <article>
            <b>04</b>
            <strong>{t("landing.poolsTitle")}</strong>
            <span>{t("landing.poolsDescription")}</span>
          </article>
          <article>
            <b>10m</b>
            <strong>{t("landing.blockTitle")}</strong>
            <span>{t("landing.blockDescription")}</span>
          </article>
          <article>
            <b>12h</b>
            <strong>{t("landing.energyTitle")}</strong>
            <span>{t("landing.energyDescription")}</span>
          </article>
        </div>
        <div className="login-beta-note">
          <span aria-hidden="true" />
          {t("landing.protectionNote")}
        </div>

        <section className="login-onboarding" aria-labelledby="login-onboarding-title">
          <div className="login-onboarding-heading">
            <span className="login-kicker">{t("landing.onboardingEyebrow")}</span>
            <h2 id="login-onboarding-title">{t("landing.onboardingTitle")}</h2>
          </div>
          <div className="login-onboarding-grid">
            {[
              ["01", "landing.stepOneTitle", "landing.stepOneDescription"],
              ["02", "landing.stepTwoTitle", "landing.stepTwoDescription"],
              ["03", "landing.stepThreeTitle", "landing.stepThreeDescription"],
            ].map(([number, titleKey, descriptionKey]) => (
              <article className="login-step" key={number}>
                <b>{number}</b>
                <h3>{t(titleKey)}</h3>
                <p>{t(descriptionKey)}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="login-community-cta">
          <div>
            <strong>{t("landing.communityTitle")}</strong>
            <p>{t("landing.communityDescription")}</p>
          </div>
          <nav aria-label={t("landing.communityTitle")}>
            <a href="/faq">{t("landing.communityFaq")}</a>
            <a href="/support">{t("landing.communitySupport")}</a>
            <a href="https://discord.gg/XGW4JzrTP" target="_blank" rel="noopener noreferrer">
              {t("landing.communityDiscord")}
            </a>
          </nav>
        </aside>
      </section>

      <section className="login-card" aria-labelledby="public-login-title">
        <div className="login-brand-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/brand/cma-coin.png" alt={t("landing.brandAlt")} />
        </div>
        <span>{t("landing.brand")}</span>
        <h2 id="public-login-title">{t("landing.cardTitle")}</h2>
        <p>{t("landing.cardDescription")}</p>
        <div className="login-actions">
          <a href={signInPath}>{t("landing.signIn")}</a>
          <a className="secondary" href={signUpPath}>{t("landing.signUp")}</a>
        </div>
        <div className="login-access-status">
          <strong>{t("landing.accessStatus")}</strong>
          <span>{t("landing.accessStatusDetail")}</span>
        </div>
        <small>{t("landing.accountNote")}</small>
      </section>
    </div>
  );
}
