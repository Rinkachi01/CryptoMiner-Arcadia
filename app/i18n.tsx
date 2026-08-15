"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ArcadiaLocale = "pt-BR" | "en";
type Localized = [string, string, string, string];

const supportedLocales: ArcadiaLocale[] = ["pt-BR", "en"];
const localeStorageKey = "arcadia-locale";
const localeCookieKey = "arcadia_locale";

// Keep the dictionary small and shared so every visible shell label changes with the selector.
const entries: Record<string, Localized> = {
  "nav.mine": ["Sala de mineração", "Mining room", "Sala de minería", "Salle de minage"],
  "nav.pools": ["Pools", "Pools", "Pools", "Pools"],
  "nav.conversion": ["Carteira", "Wallet", "Cartera", "Portefeuille"],
  "nav.inventory": ["Inventário", "Inventory", "Inventario", "Inventaire"],
  "nav.shop": ["Loja", "Shop", "Tienda", "Boutique"],
  "nav.games": ["Minigames", "Minigames", "Minijuegos", "Mini-jeux"],
  "nav.season": ["Temporada", "Season", "Temporada", "Saison"],
  "nav.leaderboard": ["Ranking global", "Global ranking", "Ranking global", "Classement global"],
  "nav.tasks": ["Tarefas", "Tasks", "Tareas", "Tâches"],
  "nav.career": ["Central do operador", "Operator center", "Centro del operador", "Centre opérateur"],
  "nav.short.mine": ["Sala", "Room", "Sala", "Salle"],
  "nav.short.pools": ["Pools", "Pools", "Pools", "Pools"],
  "nav.short.conversion": ["Carteira", "Wallet", "Cartera", "Portefeuille"],
  "nav.short.inventory": ["Itens", "Items", "Objetos", "Objets"],
  "nav.short.shop": ["Loja", "Shop", "Tienda", "Boutique"],
  "nav.short.games": ["Jogos", "Games", "Juegos", "Jeux"],
  "nav.short.season": ["Temporada", "Season", "Temporada", "Saison"],
  "nav.short.leaderboard": ["Ranking", "Ranking", "Ranking", "Classement"],
  "nav.short.tasks": ["Tarefas", "Tasks", "Tareas", "Tâches"],
  "nav.short.career": ["Carreira", "Career", "Carrera", "Carrière"],
  "nav.support": ["Central de suporte", "Support center", "Centro de soporte", "Centre d’aide"],
  "nav.owner": ["Central do proprietário", "Owner console", "Consola del propietario", "Console propriétaire"],
  "language.label": ["Idioma", "Language", "Idioma", "Langue"],
  "language.pt": ["Português", "Portuguese", "Português", "Portugais"],
  "language.en": ["Inglês", "English", "Inglés", "Anglais"],
  "profile.open": ["Abrir meu perfil", "Open my profile", "Abrir mi perfil", "Ouvrir mon profil"],
  "profile.account": ["Conta protegida", "Protected account", "Cuenta protegida", "Compte protégé"],
  "account.signout": ["Sair", "Sign out", "Salir", "Se déconnecter"],
  "account.connecting": ["Conectando", "Connecting", "Conectando", "Connexion"],
  "status.progress": ["PROGRESSO PROTEGIDO · VERSÃO {version}", "PROTECTED PROGRESS · VERSION {version}", "PROGRESO PROTEGIDO · VERSIÓN {version}", "PROGRESSION PROTÉGÉE · VERSION {version}"],
  "status.loading": ["CARREGANDO SUA CONTA SEGURA", "LOADING YOUR SECURE ACCOUNT", "CARGANDO TU CUENTA SEGURA", "CHARGEMENT DE VOTRE COMPTE SÉCURISÉ"],
  "status.error": ["SERVIDOR INDISPONÍVEL · AÇÕES BLOQUEADAS", "SERVER UNAVAILABLE · ACTIONS BLOCKED", "SERVIDOR NO DISPONIBLE · ACCIONES BLOQUEADAS", "SERVEUR INDISPONIBLE · ACTIONS BLOQUÉES"],
  "status.block": ["BLOCO SINCRONIZADO #{block}", "SYNCHRONIZED BLOCK #{block}", "BLOQUE SINCRONIZADO #{block}", "BLOC SYNCHRONISÉ #{block}"],
  "sync.error": ["Não foi possível sincronizar sua conta", "We could not sync your account", "No fue posible sincronizar tu cuenta", "Impossible de synchroniser votre compte"],
  "sync.loading": ["Sincronizando sua conta", "Syncing your account", "Sincronizando tu cuenta", "Synchronisation de votre compte"],
  "sync.errorDescription": ["Seu saldo, nome e poder continuam protegidos. Tente novamente para carregar os dados do servidor.", "Your balance, name and power remain protected. Try again to load the server data.", "Tu saldo, nombre y poder siguen protegidos. Intenta de nuevo para cargar los datos del servidor.", "Votre solde, votre nom et votre puissance restent protégés. Réessayez pour charger les données du serveur."],
  "sync.loadingDescription": ["Carregando saldo, poder e equipamentos salvos no servidor.", "Loading your balance, power and saved equipment from the server.", "Cargando saldo, poder y equipos guardados en el servidor.", "Chargement du solde, de la puissance et des équipements enregistrés."],
  "sync.retry": ["Tentar novamente", "Try again", "Intentar de nuevo", "Réessayer"],
  "sidebar.operator": ["Operador", "Operator", "Operador", "Opérateur"],
  "sidebar.serverAccount": ["Conta no servidor", "Server account", "Cuenta en el servidor", "Compte serveur"],
  "sidebar.virtualSimulation": ["Simulação virtual", "Virtual simulation", "Simulación virtual", "Simulation virtuelle"],
  "sidebar.simulationDescription": ["Operação virtual com progresso e economia controlados pelo servidor.", "Virtual operation with progress and economy controlled by the server.", "Operación virtual con progreso y economía controlados por el servidor.", "Opération virtuelle avec progression et économie contrôlées par le serveur."],
  "sidebar.navigation": ["Navegação principal", "Main navigation", "Navegación principal", "Navigation principale"],
  "sidebar.terms": ["Termos e privacidade", "Terms and privacy", "Términos y privacidad", "Conditions et confidentialité"],
  "workspace.rack": ["Controle de rack", "Rack control", "Control de rack", "Contrôle du rack"],
  "workspace.shopEyebrow": ["Mercado Arcadia · equipamentos e energia", "Arcadia market · equipment and energy", "Mercado Arcadia · equipos y energía", "Marché Arcadia · équipements et énergie"],
  "workspace.walletEyebrow": ["Carteira do operador · saldos e conversão", "Operator wallet · balances and conversion", "Cartera del operador · saldos y conversión", "Portefeuille opérateur · soldes et conversion"],
  "workspace.gamesEyebrow": ["Arcade Arcadia · minigames online", "Arcadia Arcade · online minigames", "Arcade Arcadia · minijuegos en línea", "Arcade Arcadia · mini-jeux en ligne"],
  "workspace.seasonEyebrow": ["Temporada 01 · Corrida Espacial", "Season 01 · Space Race", "Temporada 01 · Carrera espacial", "Saison 01 · Course spatiale"],
  "workspace.leaderboardEyebrow": ["Ranking global · maiores mineradores", "Global ranking · top miners", "Ranking global · mayores mineros", "Classement global · meilleurs mineurs"],
  "workspace.tasksEyebrow": ["Central de tarefas · missões e feedback", "Task center · missions and feedback", "Centro de tareas · misiones y comentarios", "Centre des tâches · missions et retours"],
  "workspace.careerEyebrow": ["Central do operador · progresso e missões", "Operator center · progress and missions", "Centro del operador · progreso y misiones", "Centre opérateur · progression et missions"],
  "workspace.mineEyebrow": ["Sala de mineração", "Mining room", "Sala de minería", "Salle de minage"],
  "workspace.manage": ["Gerenciar equipamentos", "Manage equipment", "Gestionar equipos", "Gérer les équipements"],
  "workspace.mine": ["Sua sala de mineração", "Your mining room", "Tu sala de minería", "Votre salle de minage"],
  "workspace.pools": ["Pools de mineração", "Mining pools", "Pools de minería", "Pools de minage"],
  "workspace.wallet": ["Carteira e conversão", "Wallet and conversion", "Cartera y conversión", "Portefeuille et conversion"],
  "workspace.inventory": ["Inventário de equipamentos", "Equipment inventory", "Inventario de equipos", "Inventaire des équipements"],
  "workspace.shop": ["Loja de equipamentos", "Equipment shop", "Tienda de equipos", "Boutique d’équipements"],
  "workspace.games": ["Central de minigames", "Minigame center", "Centro de minijuegos", "Centre des mini-jeux"],
  "workspace.season": ["Passe da temporada", "Season pass", "Pase de temporada", "Passe de saison"],
  "workspace.tasks": ["Central de tarefas", "Task center", "Centro de tareas", "Centre des tâches"],
  "workspace.career": ["Carreira do operador", "Operator career", "Carrera del operador", "Carrière de l’opérateur"],
  "metric.minerPower": ["Poder dos mineradores", "Miner power", "Poder de los mineros", "Puissance des mineurs"],
  "metric.gamePower": ["Poder dos minigames", "Minigame power", "Poder de los minijuegos", "Puissance des mini-jeux"],
  "metric.racks": ["Racks nesta sala", "Racks in this room", "Racks en esta sala", "Racks dans cette salle"],
  "metric.energy": ["Energia", "Energy", "Energía", "Énergie"],
  "metric.batteries": ["baterias", "batteries", "baterías", "batteries"],
  "metric.mainNetwork": ["Rede principal", "Main network", "Red principal", "Réseau principal"],
  "metric.useBattery": ["Use uma bateria", "Use a battery", "Usa una batería", "Utiliser une batterie"],
  "metric.batteryPowered": ["Alimentado por bateria", "Battery powered", "Alimentado por batería", "Alimenté par batterie"],
  "metric.noBattery": ["Sem bateria", "No battery", "Sin batería", "Sans batterie"],
  "metric.playToGenerate": ["Jogue para gerar", "Play to generate", "Juega para generar", "Jouez pour générer"],
  "metric.free": ["livres", "free", "libres", "libres"],
  "wallet.title": ["Carteira virtual", "Virtual wallet", "Cartera virtual", "Portefeuille virtuel"],
  "wallet.withdrawal": ["saque manual de BTC/DOGE/LTC", "manual BTC/DOGE/LTC withdrawal", "retiro manual de BTC/DOGE/LTC", "retrait manuel BTC/DOGE/LTC"],
  "wallet.showing": ["Exibindo", "Showing", "Mostrando", "Affiché"],
  "wallet.pin": ["Fixar", "Pin", "Fijar", "Fixer"],
  "wallet.open": ["Abrir carteira", "Open wallet", "Abrir cartera", "Ouvrir le portefeuille"],
  "wallet.convert": ["Converter", "Convert", "Convertir", "Convertir"],
  "block.single": ["Bloco minerado", "Block mined", "Bloque minado", "Bloc miné"],
  "block.multiple": ["Blocos minerados", "Blocks mined", "Bloques minados", "Blocs minés"],
  "block.singleDescription": ["O bloco #{block} foi processado.", "Block #{block} was processed.", "El bloque #{block} fue procesado.", "Le bloc #{block} a été traité."],
  "block.multipleDescription": ["{count} blocos foram processados até o #{block}.", "{count} blocks were processed through #{block}.", "Se procesaron {count} bloques hasta el #{block}.", "{count} blocs ont été traités jusqu’au #{block}."],
  "block.synced": ["Recompensa e extrato sincronizados pelo servidor.", "Reward and ledger synced by the server.", "Recompensa y extracto sincronizados por el servidor.", "Récompense et historique synchronisés par le serveur."],
  "block.close": ["Fechar aviso de bloco", "Close block notice", "Cerrar aviso de bloque", "Fermer l’avis de bloc"],
  "footer.brandSubtitle": ["Mineração virtual · entretenimento digital", "Virtual mining · digital entertainment", "Minería virtual · entretenimiento digital", "Minage virtuel · divertissement numérique"],
  "footer.start": ["Começar a jogar", "Start playing", "Empezar a jugar", "Commencer à jouer"],
  "footer.navigation": ["Navegação", "Navigation", "Navegación", "Navigation"],
  "footer.account": ["Conta e segurança", "Account and security", "Cuenta y seguridad", "Compte et sécurité"],
  "footer.contact": ["Fale conosco", "Contact us", "Contáctanos", "Contactez-nous"],
  "footer.contactDescription": ["Atendimento oficial para conta, depósitos e segurança.", "Official help for account, deposits and security.", "Atención oficial para cuenta, depósitos y seguridad.", "Assistance officielle pour le compte, les dépôts et la sécurité."],
  "footer.reply": ["Responderemos pelo protocolo dentro do site.", "We reply through an in-site ticket.", "Responderemos mediante el protocolo dentro del sitio.", "Nous répondrons via un ticket dans le site."],
  "footer.rights": ["Todos os direitos reservados.", "All rights reserved.", "Todos los derechos reservados.", "Tous droits réservés."],
};

const localeIndex: Record<ArcadiaLocale, number> = { "pt-BR": 0, en: 1 };
const copy = Object.fromEntries(
  supportedLocales.map((locale) => [locale, Object.fromEntries(Object.entries(entries).map(([key, values]) => [key, values[localeIndex[locale]]]))]),
) as Record<ArcadiaLocale, Record<string, string>>;

function isArcadiaLocale(value: string | null): value is ArcadiaLocale {
  return Boolean(value && supportedLocales.includes(value as ArcadiaLocale));
}

function browserLocale(): ArcadiaLocale {
  if (typeof navigator === "undefined") return "pt-BR";
  const language = navigator.language.toLowerCase();
  if (language.startsWith("en")) return "en";
  return "pt-BR";
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
    if (typeof window === "undefined") return "pt-BR";
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
