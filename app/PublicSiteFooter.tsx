export function PublicSiteFooter() {
  return (
    <footer className="public-site-footer">
      <div className="public-footer-main">
        <section className="public-footer-brand" aria-label="Crypto Miner Arcadia">
          <strong>CRYPTO MINER<br />ARCADIA</strong>
          <span>Mineração virtual · entretenimento digital</span>
          <a className="public-footer-cta" href="/auth?mode=signup">COMEÇAR A JOGAR</a>
        </section>

        <section className="public-footer-column">
          <h2>NAVEGAÇÃO</h2>
          <nav aria-label="Links rápidos">
            <a href="/">Sala de mineração</a>
            <a href="/faq">FAQ</a>
            <a href="/support">Suporte</a>
            <a href="/legal">Documentos</a>
          </nav>
        </section>

        <section className="public-footer-column">
          <h2>CONTA E SEGURANÇA</h2>
          <nav aria-label="Conta e segurança">
            <a href="/auth?mode=signin">Entrar</a>
            <a href="/auth?mode=signup">Criar conta</a>
            <a href="/legal#privacy">Privacidade</a>
            <a href="/legal#cookies">Cookies</a>
          </nav>
        </section>

        <section className="public-footer-column public-footer-contact">
          <h2>FALE CONOSCO</h2>
          <p>Atendimento oficial para conta, depósitos e segurança.</p>
          <a href="mailto:support@cryptominerarcadia.com">support@cryptominerarcadia.com</a>
          <span>Responderemos pelo protocolo dentro do site.</span>
        </section>
      </div>

      <div className="public-footer-bottom">
        <small>© 2026 Crypto Miner Arcadia. Todos os direitos reservados.</small>
        <span>Projeto de entretenimento digital · CMA é crédito interno</span>
      </div>
    </footer>
  );
}
