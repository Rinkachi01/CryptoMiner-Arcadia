// main.js - Ponto de entrada principal
import { initAuth, handleLogin, handleRegister, logout } from './modules/auth.js';
import { updateData, initData } from './modules/mining.js';
import { initGameManager } from './modules/game-manager.js';
import { initInventory } from './modules/inventory.js';
import { initStore } from './modules/store.js';
import { initUI } from './modules/ui-manager.js';

// Variáveis globais
window.USER_DATA = null;
window.CATALOG = {};
window.GAMES_BASE = {};
window.CURRENT_ROOM_IDX = 0;
window.USER_LEVELS_DATA = {};

// Função principal de inicialização
async function initSystem() {
    console.log('Inicializando sistema...');
    
    try {
        // Carregar catálogo
        const catalogResponse = await fetch('/api/catalog');
        const catalogData = await catalogResponse.json();
        window.CATALOG = catalogData.catalog;
        window.GAMES_BASE = catalogData.games;
        
        // Inicializar módulos
        initUI();
        initGameManager();
        initInventory();
        initStore();
        
        // Atualizar dados iniciais
        await updateData();
        
        // Iniciar loops de atualização
        setInterval(updateData, 5000);
        setInterval(window.mine, 10000);
        
        console.log('Sistema inicializado com sucesso!');
    } catch (error) {
        console.error('Erro ao inicializar sistema:', error);
    }
}

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