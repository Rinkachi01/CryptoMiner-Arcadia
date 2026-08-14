import Link from "next/link";
import { LanguageSwitcher } from "./i18n";

export function PublicInfoHeader({ label }: { label: string }) {
  return (
    <header className="public-info-header">
      <Link className="public-info-brand" href="/">
        <span>CMA</span>
        <div>
          <strong>CRYPTO MINER ARCADIA</strong>
          <small>{label}</small>
        </div>
      </Link>
      <div className="public-info-actions">
        <nav aria-label="Navegação pública">
          <Link href="/">JOGO</Link>
          <a href="/faq">FAQ</a>
          <a href="/support">SUPORTE</a>
          <a href="/legal">DOCUMENTOS</a>
        </nav>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
