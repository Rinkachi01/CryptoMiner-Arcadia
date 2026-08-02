import { ArcadiaGame } from "./ArcadiaGame";
import {
  arcadiaSignInPath,
  arcadiaSignOutPath,
  getArcadiaUser,
} from "./identity-server";
import { GameErrorBoundary } from "./GameErrorBoundary";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getArcadiaUser();

  if (!user) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="login-brand-mark">CMA</div>
          <span>CRYPTO MINER ARCADIA</span>
          <h1>Sua operação começa com uma conta protegida.</h1>
          <p>
            Entre na sua operação ou crie uma conta nova. Durante a beta privada,
            as duas opções usam a proteção de identidade do ChatGPT.
          </p>
          <div className="login-actions">
            <a href={arcadiaSignInPath("/")}>ENTRAR</a>
            <a className="secondary" href={arcadiaSignInPath("/")}>CRIAR CONTA</a>
          </div>
          <div className="login-access-status">
            <strong>BETA PRIVADO</strong>
            <span>Entrar com ChatGPT · conta criada no primeiro acesso</span>
          </div>
          <small>
            Uma conta nova recebe somente o rack e o minerador inicial. Nenhum CMA,
            bateria ou energia é concedido no cadastro. O cadastro por e-mail será
            conectado antes da abertura pública, com migração do progresso da beta.
          </small>
        </section>
      </main>
    );
  }

  return (
    <GameErrorBoundary>
      <ArcadiaGame
        user={{
          displayName: user.displayName,
          email: user.email,
        }}
        signOutPath={arcadiaSignOutPath("/")}
      />
    </GameErrorBoundary>
  );
}
