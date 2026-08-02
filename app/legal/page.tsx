import { PublicInfoHeader } from "../PublicInfoHeader";
import { PublicSiteFooter } from "../PublicSiteFooter";

export default function LegalPage() {
  return (
    <main className="public-info-page legal-page">
      <PublicInfoHeader label="DOCUMENTAÇÃO PÚBLICA" />

      <section className="public-info-hero">
        <span>VERSÃO PRELIMINAR · 02 DE AGOSTO DE 2026</span>
        <h1>Regras transparentes para uma operação global.</h1>
        <p>
          Estes documentos descrevem o produto já implementado. Antes de aceitar
          dinheiro real, a empresa, o país de constituição, o controlador dos dados
          e a jurisdição contratual precisam ser preenchidos e revisados por advogado.
        </p>
        <nav className="legal-jump-links" aria-label="Seções dos documentos">
          <a href="#terms">TERMOS</a>
          <a href="#privacy">PRIVACIDADE</a>
          <a href="#cookies">COOKIES</a>
          <a href="#copyright">COPYRIGHT</a>
        </nav>
      </section>

      <section className="legal-warning">
        <strong>IMPORTANTE</strong>
        <p>
          “Global” não significa sem leis. As regras dependem do país da empresa,
          dos provedores e de onde cada usuário está. O lançamento poderá bloquear
          regiões não atendidas e exigir identidade, idade e origem dos recursos.
        </p>
      </section>

      <article className="public-legal-document" id="terms">
        <header>
          <span>DOCUMENTO 01</span>
          <h2>Termos de Uso — minuta de pré-lançamento</h2>
        </header>
        <section>
          <h3>1. Natureza do produto</h3>
          <p>
            Crypto Miner Arcadia é um jogo de mineração virtual. Poder de mineração,
            racks, mineradores, salas, energia, CMA e recompensas são elementos do jogo.
            Eles não representam participação societária, depósito bancário, valor mobiliário
            nem promessa de rendimento.
          </p>
        </section>
        <section>
          <h3>2. Conta e elegibilidade</h3>
          <p>
            O lançamento com recursos financeiros será destinado somente a maiores de
            18 anos ou à idade legal superior aplicável. O usuário deve fornecer e-mail
            válido, proteger a senha e não criar contas para burlar limites, sanções ou controles.
          </p>
        </section>
        <section>
          <h3>3. Kit inicial e economia</h3>
          <p>
            Uma conta nova recebe apenas um rack e um minerador inicial. Não recebe CMA,
            bateria, gerador ou energia. Recompensas de blocos são fixadas no servidor e
            divididas conforme as regras publicadas, podendo ser alteradas para blocos futuros.
          </p>
        </section>
        <section>
          <h3>4. CMA, BTC e DOGE</h3>
          <p>
            CMA é crédito interno, não é criptomoeda sacável e não pode ser resgatado por
            dinheiro. Quando habilitados, depósitos BTC/DOGE dependerão de confirmação do
            provedor. Conversões para CMA são definitivas após a confirmação mostrada na tela.
          </p>
        </section>
        <section>
          <h3>5. Automação, fraude e suspensão</h3>
          <p>
            Bots, scripts, múltiplas contas coordenadas, adulteração de provas, exploração de
            falhas e chargebacks fraudulentos são proibidos. O Arcadia pode limitar ações,
            reter recompensas para análise e suspender contas, mantendo trilha de auditoria.
          </p>
        </section>
        <section>
          <h3>6. Disponibilidade e alterações</h3>
          <p>
            O serviço pode passar por manutenção e ajustes de balanceamento. Alterações
            relevantes serão informadas antes de valerem para novas compras ou operações.
            Não há garantia de disponibilidade ininterrupta ou retorno financeiro.
          </p>
        </section>
        <section>
          <h3>7. Jurisdição pendente</h3>
          <p>
            Razão social, endereço, lei aplicável, foro e canal formal de disputa serão
            inseridos somente após a constituição da empresa e revisão profissional. Esta
            minuta não deve ser usada para ativar dinheiro real antes disso.
          </p>
        </section>
      </article>

      <article className="public-legal-document" id="privacy">
        <header>
          <span>DOCUMENTO 02</span>
          <h2>Política de Privacidade — minuta de pré-lançamento</h2>
        </header>
        <section>
          <h3>Dados utilizados</h3>
          <p>
            E-mail confirmado, nome de operador, identificadores técnicos, sessão, progresso,
            inventário, partidas, sinais antifraude, histórico de livro-razão e IDs de faturas.
            O Arcadia não deve receber seed phrase ou chave privada.
          </p>
        </section>
        <section>
          <h3>Finalidades</h3>
          <p>
            Autenticar, manter o jogo, impedir abuso, calcular recompensas, atender suporte,
            reconciliar depósitos e cumprir obrigações legais. Dados não serão vendidos como
            lista de marketing.
          </p>
        </section>
        <section>
          <h3>Prestadores e transferências</h3>
          <p>
            Cloudflare processará tráfego e hospedagem; Supabase processará identidade;
            provedores de e-mail e pagamento processarão apenas o necessário para seus fluxos.
            Regiões de armazenamento e mecanismos de transferência serão publicados no lançamento.
          </p>
        </section>
        <section>
          <h3>Retenção e direitos</h3>
          <p>
            Histórico operacional visível pode ser limitado a 30 dias, enquanto registros de
            segurança, contabilidade e obrigações legais podem durar mais. O usuário poderá
            solicitar acesso, correção ou exclusão, sujeito a retenções obrigatórias e prevenção de fraude.
          </p>
        </section>
        <section>
          <h3>Segurança</h3>
          <p>
            São usados HTTPS, sessões verificadas, autorização no servidor, limites de frequência,
            idempotência financeira, auditoria e cópias de recuperação. Nenhum sistema é infalível;
            incidentes serão tratados conforme as leis aplicáveis.
          </p>
        </section>
      </article>

      <article className="public-legal-document" id="cookies">
        <header>
          <span>DOCUMENTO 03</span>
          <h2>Política de Cookies</h2>
        </header>
        <section>
          <h3>Essenciais</h3>
          <p>
            Cookies de sessão do Supabase mantêm o login e são necessários para a conta.
            Preferências locais guardam opções como legibilidade e moeda exibida. Cookies
            essenciais não dependem de publicidade.
          </p>
        </section>
        <section>
          <h3>Medição e publicidade</h3>
          <p>
            O Arcadia não ativa cookies de anúncios nesta fase. Qualquer ferramenta futura
            de medição ou publicidade será documentada, separada por finalidade e submetida
            ao consentimento quando exigido.
          </p>
        </section>
      </article>

      <article className="public-legal-document" id="copyright">
        <header>
          <span>DOCUMENTO 04</span>
          <h2>Propriedade intelectual e copyright</h2>
        </header>
        <section>
          <h3>Direitos do Arcadia</h3>
          <p>
            © 2026 Crypto Miner Arcadia. Todos os direitos reservados. Código, identidade,
            textos, economia, layouts e ativos originais do projeto não podem ser copiados,
            redistribuídos ou explorados comercialmente sem autorização.
          </p>
        </section>
        <section>
          <h3>Referências e ativos de terceiros</h3>
          <p>
            Antes do lançamento público, todo GIF, sprite, fonte, som e imagem deverá possuir
            autoria própria, licença comercial comprovada ou substituição. Marcas e moedas de
            terceiros pertencem a seus respectivos titulares e não indicam endosso.
          </p>
        </section>
      </article>

      <PublicSiteFooter />
    </main>
  );
}

