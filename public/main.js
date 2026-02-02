// main.js - Ponto de entrada principal corrigido
import { handleLogin, handleRegister, logout, showLoginTab, showRegisterTab } from './modules/auth.js';
import { updateData, mine } from './modules/mining.js';
import { initGameManager, renderGames } from './modules/game-manager.js';
import { initInventory, renderInventory } from './modules/inventory.js';
import { initStore, renderStore } from './modules/store.js';
import { initUI, updateUI } from './modules/ui-manager.js';
import { fetchCatalog, fetchStatus, fetchGameLevels } from './modules/api.js';

// Variáveis globais
window.USER_DATA = null;
window.CATALOG = {};
window.GAMES_BASE = {};
window.CURRENT_ROOM_IDX = 0;
window.USER_LEVELS_DATA = {};

// Função principal de inicialização
async function initSystem() {
    console.log('🚀 Inicializando sistema Crypto Miner Arcadia...');

    try {
        // Carregar catálogo
        const catalogResponse = await fetchCatalog();
        if (catalogResponse.catalog) {
            window.CATALOG = catalogResponse.catalog;
            window.GAMES_BASE = catalogResponse.catalog.games || {};
            console.log('📋 Catálogo carregado:', window.CATALOG);
        }

        // Carregar níveis de jogo
        window.USER_LEVELS_DATA = await fetchGameLevels();
        console.log('🎮 Níveis de jogo:', window.USER_LEVELS_DATA);

        // Inicializar módulos
        if (typeof initUI === 'function') initUI();
        if (typeof initGameManager === 'function') initGameManager();
        if (typeof initInventory === 'function') initInventory();
        if (typeof initStore === 'function') initStore();

        // Atualizar dados iniciais
        await updateData();

        // Iniciar loops de atualização
        setInterval(updateData, 30000); // Atualizar a cada 30 segundos
        setInterval(mine, 60000); // Minerar a cada 1 minuto

        console.log('✅ Sistema inicializado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao inicializar sistema:', error);
        alert('Erro ao inicializar o jogo. Por favor, recarregue a página.');
    }
}

// Funções de navegação
function navigateTo(page) {
    // Esconder todas as páginas
    document.querySelectorAll('.page').forEach(p => {
        p.classList.add('hidden');
    });
    
    // Remover active de todos os botões
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar página solicitada
    const pageElement = document.getElementById(`view-${page}`);
    if (pageElement) {
        pageElement.classList.remove('hidden');
    }
    
    // Ativar botão correspondente
    const navButton = document.querySelector(`.nav-item[onclick*="${page}"]`);
    if (navButton) {
        navButton.classList.add('active');
    }
    
    // Atualizar conteúdo específico da página
    if (page === 'games') {
        renderGames();
    } else if (page === 'store') {
        renderStore('miner');
    } else if (page === 'home') {
        // Atualizar sala de mineração
        if (window.USER_DATA) {
            updateUI(window.USER_DATA);
        }
    }
}

// Função de mudança de sala
function changeRoom(direction) {
    const maxRooms = window.USER_DATA?.rooms_unlocked || 1;
    const newIndex = window.CURRENT_ROOM_IDX + direction;
    
    if (newIndex >= 0 && newIndex < maxRooms) {
        window.CURRENT_ROOM_IDX = newIndex;
        document.getElementById('room-name').textContent = `ROOM ${newIndex + 1}`;
        
        // Atualizar renderização da sala
        if (window.USER_DATA) {
            updateUI(window.USER_DATA);
        }
    } else if (newIndex >= maxRooms) {
        alert('Esta sala está bloqueada. Desbloqueie mais salas na loja!');
    }
}

// Verificar autenticação ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM carregado, verificando autenticação...');

    // Configurar abas de login/registro
    document.getElementById('tab-login').addEventListener('click', () => showLoginTab());
    document.getElementById('tab-register').addEventListener('click', () => showRegisterTab());

    // Configurar botões de login e registro
    document.getElementById('btn-login').addEventListener('click', handleLogin);
    document.getElementById('btn-register').addEventListener('click', handleRegister);

    // Suporte a Enter nos formulários
    document.getElementById('login-username').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    document.getElementById('login-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    document.getElementById('register-username').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
    
    document.getElementById('register-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });

    // Configurar navegação
    window.nav = navigateTo;
    window.changeRoom = changeRoom;
    
    // Configurar botões de navegação
    document.querySelectorAll('.nav-item').forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        if (onclick && onclick.includes('nav(')) {
            btn.addEventListener('click', () => {
                const page = onclick.match(/nav\('(.+?)'\)/)[1];
                navigateTo(page);
            });
        }
    });

    // Verificar se já está autenticado
    const username = localStorage.getItem('username');
    const loggedIn = localStorage.getItem('loggedIn');
    
    if (username && loggedIn === 'true') {
        console.log('✅ Usuário autenticado:', username);
        document.getElementById('user-display').textContent = username;
        document.getElementById('login-modal').classList.add('hidden');
        
        // Iniciar sistema
        setTimeout(() => initSystem(), 500);
    } else {
        console.log('🔒 Usuário não autenticado, mostrando modal de login');
        document.getElementById('login-modal').classList.remove('hidden');
        showLoginTab();
        
        // Limpar dados antigos
        localStorage.clear();
    }

    // Configurar botões da loja
    document.querySelectorAll('.store-switches button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.textContent.toLowerCase().includes('miner') ? 'miner' : 'rack';
            if (window.renderStore) {
                window.renderStore(type);
            }
        });
    });
});

// Exportar funções para uso global
window.initSystem = initSystem;
window.updateData = updateData;
window.logout = logout;
window.navigateTo = navigateTo;
window.changeRoom = changeRoom;
window.showLoginTab = showLoginTab;
window.showRegisterTab = showRegisterTab;

// Funções auxiliares globais
window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.add('hidden');
};

window.closeVictory = function() {
    document.getElementById('victory-modal').classList.add('hidden');
    navigateTo('home');
};

window.closeVictoryAndPlay = function() {
    document.getElementById('victory-modal').classList.add('hidden');
    navigateTo('games');
};

window.abortGame = function() {
    document.getElementById('game-canvas-modal').classList.add('hidden');
    document.getElementById('game-start-modal').classList.add('hidden');
};