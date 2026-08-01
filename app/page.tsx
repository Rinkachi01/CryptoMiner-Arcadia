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
            Entre com o ChatGPT para manter salas, equipamentos, energia,
            compras, pools e blocos salvos no servidor.
          </p>
          <a href={arcadiaSignInPath("/")}>ENTRAR COM CHATGPT</a>
          <div className="login-access-status">
            <strong>BETA PRIVADO</strong>
            <span>Login atual protegido pelo ChatGPT</span>
          </div>
          <small>
            O cadastro por e-mail será conectado antes do beta público, com
            migração do progresso desta conta.
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
