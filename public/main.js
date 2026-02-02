// ===========================================
// CRYPTO MINER ARCADIA 2.0 - MAIN ENTRY POINT
// ===========================================

import { handleLogin, handleRegister, logout, showLoginTab, showRegisterTab } from './modules/auth.js';
import { updateData, mine } from './modules/mining.js';
import { initGameManager, renderGames } from './modules/game-manager.js';
import { initInventory, renderInventory } from './modules/inventory.js';
import { initStore, renderStore } from './modules/store.js';
import { initUI, updateUI } from './modules/ui-manager.js';
import { fetchCatalog, fetchStatus, fetchGameLevels } from './modules/api.js';

// ===========================================
// GLOBAL VARIABLES
// ===========================================

window.USER_DATA = null;
window.CATALOG = {};
window.GAMES_BASE = {};
window.CURRENT_ROOM_IDX = 0;
window.USER_LEVELS_DATA = {};
window.APP_STATE = {
    initialized: false,
    loading: true,
    miningInterval: null,
    updateInterval: null
};

// ===========================================
// INITIALIZATION FUNCTIONS
// ===========================================

/**
 * Inicializa o sistema principal do jogo
 */
async function initSystem() {
    console.log('🚀 Inicializando Crypto Miner Arcadia 2.0...');
    
    if (window.APP_STATE.initialized) {
        console.warn('⚠️ Sistema já inicializado');
        return;
    }
    
    try {
        // Atualizar texto de loading
        updateLoadingText('Carregando catálogo...');
        updateLoadingProgress(10);
        
        // Carregar catálogo
        const catalogResponse = await fetchCatalog();
        if (catalogResponse?.catalog) {
            window.CATALOG = catalogResponse.catalog;
            window.GAMES_BASE = catalogResponse.catalog.games || {};
            console.log('✅ Catálogo carregado:', Object.keys(window.CATALOG));
        }
        
        updateLoadingText('Carregando níveis de jogo...');
        updateLoadingProgress(30);
        
        // Carregar níveis de jogo
        window.USER_LEVELS_DATA = await fetchGameLevels();
        console.log('✅ Níveis de jogo carregados:', window.USER_LEVELS_DATA);
        
        updateLoadingText('Inicializando interface...');
        updateLoadingProgress(50);
        
        // Inicializar módulos
        if (typeof initUI === 'function') {
            initUI();
            console.log('✅ Interface inicializada');
        }
        
        if (typeof initGameManager === 'function') {
            initGameManager();
            console.log('✅ Gerenciador de jogos inicializado');
        }
        
        if (typeof initInventory === 'function') {
            initInventory();
            console.log('✅ Inventário inicializado');
        }
        
        if (typeof initStore === 'function') {
            initStore();
            console.log('✅ Loja inicializada');
        }
        
        updateLoadingText('Sincronizando dados...');
        updateLoadingProgress(70);
        
        // Atualizar dados iniciais
        await updateData();
        
        updateLoadingText('Iniciando serviços...');
        updateLoadingProgress(90);
        
        // Iniciar loops de atualização
        startUpdateLoops();
        
        updateLoadingText('Pronto!');
        updateLoadingProgress(100);
        
        // Esconder loading após 1 segundo
        setTimeout(() => {
            hideLoadingScreen();
            window.APP_STATE.initialized = true;
            window.APP_STATE.loading = false;
            
            // Mostrar notificação de boas-vindas
            showWelcomeNotification();
            
            console.log('✅ Sistema inicializado com sucesso!');
        }, 1000);
        
    } catch (error) {
        console.error('❌ Erro ao inicializar sistema:', error);
        showErrorModal('Erro de inicialização', 'Não foi possível carregar o jogo. Por favor, recarregue a página.');
    }
}

/**
 * Inicia os loops de atualização automática
 */
function startUpdateLoops() {
    // Atualizar dados a cada 30 segundos
    if (window.APP_STATE.updateInterval) {
        clearInterval(window.APP_STATE.updateInterval);
    }
    
    window.APP_STATE.updateInterval = setInterval(async () => {
        if (window.USER_DATA && !window.APP_STATE.loading) {
            await updateData();
        }
    }, 30000);
    
    // Mineração automática a cada 1 minuto
    if (window.APP_STATE.miningInterval) {
        clearInterval(window.APP_STATE.miningInterval);
    }
    
    window.APP_STATE.miningInterval = setInterval(async () => {
        if (window.USER_DATA && !window.APP_STATE.loading) {
            await mine();
        }
    }, 60000);
    
    console.log('✅ Loops de atualização iniciados');
}

// ===========================================
// LOADING SCREEN FUNCTIONS
// ===========================================

/**
 * Atualiza o texto da tela de loading
 */
function updateLoadingText(text) {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) {
        loadingText.textContent = text;
    }
}

/**
 * Atualiza o progresso da barra de loading
 */
function updateLoadingProgress(percent) {
    const loadingFill = document.getElementById('loading-fill');
    if (loadingFill) {
        loadingFill.style.width = `${percent}%`;
    }
    
    // Atualizar dicas de carregamento
    const loadingTip = document.getElementById('loading-tip');
    const tips = [
        'Dica: Complete missões diárias para ganhar bônus!',
        'Dica: Jogue minigames para aumentar seu poder de mineração.',
        'Dica: Upgrades podem melhorar a eficiência dos seus mineradores.',
        'Dica: Monitore a temperatura dos seus equipamentos.',
        'Dica: Conecte-se com amigos para bônus sociais.',
        'Dica: Participe de eventos especiais para recompensas exclusivas.',
        'Dica: Use baterias para recarregar sua energia rapidamente.'
    ];
    
    if (loadingTip) {
        const randomTip = tips[Math.floor(Math.random() * tips.length)];
        loadingTip.textContent = randomTip;
    }
}

/**
 * Esconde a tela de loading
 */
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }
}

// ===========================================
// NAVIGATION FUNCTIONS
// ===========================================

/**
 * Navega para uma página específica
 */
function navigateTo(pageId) {
    // Esconder todas as páginas
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Remover active de todos os botões de navegação
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar a página solicitada
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.add('active');
        
        // Ativar o botão correspondente
        const navBtn = document.querySelector(`.nav-item[data-page="${pageId}"]`);
        if (navBtn) {
            navBtn.classList.add('active');
        }
        
        // Executar ações específicas da página
        onPageLoad(pageId);
    }
}

/**
 * Executa ações quando uma página é carregada
 */
function onPageLoad(pageId) {
    switch(pageId) {
        case 'home':
            if (window.USER_DATA) {
                updateUI(window.USER_DATA);
                renderMiningRoom();
            }
            break;
            
        case 'games':
            renderGames();
            break;
            
        case 'store':
            renderStore('miners');
            break;
            
        case 'inventory':
            renderInventory();
            break;
            
        case 'mining':
            renderMiningStats();
            break;
            
        case 'leaderboard':
            loadLeaderboard();
            break;
            
        case 'missions':
            loadMissions();
            break;
    }
}

/**
 * Muda de sala de mineração
 */
function changeRoom(direction) {
    if (!window.USER_DATA) return;
    
    const maxRooms = window.USER_DATA.rooms_unlocked || 1;
    const newIndex = window.CURRENT_ROOM_IDX + direction;
    
    if (newIndex >= 0 && newIndex < maxRooms) {
        window.CURRENT_ROOM_IDX = newIndex;
        
        // Atualizar nome da sala
        const roomName = document.getElementById('room-name');
        if (roomName) {
            roomName.textContent = `SALA ${newIndex + 1}`;
        }
        
        // Renderizar a nova sala
        renderMiningRoom();
        
        // Animar transição
        const roomContainer = document.getElementById('room-container');
        if (roomContainer) {
            roomContainer.style.opacity = '0';
            setTimeout(() => {
                roomContainer.style.opacity = '1';
            }, 300);
        }
        
    } else if (newIndex >= maxRooms) {
        showNotification('🔒 Sala Bloqueada', 'Desbloqueie mais salas na loja!', 'warning');
    }
}

// ===========================================
// UI HELPER FUNCTIONS
// ===========================================

/**
 * Mostra uma notificação na tela
 */
function showNotification(title, message, type = 'info') {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icon = type === 'success' ? '✅' :
                 type === 'error' ? '❌' :
                 type === 'warning' ? '⚠️' : 'ℹ️';
    
    notification.innerHTML = `
        <div class="notification-header">
            <span class="notification-icon">${icon}</span>
            <span class="notification-title">${title}</span>
            <button class="notification-close">&times;</button>
        </div>
        <div class="notification-body">${message}</div>
    `;
    
    // Adicionar ao DOM
    document.body.appendChild(notification);
    
    // Adicionar estilos
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--bg-card);
        border: 1px solid ${type === 'success' ? 'var(--success)' : 
                          type === 'error' ? 'var(--error)' : 
                          type === 'warning' ? 'var(--warning)' : 'var(--info)'};
        border-radius: var(--border-radius);
        padding: var(--space-md);
        width: 300px;
        max-width: 90vw;
        box-shadow: var(--shadow-medium);
        z-index: 1000;
        animation: slideInRight 0.3s ease;
    `;
    
    // Adicionar evento de fechar
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

/**
 * Mostra modal de erro
 */
function showErrorModal(title, message) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2 style="color: var(--error);">${title}</h2>
            <p>${message}</p>
            <div style="margin-top: var(--space-lg); display: flex; gap: var(--space-md);">
                <button class="btn-neon-green" onclick="this.closest('.modal').remove(); location.reload();">
                    Recarregar
                </button>
                <button class="btn-neon-outline" onclick="this.closest('.modal').remove();">
                    Fechar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * Mostra notificação de boas-vindas
 */
function showWelcomeNotification() {
    const username = localStorage.getItem('username');
    if (!username) return;
    
    // Verificar se é primeira vez
    const firstTime = !localStorage.getItem('welcome_shown');
    
    if (firstTime) {
        showNotification(
            '🎉 Bem-vindo ao Crypto Miner Arcadia!',
            'Você recebeu bônus de boas-vindas! Verifique seu inventário.',
            'success'
        );
        localStorage.setItem('welcome_shown', 'true');
    }
    
    // Mostrar sempre notificação de login
    showNotification(
        '👋 Olá, ' + username + '!',
        'Sua mineração começou automaticamente. Boa sorte!',
        'info'
    );
}

// ===========================================
// EVENT LISTENERS SETUP
// ===========================================

/**
 * Configura todos os event listeners
 */
function setupEventListeners() {
    // Login/Register tabs
    document.getElementById('tab-login')?.addEventListener('click', showLoginTab);
    document.getElementById('tab-register')?.addEventListener('click', showRegisterTab);
    
    // Login/Register buttons
    document.getElementById('btn-login')?.addEventListener('click', handleLogin);
    document.getElementById('btn-register')?.addEventListener('click', handleRegister);
    
    // Enter key support
    ['login-username', 'login-password', 'register-username', 'register-password'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (id.startsWith('login')) handleLogin();
                    else handleRegister();
                }
            });
        }
    });
    
    // Navigation buttons
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const pageId = btn.dataset.page;
            navigateTo(pageId);
        });
    });
    
    // Room navigation
    document.querySelectorAll('.btn-room-nav').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const direction = e.target.closest('.btn-room-nav').innerHTML.includes('left') ? -1 : 1;
            changeRoom(direction);
        });
    });
    
    // Store categories
    document.querySelectorAll('.store-category').forEach(category => {
        category.addEventListener('click', (e) => {
            const categoryType = e.currentTarget.dataset.category;
            renderStore(categoryType);
        });
    });
    
    // Inventory tabs
    document.querySelectorAll('.inv-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabType = e.currentTarget.dataset.tab;
            // Implementar troca de abas do inventário
        });
    });
    
    // Password strength checker
    const passwordInput = document.getElementById('register-password');
    if (passwordInput) {
        passwordInput.addEventListener('input', checkPasswordStrength);
    }
    
    // Terms checkbox
    const termsCheckbox = document.getElementById('terms-checkbox');
    const registerButton = document.getElementById('btn-register');
    if (termsCheckbox && registerButton) {
        termsCheckbox.addEventListener('change', () => {
            registerButton.disabled = !termsCheckbox.checked;
        });
    }
    
    // Quick mine button
    const quickMineBtn = document.querySelector('.btn-quick-mine');
    if (quickMineBtn) {
        quickMineBtn.addEventListener('click', async () => {
            quickMineBtn.disabled = true;
            quickMineBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> MINERANDO...';
            
            try {
                await mine();
                showNotification('⛏️ Mineração Completa', 'Você minerou algumas moedas!', 'success');
            } catch (error) {
                showNotification('❌ Erro', 'Falha na mineração', 'error');
            } finally {
                setTimeout(() => {
                    quickMineBtn.disabled = false;
                    quickMineBtn.innerHTML = '<i class="fa-solid fa-hammer"></i> MINERAR';
                }, 1000);
            }
        });
    }
}

/**
 * Verifica a força da senha durante o registro
 */
function checkPasswordStrength() {
    const password = document.getElementById('register-password').value;
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.getElementById('strength-text');
    const container = document.querySelector('.password-strength');
    
    if (!password) {
        container.className = 'password-strength';
        return;
    }
    
    // Calcular força
    let strength = 0;
    const requirements = {
        length: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
    };
    
    // Atualizar ícones dos requisitos
    Object.keys(requirements).forEach(req => {
        const element = document.getElementById(`req-${req}`);
        if (element) {
            element.className = requirements[req] ? 'valid' : 'invalid';
            element.querySelector('i').className = requirements[req] ? 'fa-solid fa-check' : 'fa-solid fa-times';
        }
        
        if (requirements[req]) strength++;
    });
    
    // Atualizar visualização da força
    let strengthLevel = '';
    let color = '';
    
    if (strength <= 1) {
        strengthLevel = 'Muito Fraca';
        color = 'error';
    } else if (strength <= 2) {
        strengthLevel = 'Fraca';
        color = 'warning';
    } else if (strength <= 3) {
        strengthLevel = 'Média';
        color = 'warning';
    } else if (strength <= 4) {
        strengthLevel = 'Forte';
        color = 'success';
    } else {
        strengthLevel = 'Excelente';
        color = 'excellent';
    }
    
    container.className = `password-strength ${color}`;
    if (strengthText) strengthText.textContent = strengthLevel;
}

// ===========================================
// AUTHENTICATION CHECK
// ===========================================

/**
 * Verifica autenticação existente
 */
function checkExistingAuth() {
    const username = localStorage.getItem('username');
    const loggedIn = localStorage.getItem('loggedIn');
    
    if (username && loggedIn === 'true') {
        console.log('✅ Usuário autenticado:', username);
        
        // Atualizar display do usuário
        const userDisplay = document.getElementById('user-display');
        if (userDisplay) {
            userDisplay.textContent = username;
        }
        
        // Esconder modal de login
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.classList.add('hidden');
        }
        
        // Mostrar interface do jogo
        const gameInterface = document.getElementById('game-interface');
        if (gameInterface) {
            gameInterface.classList.remove('hidden');
        }
        
        return true;
    }
    
    return false;
}

// ===========================================
// DOM CONTENT LOADED
// ===========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 DOM carregado, configurando sistema...');
    
    // Configurar event listeners
    setupEventListeners();
    
    // Verificar autenticação
    const isAuthenticated = checkExistingAuth();
    
    if (isAuthenticated) {
        // Iniciar sistema
        setTimeout(() => initSystem(), 500);
    } else {
        // Mostrar modal de login
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.classList.remove('hidden');
            showLoginTab();
        }
        
        // Esconder interface do jogo
        const gameInterface = document.getElementById('game-interface');
        if (gameInterface) {
            gameInterface.classList.add('hidden');
        }
    }
    
    // Configurar logout
    window.logout = logout;
    
    // Configurar funções globais
    window.navigateTo = navigateTo;
    window.changeRoom = changeRoom;
    window.showLoginTab = showLoginTab;
    window.showRegisterTab = showRegisterTab;
    
    console.log('✅ Sistema configurado');
});

// ===========================================
// GLOBAL FUNCTIONS
// ===========================================

/**
 * Função para mineração rápida
 */
window.quickMine = async function() {
    if (!window.USER_DATA) return;
    
    const btn = document.querySelector('.btn-quick-mine');
    if (btn) {
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> MINERANDO...';
        
        try {
            const result = await mine();
            if (result?.success) {
                showNotification('💰 Mineração Completa', `+${result.reward?.toFixed(6) || '0'} CMA`, 'success');
            }
        } catch (error) {
            console.error('Erro na mineração:', error);
            showNotification('❌ Erro', 'Falha na mineração', 'error');
        } finally {
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }, 1000);
        }
    }
};

/**
 * Função para recarregar energia
 */
window.rechargeEnergy = function(type) {
    if (!window.USER_DATA) return;
    
    // Implementar lógica de recarga
    showNotification('⚡ Energia', `Recarga ${type} solicitada`, 'info');
};

/**
 * Função para mostrar inventário completo
 */
window.showFullInventory = function() {
    navigateTo('inventory');
};

/**
 * Função para comprar nova sala
 */
window.buyNewRoom = function() {
    if (!window.USER_DATA) return;
    
    // Verificar se pode comprar
    if (window.USER_DATA.balance < 1000) {
        showNotification('❌ Saldo Insuficiente', 'Precisa de 1000 CMA para nova sala', 'error');
        return;
    }
    
    // Implementar compra de sala
    showNotification('🚧 Em Desenvolvimento', 'Esta função estará disponível em breve', 'info');
};

/**
 * Função para fechar modais
 */
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
};

/**
 * Função para mostrar ajuda
 */
window.showHelp = function() {
    showNotification('❓ Ajuda', 'Visite a seção de Configurações para mais informações', 'info');
};

/**
 * Função para mostrar suporte
 */
window.showSupport = function() {
    showNotification('🛟 Suporte', 'Entre em contato: support@cryptominerarcadia.com', 'info');
};

/**
 * Função para mostrar sobre
 */
window.showAbout = function() {
    showNotification('ℹ️ Sobre', 'Crypto Miner Arcadia 2.0 • Desenvolvido com ❤️', 'info');
};

// ===========================================
// TEMPORARY PLACEHOLDER FUNCTIONS
// ===========================================

/**
 * Renderiza a sala de mineração (placeholder)
 */
function renderMiningRoom() {
    const roomContainer = document.getElementById('room-container');
    if (!roomContainer) return;
    
    roomContainer.innerHTML = '';
    
    // Criar 12 slots (4x3)
    for (let i = 0; i < 12; i++) {
        const slot = document.createElement('div');
        slot.className = 'room-slot';
        slot.innerHTML = `
            <div class="slot-content">
                <i class="fa-solid fa-plus"></i>
                <span>Slot ${i + 1}</span>
            </div>
        `;
        
        slot.addEventListener('click', () => {
            showNotification('🎯 Slot Disponível', `Clique para colocar um rack no slot ${i + 1}`, 'info');
        });
        
        roomContainer.appendChild(slot);
    }
    
    // Atualizar estatísticas da sala
    updateRoomStats();
}

/**
 * Atualiza estatísticas da sala (placeholder)
 */
function updateRoomStats() {
    const installedRacks = document.getElementById('installed-racks');
    const freeSlots = document.getElementById('free-slots');
    const roomEfficiency = document.getElementById('room-efficiency');
    
    if (installedRacks) installedRacks.textContent = '0/12';
    if (freeSlots) freeSlots.textContent = '12 slots';
    if (roomEfficiency) roomEfficiency.textContent = '0%';
}

/**
 * Renderiza estatísticas de mineração (placeholder)
 */
function renderMiningStats() {
    // Implementar quando a página de mineração for desenvolvida
}

/**
 * Carrega leaderboard (placeholder)
 */
function loadLeaderboard() {
    // Implementar quando a página de leaderboard for desenvolvida
}

/**
 * Carrega missões (placeholder)
 */
function loadMissions() {
    // Implementar quando a página de missões for desenvolvida
}

// ===========================================
// EXPORT GLOBAL FUNCTIONS
// ===========================================

window.initSystem = initSystem;
window.updateData = updateData;
window.logout = logout;
window.navigateTo = navigateTo;
window.changeRoom = changeRoom;
window.quickMine = window.quickMine;

console.log('✅ main.js carregado');