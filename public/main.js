// main.js - Ponto de entrada principal
import { handleLogin, handleRegister, logout } from './modules/auth.js';
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

// main.js - Ajustes na autenticação
// ... (código anterior)

// Função principal de inicialização
async function initSystem() {
    console.log('Inicializando sistema...');

    try {
        // Carregar catálogo
        const catalogResponse = await fetchCatalog();
        window.CATALOG = catalogResponse.catalog;
        window.GAMES_BASE = catalogResponse.games;

        // Carregar níveis de jogo
        window.USER_LEVELS_DATA = await fetchGameLevels();

        // Inicializar módulos
        initUI();
        initGameManager();
        initInventory();
        initStore();

        // Atualizar dados iniciais
        await updateData();

        // Iniciar loops de atualização
        setInterval(updateData, 5000);
        setInterval(mine, 10000);

        console.log('Sistema inicializado com sucesso!');
    } catch (error) {
        console.error('Erro ao inicializar sistema:', error);
    }
}

// Verificar autenticação ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, verificando autenticação...');

    const username = localStorage.getItem('username');
    if (username) {
        console.log('Usuário autenticado:', username);
        document.getElementById('user-display').textContent = username;
        document.getElementById('login-modal').classList.add('hidden');
        initSystem();
    } else {
        console.log('Usuário não autenticado.');
        document.getElementById('login-modal').classList.remove('hidden');
        // Mostrar a aba de login por padrão
        showLoginTab();
    }

    // Configurar abas de login/registro
    document.getElementById('tab-login').addEventListener('click', () => showLoginTab());
    document.getElementById('tab-register').addEventListener('click', () => showRegisterTab());

    // Configurar botões de login e registro
    document.getElementById('btn-login').addEventListener('click', handleLogin);
    document.getElementById('btn-register').addEventListener('click', handleRegister);

    // Suporte a Enter
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
});

function showLoginTab() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
}

function showRegisterTab() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.add('active');
}

// ... (resto do código)

// Exportar funções para uso global
window.initSystem = initSystem;
window.updateData = updateData;
window.logout = logout;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, inicializando autenticação...');

    // Verificar se já está autenticado
    const username = localStorage.getItem('username');
    if (username) {
        console.log('Usuário já autenticado:', username);
        document.getElementById('user-display').textContent = username;
        document.getElementById('login-modal').classList.add('hidden');
        initSystem();
    } else {
        console.log('Usuário não autenticado, mostrando modal de login');
        document.getElementById('login-modal').classList.remove('hidden');

        // Adicionar event listeners aos botões de login/registro
        document.getElementById('btn-login')?.addEventListener('click', handleLogin);
        document.getElementById('btn-register')?.addEventListener('click', handleRegister);

        // Adicionar suporte a Enter nos campos
        document.getElementById('username')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });

        document.getElementById('password')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
});