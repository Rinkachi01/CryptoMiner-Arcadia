import { ArcadiaGame } from "./ArcadiaGame";
import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
} from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

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
          <a href={chatGPTSignInPath("/")}>ENTRAR COM CHATGPT</a>
          <small>O navegador não controla mais o saldo ou o inventário.</small>
        </section>
      </main>
    );
  }

  return (
    <ArcadiaGame
      user={{
        displayName: user.displayName,
        email: user.email,
      }}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
