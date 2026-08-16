"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ArcadiaLocale = "pt-BR" | "en";
type Localized = [string, string];

const supportedLocales: ArcadiaLocale[] = ["pt-BR", "en"];
// v2 makes the new English-first default effective for visitors who had the
// old browser-detected Portuguese value cached before the international launch.
const localeStorageKey = "arcadia-locale-v2";
const localeCookieKey = "arcadia_locale";

// Keep the dictionary small and shared so every visible shell label changes with the selector.
const entries: Record<string, Localized> = {
  "nav.mine": ["Sala de mineração", "Mining room"],
  "nav.pools": ["Pools", "Pools"],
  "nav.conversion": ["Carteira", "Wallet"],
  "nav.inventory": ["Inventário", "Inventory"],
  "nav.shop": ["Loja", "Shop"],
  "nav.games": ["Minigames", "Minigames"],
  "nav.season": ["Temporada", "Season"],
  "nav.leaderboard": ["Ranking global", "Global ranking"],
  "nav.tasks": ["Tarefas", "Tasks"],
  "nav.career": ["Central do operador", "Operator center"],
  "nav.short.mine": ["Sala", "Room"],
  "nav.short.pools": ["Pools", "Pools"],
  "nav.short.conversion": ["Carteira", "Wallet"],
  "nav.short.inventory": ["Itens", "Items"],
  "nav.short.shop": ["Loja", "Shop"],
  "nav.short.games": ["Jogos", "Games"],
  "nav.short.season": ["Temporada", "Season"],
  "nav.short.leaderboard": ["Ranking", "Ranking"],
  "nav.short.tasks": ["Tarefas", "Tasks"],
  "nav.short.career": ["Carreira", "Career"],
  "nav.support": ["Central de suporte", "Support center"],
  "nav.owner": ["Central do proprietário", "Owner console"],
  "language.label": ["Idioma", "Language"],
  "language.pt": ["Português", "Portuguese"],
  "language.en": ["Inglês", "English"],
  "profile.open": ["Abrir meu perfil", "Open my profile"],
  "profile.account": ["Conta protegida", "Protected account"],
  "account.signout": ["Sair", "Sign out"],
  "account.connecting": ["Conectando", "Connecting"],
  "status.progress": ["PROGRESSO PROTEGIDO · VERSÃO {version}", "PROTECTED PROGRESS · VERSION {version}"],
  "status.loading": ["CARREGANDO SUA CONTA SEGURA", "LOADING YOUR SECURE ACCOUNT"],
  "status.error": ["SERVIDOR INDISPONÍVEL · AÇÕES BLOQUEADAS", "SERVER UNAVAILABLE · ACTIONS BLOCKED"],
  "status.block": ["BLOCO SINCRONIZADO #{block}", "SYNCHRONIZED BLOCK #{block}"],
  "sync.error": ["Não foi possível sincronizar sua conta", "We could not sync your account"],
  "sync.loading": ["Sincronizando sua conta", "Syncing your account"],
  "sync.errorDescription": ["Seu saldo, nome e poder continuam protegidos. Tente novamente para carregar os dados do servidor.", "Your balance, name and power remain protected. Try again to load the server data."],
  "sync.loadingDescription": ["Carregando saldo, poder e equipamentos salvos no servidor.", "Loading your balance, power and saved equipment from the server."],
  "sync.retry": ["Tentar novamente", "Try again"],
  "sidebar.operator": ["Operador", "Operator"],
  "sidebar.serverAccount": ["Conta no servidor", "Server account"],
  "sidebar.virtualSimulation": ["Simulação virtual", "Virtual simulation"],
  "sidebar.simulationDescription": ["Operação virtual com progresso e economia controlados pelo servidor.", "Virtual operation with progress and economy controlled by the server."],
  "sidebar.navigation": ["Navegação principal", "Main navigation"],
  "sidebar.terms": ["Termos e privacidade", "Terms and privacy"],
  "workspace.rack": ["Controle de rack", "Rack control"],
  "workspace.shopEyebrow": ["Mercado Arcadia · equipamentos e energia", "Arcadia market · equipment and energy"],
  "workspace.walletEyebrow": ["Carteira do operador · saldos e conversão", "Operator wallet · balances and conversion"],
  "workspace.gamesEyebrow": ["Arcade Arcadia · minigames online", "Arcadia Arcade · online minigames"],
  "workspace.seasonEyebrow": ["Temporada 01 · Corrida Espacial", "Season 01 · Space Race"],
  "workspace.leaderboardEyebrow": ["Ranking global · maiores mineradores", "Global ranking · top miners"],
  "workspace.tasksEyebrow": ["Central de tarefas · missões e feedback", "Task center · missions and feedback"],
  "workspace.careerEyebrow": ["Central do operador · progresso e missões", "Operator center · progress and missions"],
  "workspace.mineEyebrow": ["Sala de mineração", "Mining room"],
  "workspace.manage": ["Gerenciar equipamentos", "Manage equipment"],
  "workspace.mine": ["Sua sala de mineração", "Your mining room"],
  "workspace.pools": ["Pools de mineração", "Mining pools"],
  "workspace.wallet": ["Carteira e conversão", "Wallet and conversion"],
  "workspace.inventory": ["Inventário de equipamentos", "Equipment inventory"],
  "workspace.shop": ["Loja de equipamentos", "Equipment shop"],
  "workspace.games": ["Central de minigames", "Minigame center"],
  "workspace.season": ["Passe da temporada", "Season pass"],
  "workspace.tasks": ["Central de tarefas", "Task center"],
  "workspace.career": ["Carreira do operador", "Operator career"],
  "metric.minerPower": ["Poder dos mineradores", "Miner power"],
  "metric.gamePower": ["Poder dos minigames", "Minigame power"],
  "metric.racks": ["Racks nesta sala", "Racks in this room"],
  "metric.energy": ["Energia", "Energy"],
  "metric.batteries": ["baterias", "batteries"],
  "metric.mainNetwork": ["Rede principal", "Main network"],
  "metric.useBattery": ["Use uma bateria", "Use a battery"],
  "metric.batteryPowered": ["Alimentado por bateria", "Battery powered"],
  "metric.noBattery": ["Sem bateria", "No battery"],
  "metric.playToGenerate": ["Jogue para gerar", "Play to generate"],
  "metric.free": ["livres", "free"],
  "wallet.title": ["Carteira virtual", "Virtual wallet"],
  "wallet.withdrawal": ["saque manual de BTC/DOGE/LTC", "manual BTC/DOGE/LTC withdrawal"],
  "wallet.showing": ["Exibindo", "Showing"],
  "wallet.pin": ["Fixar", "Pin"],
  "wallet.open": ["Abrir carteira", "Open wallet"],
  "wallet.convert": ["Converter", "Convert"],
  "block.single": ["Bloco minerado", "Block mined"],
  "block.multiple": ["Blocos minerados", "Blocks mined"],
  "block.singleDescription": ["O bloco #{block} foi processado.", "Block #{block} was processed."],
  "block.multipleDescription": ["{count} blocos foram processados até o #{block}.", "{count} blocks were processed through #{block}."],
  "block.synced": ["Recompensa e extrato sincronizados pelo servidor.", "Reward and ledger synced by the server."],
  "block.close": ["Fechar aviso de bloco", "Close block notice"],
  "footer.brandSubtitle": ["Mineração virtual · entretenimento digital", "Virtual mining · digital entertainment"],
  "footer.start": ["Começar a jogar", "Start playing"],
  "footer.navigation": ["Navegação", "Navigation"],
  "footer.account": ["Conta e segurança", "Account and security"],
  "footer.contact": ["Fale conosco", "Contact us"],
  "footer.contactDescription": ["Suporte, novidades e comunidade oficial.", "Official support, updates and community."],
  "footer.discordDescription": ["Suporte, novidades e comunidade oficial.", "Official support, updates and community."],
  "footer.discord": ["Entrar no Discord", "Join Discord"],
  "footer.discordNote": ["Acesse o servidor oficial do Arcadia.", "Open the official Arcadia server."],
  "footer.email": ["E-mail de suporte", "Support email"],
  "footer.emailNote": ["Conta, pagamentos e atendimento.", "Account, payments and support."],
  "footer.reply": ["Responderemos pelo protocolo dentro do site.", "We reply through an in-site ticket."],
  "footer.documents": ["Documentos", "Documents"],
  "footer.terms": ["Termos de uso", "Terms of use"],
  "footer.privacy": ["Privacidade", "Privacy"],
  "footer.risk": ["Aviso de risco", "Risk disclosure"],
  "footer.cookies": ["Cookies", "Cookies"],
  "footer.rights": ["Todos os direitos reservados.", "All rights reserved."],
  "landing.kicker": ["ECONOMIA CONTROLADA PELO SERVIDOR", "SERVER-CONTROLLED ECONOMY"],
  "landing.bannerAlt": ["Crypto Miner Arcadia com mineradores e minigames", "Crypto Miner Arcadia with miners and minigames"],
  "landing.title": ["Construa sua operação. Dispute blocos globais.", "Build your operation. Compete for global blocks."],
  "landing.description": ["Monte salas, organize racks, energize seus mineradores e divida seu poder entre CMA, Bitcoin, Dogecoin e Litecoin. Todas as recompensas são conferidas pelo servidor.", "Build rooms, arrange racks, power your miners, and distribute your power across CMA, Bitcoin, Dogecoin, and Litecoin. Every reward is verified by the server."],
  "landing.poolsTitle": ["POOLS GLOBAIS", "GLOBAL POOLS"],
  "landing.poolsDescription": ["CMA, BTC, DOGE e LTC com distribuição livre de poder.", "CMA, BTC, DOGE, and LTC with flexible power allocation."],
  "landing.blockTitle": ["BLOCO FIXO", "FIXED BLOCK"],
  "landing.blockDescription": ["Mais poder altera a participação, não a emissão total.", "More power changes your share, not the total emission."],
  "landing.energyTitle": ["CICLO DE ENERGIA", "ENERGY CYCLE"],
  "landing.energyDescription": ["Baterias e Arcade mantêm a operação ativa.", "Batteries and the Arcade keep your operation active."],
  "landing.protectionNote": ["Progresso individual protegido e sincronizado por conta", "Individual progress protected and synced to your account"],
  "landing.onboardingEyebrow": ["COMO COMEÇAR", "GET STARTED"],
  "landing.onboardingTitle": ["Sua primeira operação em três passos.", "Your first operation in three steps."],
  "landing.stepOneTitle": ["Crie sua conta", "Create your account"],
  "landing.stepOneDescription": ["Confirme seu e-mail para manter o progresso seguro em qualquer dispositivo.", "Confirm your email to keep progress safe on every device."],
  "landing.stepTwoTitle": ["Monte o rack", "Set up your rack"],
  "landing.stepTwoDescription": ["Instale o rack inicial e encaixe seu minerador para começar a gerar poder.", "Install the starter rack and place your miner to begin generating power."],
  "landing.stepThreeTitle": ["Jogue e distribua", "Play and allocate"],
  "landing.stepThreeDescription": ["Jogue no Arcade, resgate baterias e distribua seu poder entre as pools.", "Play the Arcade, claim batteries, and allocate your power across pools."],
  "landing.communityTitle": ["Precisa de ajuda antes de entrar?", "Need help before you join?"],
  "landing.communityDescription": ["Consulte respostas rápidas, suporte e a comunidade oficial.", "Find quick answers, support, and the official community."],
  "landing.communityFaq": ["Ver FAQ", "Read FAQ"],
  "landing.communitySupport": ["Abrir suporte", "Open support"],
  "landing.communityDiscord": ["Entrar no Discord", "Join Discord"],
  "landing.brandAlt": ["Logo CMA", "CMA logo"],
  "landing.brand": ["CRYPTO MINER ARCADIA", "CRYPTO MINER ARCADIA"],
  "landing.cardTitle": ["Sua operação começa com uma conta protegida.", "Your operation starts with a protected account."],
  "landing.cardDescription": ["Entre na sua operação ou crie uma conta. O e-mail confirmado protege o seu progresso em qualquer dispositivo.", "Sign in to your operation or create an account. A confirmed email protects your progress on every device."],
  "landing.signIn": ["ENTRAR", "SIGN IN"],
  "landing.signUp": ["CRIAR CONTA", "CREATE ACCOUNT"],
  "landing.accessStatus": ["ACESSO PROTEGIDO", "PROTECTED ACCESS"],
  "landing.accessStatusDetail": ["Conta verificada · progresso no servidor", "Verified account · server-side progress"],
  "landing.accountNote": ["Uma conta nova recebe somente um rack e o minerador inicial. Nenhum CMA, bateria ou energia é concedido no cadastro.", "A new account receives only a rack and the starter miner. No CMA, battery, or energy is granted at signup."],
};

const localeIndex: Record<ArcadiaLocale, number> = { "pt-BR": 0, en: 1 };
const copy = Object.fromEntries(
  supportedLocales.map((locale) => [locale, Object.fromEntries(Object.entries(entries).map(([key, values]) => [key, values[localeIndex[locale]]]))]),
) as Record<ArcadiaLocale, Record<string, string>>;

function isArcadiaLocale(value: string | null): value is ArcadiaLocale {
  return Boolean(value && supportedLocales.includes(value as ArcadiaLocale));
}

function browserLocale(): ArcadiaLocale {
  // English is the platform default. Portuguese remains available through
  // the selector and is persisted only after the operator chooses it.
  return "en";
}

function applyLocale(next: ArcadiaLocale) {
  document.documentElement.lang = next;
  document.cookie = `${localeCookieKey}=${encodeURIComponent(next)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function formatTranslation(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

type LanguageContextValue = { locale: ArcadiaLocale; setLocale: (locale: ArcadiaLocale) => void; t: (key: string, fallback?: string) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<ArcadiaLocale>(() => {
    if (typeof window === "undefined") return "en";
    const saved = window.localStorage.getItem(localeStorageKey);
    return isArcadiaLocale(saved) ? saved : browserLocale();
  });

  useEffect(() => {
    applyLocale(locale);
    const sync = (event: StorageEvent) => {
      if (event.key === localeStorageKey && isArcadiaLocale(event.newValue)) {
        setLocaleState(event.newValue);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [locale]);

  const setLocale = (next: ArcadiaLocale) => {
    if (!supportedLocales.includes(next)) return;
    setLocaleState(next);
    window.localStorage.setItem(localeStorageKey, next);
  };
  const value = useMemo(() => ({ locale, setLocale, t: (key: string, fallback?: string) => copy[locale][key] ?? fallback ?? key }), [locale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useArcadiaLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useArcadiaLanguage must be used within LanguageProvider");
  return context;
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useArcadiaLanguage();
  return (
    <label className="language-switcher">
      <span className="sr-only">{t("language.label")}</span>
      <span aria-hidden="true">◎</span>
      <select value={locale} aria-label={t("language.label")} onChange={(event) => setLocale(event.target.value as ArcadiaLocale)}>
        <option value="pt-BR">{t("language.pt")}</option>
        <option value="en">{t("language.en")}</option>
      </select>
    </label>
  );
}
