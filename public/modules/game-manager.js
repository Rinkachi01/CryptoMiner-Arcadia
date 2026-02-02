// ===========================================
// GAME MANAGER - Gerenciador de minigames
// ===========================================

import { apiCall, startGame, claimGameReward } from './api.js';

/**
 * Inicializa o gerenciador de jogos
 */
export function initGameManager() {
    console.log('🎮 Inicializando gerenciador de jogos...');
    
    // Configurar event listeners para os jogos
    setupGameEventListeners();
    
    console.log('✅ Gerenciador de jogos inicializado');
}

/**
 * Renderiza a lista de jogos
 */
export function renderGames() {
    const gamesGrid = document.getElementById('games-grid');
    if (!gamesGrid || !window.GAMES_BASE) return;
    
    gamesGrid.innerHTML = '';
    
    Object.entries(window.GAMES_BASE).forEach(([gameId, gameData]) => {
        const level = window.USER_LEVELS_DATA[gameId]?.level || 1;
        const lastPlayed = window.USER_LEVELS_DATA[gameId]?.last_played || 0;
        
        // Calcular cooldown
        const cooldown = 30 + (level * 15); // 30s + 15s por nível
        const timePassed = Date.now() - lastPlayed;
        const canPlay = timePassed >= (cooldown * 1000);
        const cooldownLeft = Math.ceil((cooldown * 1000 - timePassed) / 1000);
        
        // Calcular recompensa
        const baseReward = gameData.reward || 100;
        const reward = Math.floor(baseReward * Math.pow(gameData.diff_mult || 1.2, level - 1));
        
        const gameCard = document.createElement('div');
        gameCard.className = 'game-card';
        gameCard.innerHTML = `
            <div class="game-icon">
                <i class="${getGameIcon(gameId)}"></i>
            </div>
            <h3>${gameData.name}</h3>
            <p class="game-description">${getGameDescription(gameId)}</p>
            
            <div class="game-stats">
                <div class="game-stat">
                    <i class="fa-solid fa-coins"></i>
                    <span>${reward} GH/s</span>
                </div>
                <div class="game-stat">
                    <i class="fa-solid fa-clock"></i>
                    <span>${gameData.time}s</span>
                </div>
                <div class="game-stat">
                    <i class="fa-solid fa-chart-simple"></i>
                    <span>Nível ${level}</span>
                </div>
            </div>
            
            <button class="btn-neon-green play-btn" 
                    data-game="${gameId}"
                    ${!canPlay ? 'disabled' : ''}>
                ${canPlay ? 'JOGAR' : `COOLDOWN: ${cooldownLeft}s`}
            </button>
        `;
        
        gamesGrid.appendChild(gameCard);
    });
    
    // Re-configurar event listeners
    setupGameEventListeners();
}

/**
 * Obtém ícone do jogo
 */
function getGameIcon(gameId) {
    switch(gameId) {
        case 'coin-clicker': return 'fa-solid fa-coins';
        case 'flappy-rocket': return 'fa-solid fa-rocket';
        case 'crypto-2048': return 'fa-solid fa-th';
        case 'crypto-match': return 'fa-solid fa-puzzle-piece';
        case 'crypto-defender': return 'fa-solid fa-shield-alt';
        default: return 'fa-solid fa-gamepad';
    }
}

/**
 * Obtém descrição do jogo
 */
function getGameDescription(gameId) {
    switch(gameId) {
        case 'coin-clicker': return 'Clique nas moedas para coletar!';
        case 'flappy-rocket': return 'Desvie dos obstáculos no espaço!';
        case 'crypto-2048': return 'Combine criptomoedas para alcançar o Bitcoin!';
        case 'crypto-match': return 'Encontre pares de criptomoedas iguais!';
        case 'crypto-defender': return 'Proteja sua carteira de hackers!';
        default: return 'Divirta-se e ganhe recompensas!';
    }
}

/**
 * Configura event listeners dos jogos
 */
function setupGameEventListeners() {
    // Botões de jogar
    document.querySelectorAll('.play-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const gameId = e.target.dataset.game;
            if (gameId) {
                await launchGame(gameId);
            }
        });
    });
    
    // Botões de jogos em destaque
    document.querySelectorAll('[data-game]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const gameId = e.target.dataset.game;
            if (gameId) {
                await launchGame(gameId);
            }
        });
    });
}

/**
 * Lança um jogo
 */
async function launchGame(gameId) {
    console.log(`🎮 Iniciando jogo: ${gameId}`);
    
    // Mostrar modal de loading
    showGameLoading(gameId);
    
    try {
        // Iniciar jogo no servidor
        const response = await startGame(gameId);
        
        if (response.success) {
            // Em uma implementação completa, aqui iniciaria o jogo real
            // Por enquanto, simular um jogo
            simulateGame(gameId, response);
        } else {
            alert(response.message || 'Erro ao iniciar jogo');
        }
        
    } catch (error) {
        console.error('Erro ao iniciar jogo:', error);
        alert('Erro de conexão com o servidor');
    }
}

/**
 * Mostra loading do jogo
 */
function showGameLoading(gameId) {
    // Implementar modal de loading específico do jogo
    console.log(`⏳ Carregando jogo: ${gameId}`);
}

/**
 * Simula um jogo (para demonstração)
 */
async function simulateGame(gameId, startData) {
    // Para demonstração, vamos simular um jogo simples
    const gameName = window.GAMES_BASE[gameId]?.name || 'Jogo';
    const duration = window.GAMES_BASE[gameId]?.time || 60;
    
    alert(`🎮 ${gameName} iniciado!\n\nDuração: ${duration}s\n\nEm uma versão completa, o jogo real seria carregado aqui.`);
    
    // Simular resultado após um tempo
    setTimeout(async () => {
        const score = Math.floor(Math.random() * 1000) + 500;
        const won = Math.random() > 0.3; // 70% de chance de vitória
        
        // Reivindicar recompensa
        await finishGame(gameId, score, won);
    }, 2000);
}

/**
 * Finaliza um jogo e reivindica recompensa
 */
async function finishGame(gameId, score, won) {
    try {
        const response = await claimGameReward(gameId, score, won);
        
        if (response.success) {
            showVictoryModal(response, score, won);
            
            // Atualizar dados do usuário
            if (window.updateData) {
                await window.updateData();
            }
            
            // Atualizar lista de jogos
            renderGames();
            
        } else {
            alert(response.message || 'Erro ao reivindicar recompensa');
        }
        
    } catch (error) {
        console.error('Erro ao finalizar jogo:', error);
        alert('Erro de conexão com o servidor');
    }
}

/**
 * Mostra modal de vitória
 */
function showVictoryModal(result, score, won) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="victory-card">
            <div class="victory-header">
                <i class="fa-solid fa-${won ? 'trophy' : 'times'}"></i>
                <h2>${won ? 'VITÓRIA!' : 'FIM DE JOGO'}</h2>
            </div>
            
            <div class="victory-body">
                <div class="victory-stat">
                    <span>Pontuação:</span>
                    <strong>${score}</strong>
                </div>
                
                <div class="victory-stat">
                    <span>Recompensa:</span>
                    <strong style="color: var(--neon-green);">+${result.reward} GH/s</strong>
                </div>
                
                ${result.coins ? `
                <div class="victory-stat">
                    <span>Moedas:</span>
                    <strong style="color: var(--cyan);">+${result.coins} CMA</strong>
                </div>
                ` : ''}
                
                ${result.battery ? `
                <div class="victory-stat">
                    <span>Item Drop:</span>
                    <strong style="color: var(--warning);">+1 Bateria</strong>
                </div>
                ` : ''}
                
                ${result.experience ? `
                <div class="victory-stat">
                    <span>Experiência:</span>
                    <strong style="color: var(--neon-pink);">+${result.experience} XP</strong>
                </div>
                ` : ''}
                
                ${result.level_up ? `
                <div class="victory-bonus">
                    <i class="fa-solid fa-star"></i>
                    <span>NOVO NÍVEL ALCANÇADO!</span>
                </div>
                ` : ''}
            </div>
            
            <div class="victory-actions">
                <button class="btn-neon-green" onclick="this.closest('.modal').remove(); window.navigateTo('games');">
                    VOLTAR AOS JOGOS
                </button>
                <button class="btn-neon-outline" onclick="this.closest('.modal').remove(); window.navigateTo('home');">
                    IR PARA INÍCIO
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Exportar para uso global
window.initGameManager = initGameManager;
window.renderGames = renderGames;
window.launchGame = launchGame;

console.log('✅ game-manager.js carregado');