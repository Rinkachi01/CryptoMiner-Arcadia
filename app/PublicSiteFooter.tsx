export function PublicSiteFooter() {
  return (
    <footer className="public-site-footer">
      <div className="public-footer-main">
        <section className="public-footer-brand" aria-label="Crypto Miner Arcadia">
          <strong>CRYPTO MINER<br />ARCADIA</strong>
          <span>MineraÃ§Ã£o virtual · entretenimento digital</span>
          <a className="public-footer-cta" href="/auth?mode=signup">COMEÃ‡AR A JOGAR</a>
        </section>

        <section className="public-footer-column">
          <h2>NAVEGAÃ‡ÃƒO</h2>
          <nav aria-label="Links rÃ¡pidos">
            <a href="/">Sala de mineraÃ§Ã£o</a>
            <a href="/faq">FAQ</a>
            <a href="/support">Suporte</a>
            <a href="/legal">Documentos</a>
          </nav>
        </section>

        <section className="public-footer-column">
          <h2>CONTA E SEGURANÃ‡A</h2>
          <nav aria-label="Conta e seguranÃ§a">
            <a href="/auth?mode=signin">Entrar</a>
            <a href="/auth?mode=signup">Criar conta</a>
            <a href="/legal#privacy">Privacidade</a>
            <a href="/legal#cookies">Cookies</a>
          </nav>
        </section>

        <section className="public-footer-column public-footer-contact">
          <h2>FALE CONOSCO</h2>
          <p>Atendimento oficial para conta, depÃ³sitos e seguranÃ§a.</p>
          <a href="mailto:support@cryptominerarcadia.com">support@cryptominerarcadia.com</a>
          <span>Responderemos pelo protocolo dentro do site.</span>
        </section>
      </div>

      <div className="public-footer-bottom">
        <small>Â© 2026 Crypto Miner Arcadia. Todos os direitos reservados.</small>
        <span>Projeto de entretenimento digital · CMA Ã© crÃ©dito interno</span>
      </div>
    </footer>
  );
}
