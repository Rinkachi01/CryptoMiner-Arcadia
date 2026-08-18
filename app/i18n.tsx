"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { spanishRuntime } from "./spanish-runtime";
import { englishArcadeRuntime, spanishArcadeRuntime } from "./arcade-runtime";

export type ArcadiaLocale = "pt-BR" | "en" | "es";
type Localized = [string, string];

const supportedLocales: ArcadiaLocale[] = ["pt-BR", "en", "es"];
// v3 makes the English-first default effective for visitors who had the
// old browser-detected Portuguese value cached before the international launch.
const localeStorageKey = "arcadia-locale-v3";
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
  "language.es": ["Espanhol", "Spanish"],
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
  "landing.cardTitle": ["Comece sua operação com segurança.", "Start your operation with confidence."],
  "landing.cardDescription": ["Entre na sua operação ou crie uma conta. O e-mail confirmado protege o seu progresso em qualquer dispositivo.", "Sign in or create an account to build your rooms, place miners, play the Arcade, and track server-verified rewards."],
  "landing.signIn": ["ENTRAR", "SIGN IN"],
  "landing.signUp": ["CRIAR CONTA", "CREATE ACCOUNT"],
  "landing.accessStatus": ["ACESSO PROTEGIDO", "PROTECTED ACCESS"],
  "landing.accessStatusDetail": ["Conta verificada · progresso no servidor", "Verified account · server-side progress"],
  "landing.accountNote": ["Uma conta nova recebe somente um rack e o minerador inicial. Nenhum CMA, bateria ou energia é concedido no cadastro.", "A new account receives only a rack and the starter miner. No CMA, battery, or energy is granted at signup."],
};

const spanishEntries: Record<string, string> = {
  "nav.mine": "Sala de minería",
  "nav.pools": "Pools",
  "nav.conversion": "Billetera",
  "nav.inventory": "Inventario",
  "nav.shop": "Tienda",
  "nav.games": "Minijuegos",
  "nav.season": "Temporada",
  "nav.leaderboard": "Clasificación global",
  "nav.tasks": "Tareas",
  "nav.career": "Centro del operador",
  "nav.short.mine": "Sala",
  "nav.short.pools": "Pools",
  "nav.short.conversion": "Billetera",
  "nav.short.inventory": "Objetos",
  "nav.short.shop": "Tienda",
  "nav.short.games": "Juegos",
  "nav.short.season": "Temporada",
  "nav.short.leaderboard": "Ranking",
  "nav.short.tasks": "Tareas",
  "nav.short.career": "Carrera",
  "nav.support": "Centro de soporte",
  "nav.owner": "Consola del propietario",
  "language.label": "Idioma",
  "language.pt": "Portugués",
  "language.en": "Inglés",
  "language.es": "Español",
  "profile.open": "Abrir mi perfil",
  "profile.account": "Cuenta protegida",
  "account.signout": "Salir",
  "account.connecting": "Conectando",
  "status.progress": "PROGRESO PROTEGIDO · VERSIÓN {version}",
  "status.loading": "CARGANDO TU CUENTA SEGURA",
  "status.error": "SERVIDOR NO DISPONIBLE · ACCIONES BLOQUEADAS",
  "status.block": "BLOQUE SINCRONIZADO #{block}",
  "sync.error": "No pudimos sincronizar tu cuenta",
  "sync.loading": "Sincronizando tu cuenta",
  "sync.errorDescription": "Tu saldo, nombre y poder siguen protegidos. Intenta de nuevo para cargar los datos del servidor.",
  "sync.loadingDescription": "Cargando saldo, poder y equipos guardados en el servidor.",
  "sync.retry": "Intentar de nuevo",
  "sidebar.operator": "Operador",
  "sidebar.serverAccount": "Cuenta en el servidor",
  "sidebar.virtualSimulation": "Simulación virtual",
  "sidebar.simulationDescription": "Operación virtual con progreso y economía controlados por el servidor.",
  "sidebar.navigation": "Navegación principal",
  "sidebar.terms": "Términos y privacidad",
  "workspace.rack": "Control del rack",
  "workspace.shopEyebrow": "Mercado Arcadia · equipos y energía",
  "workspace.walletEyebrow": "Billetera del operador · saldos y conversión",
  "workspace.gamesEyebrow": "Arcade Arcadia · minijuegos en línea",
  "workspace.seasonEyebrow": "Temporada 01 · Carrera espacial",
  "workspace.leaderboardEyebrow": "Clasificación global · mejores mineros",
  "workspace.tasksEyebrow": "Centro de tareas · misiones y feedback",
  "workspace.careerEyebrow": "Centro del operador · progreso y misiones",
  "workspace.mineEyebrow": "Sala de minería",
  "workspace.manage": "Gestionar equipos",
  "workspace.mine": "Tu sala de minería",
  "workspace.pools": "Pools de minería",
  "workspace.wallet": "Billetera y conversión",
  "workspace.inventory": "Inventario de equipos",
  "workspace.shop": "Tienda de equipos",
  "workspace.games": "Centro de minijuegos",
  "workspace.season": "Pase de temporada",
  "workspace.tasks": "Centro de tareas",
  "workspace.career": "Carrera del operador",
  "metric.minerPower": "Poder de los mineros",
  "metric.gamePower": "Poder de los minijuegos",
  "metric.racks": "Racks en esta sala",
  "metric.energy": "Energía",
  "metric.batteries": "baterías",
  "metric.mainNetwork": "Red principal",
  "metric.useBattery": "Usar una batería",
  "metric.batteryPowered": "Alimentado por batería",
  "metric.noBattery": "Sin batería",
  "metric.playToGenerate": "Juega para generar",
  "metric.free": "libres",
  "wallet.title": "Billetera virtual",
  "wallet.withdrawal": "retiro manual de BTC/DOGE/LTC",
  "wallet.showing": "Mostrando",
  "wallet.pin": "Fijar",
  "wallet.open": "Abrir billetera",
  "wallet.convert": "Convertir",
  "block.single": "Bloque minado",
  "block.multiple": "Bloques minados",
  "block.singleDescription": "El bloque #{block} fue procesado.",
  "block.multipleDescription": "Se procesaron {count} bloques hasta #{block}.",
  "block.synced": "Recompensa y registro sincronizados por el servidor.",
  "block.close": "Cerrar aviso del bloque",
  "footer.brandSubtitle": "Minería virtual · entretenimiento digital",
  "footer.start": "Comenzar a jugar",
  "footer.navigation": "Navegación",
  "footer.account": "Cuenta y seguridad",
  "footer.contact": "Contáctanos",
  "footer.contactDescription": "Soporte, novedades y comunidad oficial.",
  "footer.discordDescription": "Soporte, novedades y comunidad oficial.",
  "footer.discord": "Entrar al Discord",
  "footer.discordNote": "Accede al servidor oficial de Arcadia.",
  "footer.email": "Correo de soporte",
  "footer.emailNote": "Cuenta, pagos y atención.",
  "footer.reply": "Responderemos mediante el protocolo dentro del sitio.",
  "footer.documents": "Documentos",
  "footer.terms": "Términos de uso",
  "footer.privacy": "Privacidad",
  "footer.risk": "Aviso de riesgo",
  "footer.cookies": "Cookies",
  "footer.rights": "Todos los derechos reservados.",
  "landing.kicker": "ECONOMÍA CONTROLADA POR EL SERVIDOR",
  "landing.bannerAlt": "Crypto Miner Arcadia con mineros y minijuegos",
  "landing.title": "Construye tu operación. Compite por bloques globales.",
  "landing.description": "Construye salas, organiza racks, energiza tus mineros y distribuye tu poder entre CMA, Bitcoin, Dogecoin y Litecoin. Todas las recompensas son verificadas por el servidor.",
  "landing.poolsTitle": "POOLS GLOBALES",
  "landing.poolsDescription": "CMA, BTC, DOGE y LTC con distribución flexible de poder.",
  "landing.blockTitle": "BLOQUE FIJO",
  "landing.blockDescription": "Más poder cambia la participación, no la emisión total.",
  "landing.energyTitle": "CICLO DE ENERGÍA",
  "landing.energyDescription": "Las baterías y el Arcade mantienen activa la operación.",
  "landing.protectionNote": "Progreso individual protegido y sincronizado con tu cuenta",
  "landing.onboardingEyebrow": "CÓMO EMPEZAR",
  "landing.onboardingTitle": "Tu primera operación en tres pasos.",
  "landing.stepOneTitle": "Crea tu cuenta",
  "landing.stepOneDescription": "Confirma tu correo para mantener tu progreso seguro en cualquier dispositivo.",
  "landing.stepTwoTitle": "Configura el rack",
  "landing.stepTwoDescription": "Instala el rack inicial y coloca tu minero para comenzar a generar poder.",
  "landing.stepThreeTitle": "Juega y distribuye",
  "landing.stepThreeDescription": "Juega en el Arcade, reclama baterías y distribuye tu poder entre los pools.",
  "landing.communityTitle": "¿Necesitas ayuda antes de entrar?",
  "landing.communityDescription": "Consulta respuestas rápidas, soporte y la comunidad oficial.",
  "landing.communityFaq": "Ver FAQ",
  "landing.communitySupport": "Abrir soporte",
  "landing.communityDiscord": "Entrar al Discord",
  "landing.brandAlt": "Logo CMA",
  "landing.brand": "CRYPTO MINER ARCADIA",
  "landing.cardTitle": "Comienza tu operación con seguridad.",
  "landing.cardDescription": "Entra en tu operación o crea una cuenta. El correo confirmado protege tu progreso en cualquier dispositivo.",
  "landing.signIn": "ENTRAR",
  "landing.signUp": "CREAR CUENTA",
  "landing.accessStatus": "ACCESO PROTEGIDO",
  "landing.accessStatusDetail": "Cuenta verificada · progreso en el servidor",
  "landing.accountNote": "Una cuenta nueva recibe solo un rack y el minero inicial. No se concede CMA, batería ni energía al registrarse.",
};

const localeIndex: Record<"pt-BR" | "en", number> = { "pt-BR": 0, en: 1 };
const copy = Object.fromEntries(
  supportedLocales.map((locale) => [locale, Object.fromEntries(Object.entries(entries).map(([key, values]) => [key, locale === "es" ? spanishEntries[key] ?? values[1] : values[localeIndex[locale as "pt-BR" | "en"]]]))]),
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

function spanishText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const secure = trimmed.match(/^TRANSMISSÃO SEGURA · (.+)$/);
  if (secure) return `TRANSMISIÓN SEGURA · ${secure[1]}`;
  const recharge = trimmed.match(/^RECARGA (.+)$/);
  if (recharge) return `RECARGA ${recharge[1]}`;
  const wait = trimmed.match(/^Aguarde (.+) para iniciar outra rodada\. A recarga evita geração ilimitada de poder\.$/);
  if (wait) return `Espera ${wait[1]} para iniciar otra ronda. La recarga evita la generación ilimitada de poder.`;
  if (trimmed === "Você usou as partidas disponíveis nesta janela de 24 horas. O acesso volta automaticamente quando a janela renovar.") return "Usaste las partidas disponibles en esta ventana de 24 horas. El acceso volverá automáticamente cuando se renueve la ventana.";
  if (trimmed === "A proteção do Arcade pausou novas partidas nesta hora. Seu progresso já está salvo; tente novamente quando a janela renovar.") return "La protección del Arcade pausó nuevas partidas durante esta hora. Tu progreso ya está guardado; inténtalo de nuevo cuando se renueve la ventana.";
  if (trimmed === "O servidor está criando uma sessão única e protegida.") return "El servidor está creando una sesión única y protegida.";
  if (trimmed === "Sessão disponível. O resultado e o poder temporário serão conferidos pelo servidor.") return "Sesión disponible. El resultado y el poder temporal serán comprobados por el servidor.";
  if (trimmed === "LIMITE DIÁRIO ATINGIDO") return "LÍMITE DIARIO ALCANZADO";
  if (trimmed === "LIMITE DA HORA ATINGIDO") return "LÍMITE HORARIO ALCANZADO";
  const history = trimmed.match(/^ÚLTIMOS (\d+) DIAS · CONTA PESSOAL$/);
  if (history) return `ÚLTIMOS ${history[1]} DÍAS · CUENTA PERSONAL`;
  const dynamic = trimmed.match(/^(\d+)% REMAINING$/);
  if (dynamic) return `${dynamic[1]}% RESTANTE`;
  const over = trimmed.match(/^(\d+)% OVER$/);
  if (over) return `${over[1]}% SUPERIOR`;
  const cells = trimmed.match(/^(\d+) of 8 cells charged$/);
  if (cells) return `${cells[1]} de 8 celdas cargadas`;
  const translated = spanishRuntime[trimmed] ?? spanishArcadeRuntime[trimmed];
  return translated && translated !== trimmed ? translated : null;
}

function englishText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const secure = trimmed.match(/^TRANSMISSÃO SEGURA · (.+)$/);
  if (secure) return `SECURE TRANSMISSION · ${secure[1]}`;
  const recharge = trimmed.match(/^RECARGA (.+)$/);
  if (recharge) return `RECHARGE ${recharge[1]}`;
  const wait = trimmed.match(/^Aguarde (.+) para iniciar outra rodada\. A recarga evita geração ilimitada de poder\.$/);
  if (wait) return `Wait ${wait[1]} before starting another round. Recharge prevents unlimited power generation.`;
  if (trimmed === "Você usou as partidas disponíveis nesta janela de 24 horas. O acesso volta automaticamente quando a janela renovar.") return "You used all games available in this 24-hour window. Access returns automatically when the window renews.";
  if (trimmed === "A proteção do Arcade pausou novas partidas nesta hora. Seu progresso já está salvo; tente novamente quando a janela renovar.") return "Arcade protection paused new games this hour. Your progress is saved; try again when the window renews.";
  if (trimmed === "O servidor está criando uma sessão única e protegida.") return "The server is creating a unique protected session.";
  if (trimmed === "Sessão disponível. O resultado e o poder temporário serão conferidos pelo servidor.") return "Session available. The result and temporary power will be checked by the server.";
  if (trimmed === "LIMITE DIÁRIO ATINGIDO") return "DAILY LIMIT REACHED";
  if (trimmed === "LIMITE DA HORA ATINGIDO") return "HOURLY LIMIT REACHED";
  const history = trimmed.match(/^ÚLTIMOS (\d+) DIAS · CONTA PESSOAL$/);
  if (history) return `LAST ${history[1]} DAYS · PERSONAL ACCOUNT`;
  const translated = englishArcadeRuntime[trimmed];
  return translated && translated !== trimmed ? translated : null;
}

function translatedWithWhitespace(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function useLocaleRuntime(locale: ArcadiaLocale) {
  useEffect(() => {
    if (typeof document === "undefined" || locale === "pt-BR") return;
    const translate = locale === "es" ? spanishText : englishText;
    const root = document.body;
    type TextRecord = { original: string; translated: string };
    type AttributeRecord = { original: string; translated: string };
    const textRecords = new WeakMap<Text, TextRecord>();
    const attributeRecords = new WeakMap<HTMLElement, Map<string, AttributeRecord>>();
    let syncing = false;

    const sync = () => {
      if (syncing) return;
      syncing = true;
      try {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node: Node | null = walker.nextNode();
        while (node) {
          const textNode = node as Text;
          const parent = textNode.parentElement;
          if (parent && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
            const current = textNode.nodeValue ?? "";
            const record = textRecords.get(textNode);
            const source = record && current === record.translated ? record.original : current;
            const translated = translate(source);
            if (translated) {
              const next = translatedWithWhitespace(source, translated);
              textRecords.set(textNode, { original: source, translated: next });
              if (current !== next) textNode.nodeValue = next;
            } else if (record && current === record.translated) {
              textNode.nodeValue = record.original;
            }
          }
          node = walker.nextNode();
        }

        root.querySelectorAll<HTMLElement>("[aria-label], [title], [placeholder], [alt]").forEach((element) => {
          const records = attributeRecords.get(element) ?? new Map<string, AttributeRecord>();
          ["aria-label", "title", "placeholder", "alt"].forEach((name) => {
            const current = element.getAttribute(name);
            if (current === null) return;
            const record = records.get(name);
            const source = record && current === record.translated ? record.original : current;
            const translated = translate(source);
            if (!translated) return;
            const next = translatedWithWhitespace(source, translated);
            records.set(name, { original: source, translated: next });
            if (current !== next) element.setAttribute(name, next);
          });
          if (records.size) attributeRecords.set(element, records);
        });
      } finally {
        syncing = false;
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, characterData: true, subtree: true });
    return () => {
      observer.disconnect();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null = walker.nextNode();
      while (node) {
        const record = textRecords.get(node as Text);
        if (record && (node.nodeValue ?? "") === record.translated) node.nodeValue = record.original;
        node = walker.nextNode();
      }
      root.querySelectorAll<HTMLElement>("[aria-label], [title], [placeholder], [alt]").forEach((element) => {
        const records = attributeRecords.get(element);
        records?.forEach((record, name) => {
          if (element.getAttribute(name) === record.translated) element.setAttribute(name, record.original);
        });
      });
    };
  }, [locale]);
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
  useLocaleRuntime(locale);

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
      <span className="language-switcher-icon" aria-hidden="true">◎</span>
      <select value={locale} aria-label={t("language.label")} onChange={(event) => setLocale(event.target.value as ArcadiaLocale)}>
        <option value="pt-BR">{t("language.pt")}</option>
        <option value="en">{t("language.en")}</option>
        <option value="es">{t("language.es")}</option>
      </select>
    </label>
  );
}
