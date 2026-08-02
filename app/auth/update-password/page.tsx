import { PublicSiteFooter } from "../../PublicSiteFooter";
import { publicLoginConfig } from "../../supabase-server";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const dynamic = "force-dynamic";

export default function UpdatePasswordPage() {
  const config = publicLoginConfig();
  return (
    <main className="public-page-shell">
      {config?.enabled ? (
        <UpdatePasswordForm
          publishableKey={config.publishableKey}
          supabaseUrl={config.url}
        />
      ) : (
        <section className="public-status-card">
          <span>ACESSO CONTROLADO</span>
          <h1>Recuperação indisponível nesta implantação.</h1>
          <p>Volte ao suporte e confira o canal oficial antes de tentar novamente.</p>
          <div><a href="/support">ABRIR SUPORTE</a></div>
        </section>
      )}
      <PublicSiteFooter />
    </main>
  );
}

