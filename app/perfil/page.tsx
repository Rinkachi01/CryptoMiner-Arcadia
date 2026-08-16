import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { accountIdForUser, arcadiaSignInPath, arcadiaSignOutPath, getArcadiaUser } from "../identity-server";
import { PublicSiteFooter } from "../PublicSiteFooter";
import { LanguageSwitcher } from "../i18n";
import { publicLoginConfig } from "../supabase-server";
import { MfaSettings } from "./MfaSettings";

export const dynamic = "force-dynamic";

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"•".repeat(Math.max(1, name.length - visible.length))}@${domain}`;
}

export default async function ProfilePage() {
  const user = await getArcadiaUser();
  if (!user) redirect(arcadiaSignInPath("/perfil"));
  const accountId = await accountIdForUser(user);
  const shortId = `${accountId.slice(0, 8)}…${accountId.slice(-6)}`;
  const authConfig = publicLoginConfig();
  const english = (await cookies()).get("arcadia_locale")?.value !== "pt-BR";

  return (
    <main className="profile-page">
      <header className="profile-topbar">
        <a className="profile-brand" href="/">
          <span>CMA</span>
          <strong>CRYPTO MINER ARCADIA</strong>
        </a>
        <div className="profile-top-actions">
          <LanguageSwitcher />
          <a href={arcadiaSignOutPath("/", user.provider)}>{english ? "SIGN OUT" : "SAIR"}</a>
        </div>
      </header>

      <section className="profile-shell" aria-labelledby="profile-title">
        <div className="profile-heading">
          <div>
            <span>{english ? "ARCADIA ACCOUNT" : "CONTA ARCADIA"}</span>
            <h1 id="profile-title">{english ? "My profile" : "Meu perfil"}</h1>
            <p>{english ? "Manage your identity, security, and preferences in one place." : "Gerencie sua identidade, segurança e preferências em um só lugar."}</p>
          </div>
          <a className="profile-back-link" href="/sala">← {english ? "Back to the room" : "Voltar para a sala"}</a>
        </div>

        <div className="profile-grid">
          <article className="profile-identity-card">
            <div className="profile-avatar">
              <span>{user.displayName.trim().charAt(0).toLocaleUpperCase("pt-BR") || "M"}</span>
            </div>
            <span className="profile-kicker">{english ? "PROTECTED ACCOUNT" : "CONTA PROTEGIDA"}</span>
            <h2>{user.displayName}</h2>
            <p>{maskEmail(user.email)}</p>
            <div className="profile-status-pill"><i /> {english ? "Verified session" : "Sessão verificada"}</div>
          </article>

          <div className="profile-detail-stack">
            <article className="profile-panel">
              <header><span>{english ? "IDENTITY" : "IDENTIDADE"}</span><strong>{english ? "Account details" : "Dados da conta"}</strong></header>
              <dl>
                <div><dt>{english ? "Display name" : "Nome de exibição"}</dt><dd>{user.displayName}</dd></div>
                <div><dt>{english ? "Email" : "E-mail"}</dt><dd>{maskEmail(user.email)}</dd></div>
                <div><dt>{english ? "Internal ID" : "ID interno"}</dt><dd>{shortId}</dd></div>
              </dl>
            </article>
            <article className="profile-panel profile-security-panel">
              <header><span>{english ? "SECURITY" : "SEGURANÇA"}</span><strong>{english ? "Good practices" : "Boas práticas"}</strong></header>
              <p>{english ? "Arcadia support never asks for your password, authentication code, or private key." : "O Arcadia nunca solicita senha, código de autenticação ou chave privada pelo suporte."}</p>
              <div className="profile-actions">
                <a href="/auth/update-password">{english ? "Change password" : "Trocar senha"}</a>
                <a href="/support">{english ? "Open support" : "Abrir suporte"}</a>
                <a href="/legal#privacy">{english ? "Privacy" : "Privacidade"}</a>
              </div>
            </article>
            {authConfig?.enabled && (
              <MfaSettings
                publishableKey={authConfig.publishableKey}
                supabaseUrl={authConfig.url}
              />
            )}
          </div>
        </div>

        <section className="profile-shortcuts" aria-label={english ? "Account shortcuts" : "Atalhos da conta"}>
          <a href="/carteira"><span>W</span><div><strong>{english ? "Wallet" : "Carteira"}</strong><small>{english ? "Balances and conversions" : "Saldos e conversões"}</small></div></a>
          <a href="/inventario"><span>I</span><div><strong>{english ? "Inventory" : "Inventário"}</strong><small>{english ? "Miners and racks" : "Mineradores e racks"}</small></div></a>
          <a href="/support"><span>?</span><div><strong>{english ? "Support" : "Suporte"}</strong><small>{english ? "Your account tickets" : "Protocolos da sua conta"}</small></div></a>
        </section>
      </section>
      <PublicSiteFooter />
    </main>
  );
}
